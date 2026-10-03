import { BadRequestException, Injectable } from '@nestjs/common';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  detectCrm,
  findNameParts,
  normalizeHeader,
  suggestMapping,
} from './column-matcher';
import {
  ColumnMapping,
  ImportableField,
  ImportPreview,
  ImportResult,
  IMPORTABLE_FIELDS,
  REQUIRED_FIELDS,
} from './crm-import.types';

const PREVIEW_ROWS = 10;
const MAX_ROWS = 50_000;

@Injectable()
export class CrmImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parses an uploaded export and returns its headers plus a suggested
   * mapping, so the user confirms (or corrects) the column mapping before
   * anything is written.
   */
  async preview(buffer: Buffer): Promise<ImportPreview> {
    const { headers, rows } = await this.parseCsv(buffer);

    if (headers.length === 0) {
      throw new BadRequestException(
        'That file has no readable header row. Export it from your CRM as CSV and try again.',
      );
    }

    return {
      headers,
      rows: rows.slice(0, PREVIEW_ROWS),
      totalRows: rows.length,
      suggestedMapping: suggestMapping(headers),
      detectedCrm: detectCrm(headers),
    };
  }

  /**
   * Imports the file using the confirmed mapping. Rows are matched on email
   * first, then name+company, so re-importing an updated export of the same
   * CRM data updates leads instead of duplicating them.
   */
  async commit(
    buffer: Buffer,
    mapping: ColumnMapping,
    tenantId: string,
    userId: string,
    sourceLabel?: string,
  ): Promise<ImportResult> {
    const { headers, rows } = await this.parseCsv(buffer);
    this.assertMappingIsUsable(mapping, headers);

    const nameParts = mapping.name ? null : findNameParts(headers);

    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      totalRows: rows.length,
      errors: [],
    };

    for (const [index, row] of rows.entries()) {
      // Header row is line 1, so the first data row reads as line 2.
      const line = index + 2;

      const name = this.resolveName(row, mapping, nameParts);
      const company = this.value(row, mapping.company);
      const email = this.value(row, mapping.email);
      const phone = this.value(row, mapping.phone);
      const status = this.value(row, mapping.status)?.toLowerCase() || 'new';

      if (!name || !company) {
        result.skipped += 1;
        if (result.errors.length < 50) {
          result.errors.push({
            row: line,
            reason: !name ? 'Missing a name' : 'Missing a company',
          });
        }
        continue;
      }

      const existing = await this.prisma.lead.findFirst({
        where: {
          tenantId,
          ...(email ? { email } : { name, company }),
        },
      });

      if (existing) {
        await this.prisma.lead.update({
          where: { id: existing.id },
          data: {
            name,
            company,
            status,
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
          },
        });
        result.updated += 1;
      } else {
        await this.prisma.lead.create({
          data: {
            tenantId,
            name,
            company,
            email,
            status,
            ...(phone ? { phone } : {}),
          },
        });
        result.created += 1;
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'LEADS_IMPORTED',
      entityType: 'Lead',
      details: `Imported leads from ${sourceLabel || 'a CRM export'}: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
    });

    return result;
  }

  /** Joins first/last columns when the file has no single name column. */
  private resolveName(
    row: Record<string, string>,
    mapping: ColumnMapping,
    nameParts: { first: string; last: string } | null,
  ) {
    if (mapping.name) return this.value(row, mapping.name);
    if (!nameParts) return null;

    return (
      [this.value(row, nameParts.first), this.value(row, nameParts.last)]
        .filter(Boolean)
        .join(' ') || null
    );
  }

  private value(row: Record<string, string>, header?: string) {
    if (!header) return null;
    const raw = row[header];
    return typeof raw === 'string' ? raw.trim() || null : null;
  }

  private assertMappingIsUsable(mapping: ColumnMapping, headers: string[]) {
    const unknownFields = Object.keys(mapping).filter(
      (field) => !IMPORTABLE_FIELDS.includes(field as ImportableField),
    );
    if (unknownFields.length > 0) {
      throw new BadRequestException(
        `Cannot import into unknown lead fields: ${unknownFields.join(', ')}`,
      );
    }

    const missingColumns = Object.entries(mapping)
      .filter(([, header]) => header && !headers.includes(header))
      .map(([field, header]) => `${field} -> "${header}"`);
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `The uploaded file has no column for: ${missingColumns.join(', ')}`,
      );
    }

    // "name" is satisfiable either by a mapped column or by first/last parts.
    const hasName = Boolean(mapping.name) || Boolean(findNameParts(headers));
    const missing = REQUIRED_FIELDS.filter((field) =>
      field === 'name' ? !hasName : !mapping[field],
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Map a column to each required field before importing: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Reads the whole file up front. Rows are capped so a mis-selected file
   * cannot exhaust memory, and duplicate headers are de-duplicated because
   * csv-parser would otherwise let the last column silently win.
   */
  private parseCsv(
    buffer: Buffer,
  ): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, string>[] = [];
      let headers: string[] = [];

      Readable.from(buffer)
        .pipe(
          csv({
            mapHeaders: ({ header }) =>
              header.replace(/^\uFEFF/, '').trim() || null,
          }),
        )
        .on('headers', (parsed: string[]) => {
          headers = this.dedupeHeaders(parsed);
        })
        .on('data', (row: Record<string, string>) => {
          if (rows.length >= MAX_ROWS) return;
          // Skip the blank trailing rows most CRM exports end with.
          if (Object.values(row).some((value) => value?.trim())) rows.push(row);
        })
        .on('end', () => resolve({ headers, rows }))
        .on('error', () =>
          reject(
            new BadRequestException(
              'That file could not be read as CSV. Export it from your CRM as CSV and try again.',
            ),
          ),
        );
    });
  }

  private dedupeHeaders(headers: string[]) {
    const seen = new Set<string>();
    return headers.filter((header) => {
      const key = normalizeHeader(header);
      if (!header || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
