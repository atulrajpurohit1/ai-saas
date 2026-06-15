import { BadRequestException, Injectable } from '@nestjs/common';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type ImportTarget = 'leads' | 'deals';

type ImportField =
  | 'name'
  | 'company'
  | 'email'
  | 'status'
  | 'dealName'
  | 'stage'
  | 'propertyType'
  | 'buyerRole'
  | 'currentProvider'
  | 'guardCount'
  | 'serviceHours'
  | 'painPoints'
  | 'riskConcerns'
  | 'decisionTimeline'
  | 'budgetSensitivity'
  | 'objections'
  | 'notes';

type ImportMapping = Partial<Record<ImportField, string>>;
type CsvRow = Record<string, string | undefined>;

const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'contact name', 'full name', 'primary contact', 'contact', 'lead name'],
  company: ['company', 'company name', 'account', 'account name', 'business', 'organization', 'property'],
  email: ['email', 'email address', 'contact email', 'lead email'],
  status: ['status', 'lead status', 'crm status'],
  dealName: ['deal name', 'opportunity', 'opportunity name', 'project', 'pipeline deal'],
  stage: ['stage', 'deal stage', 'pipeline stage', 'opportunity stage'],
  propertyType: ['property type', 'site type', 'segment', 'industry', 'vertical'],
  buyerRole: ['buyer role', 'role', 'title', 'decision maker role', 'contact title'],
  currentProvider: ['current provider', 'incumbent', 'existing provider', 'security provider'],
  guardCount: ['guard count', 'guards', 'number of guards', 'posts', 'post count'],
  serviceHours: ['service hours', 'coverage hours', 'shift hours', 'coverage', 'schedule'],
  painPoints: ['pain points', 'pain', 'problems', 'current issues', 'challenges'],
  riskConcerns: ['risk concerns', 'risks', 'security risks', 'incidents', 'risk drivers'],
  decisionTimeline: ['decision timeline', 'timeline', 'start date', 'decision date', 'urgency'],
  budgetSensitivity: ['budget sensitivity', 'budget', 'price sensitivity', 'pricing concern'],
  objections: ['objections', 'concerns', 'sales objections', 'buyer concerns'],
  notes: ['notes', 'comments', 'description', 'summary', 'call notes'],
};

const IMPORT_FIELDS = Object.keys(FIELD_ALIASES) as ImportField[];

@Injectable()
export class SalesImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async preview(buffer: Buffer) {
    const parsed = await this.parseCsv(buffer, 500);
    const detectedMapping = this.detectMapping(parsed.headers);

    return {
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 8),
      previewRows: parsed.rows.length,
      totalRows: parsed.totalRows,
      detectedMapping,
      requiredFields: {
        leads: ['name', 'company'],
        deals: ['name', 'company', 'dealName'],
      },
    };
  }

  async commit(
    buffer: Buffer,
    body: { target?: string; mapping?: string | ImportMapping },
    tenantId: string,
    userId?: string,
  ) {
    const target = this.normalizeTarget(body.target);
    const mapping = this.normalizeMapping(body.mapping);
    const parsed = await this.parseCsv(buffer, 5000);

    this.validateMapping(target, mapping);

    const summary = {
      target,
      totalRows: parsed.totalRows,
      processedRows: 0,
      skippedRows: Math.max(0, parsed.totalRows - parsed.rows.length),
      leadsCreated: 0,
      leadsUpdated: 0,
      leadsMatched: 0,
      dealsCreated: 0,
      dealsUpdated: 0,
      dealsMatched: 0,
      discoverySessionsCreated: 0,
      errors: [] as Array<{ row: number; message: string }>,
    };

    for (const [index, row] of parsed.rows.entries()) {
      try {
        const leadSync = await this.syncLead(row, mapping, tenantId);
        summary.leadsCreated += leadSync.created ? 1 : 0;
        summary.leadsUpdated += leadSync.updated ? 1 : 0;
        summary.leadsMatched += !leadSync.created ? 1 : 0;

        let dealId: string | undefined;

        if (target === 'deals') {
          const dealSync = await this.syncDeal(row, mapping, tenantId, leadSync.lead.id);
          dealId = dealSync.deal.id;
          summary.dealsCreated += dealSync.created ? 1 : 0;
          summary.dealsUpdated += dealSync.updated ? 1 : 0;
          summary.dealsMatched += !dealSync.created ? 1 : 0;
        }

        if (await this.createDiscoverySession(row, mapping, tenantId, leadSync.lead.id, dealId, userId)) {
          summary.discoverySessionsCreated += 1;
        }

        summary.processedRows += 1;
      } catch (error) {
        summary.errors.push({
          row: index + 2,
          message: error instanceof Error ? error.message : 'Unable to import row',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'IMPORT',
      entityType: 'SALES_IMPORT',
      details: `Imported ${summary.processedRows} ${target} rows from CSV`,
    });

    return summary;
  }

  private async syncLead(row: CsvRow, mapping: ImportMapping, tenantId: string) {
    const name = this.text(row, mapping.name);
    const company = this.text(row, mapping.company);
    const email = this.text(row, mapping.email);
    const status = this.text(row, mapping.status) || 'new';

    if (!name) throw new BadRequestException('Contact name is required');
    if (!company) throw new BadRequestException('Company is required');

    const orFilters = email
      ? [{ email }, { company, name }]
      : [{ company, name }];

    const existing = await this.prisma.lead.findFirst({
      where: { tenantId, OR: orFilters },
    });

    if (!existing) {
      const lead = await this.prisma.lead.create({
        data: {
          name,
          company,
          email,
          status,
          tenantId,
        },
      });

      return { lead, created: true, updated: false };
    }

    const data: { email?: string | null; status?: string } = {};
    if (email && existing.email !== email) data.email = email;
    if (status && existing.status !== status) data.status = status;

    if (Object.keys(data).length === 0) {
      return { lead: existing, created: false, updated: false };
    }

    const lead = await this.prisma.lead.update({
      where: { id: existing.id },
      data,
    });

    return { lead, created: false, updated: true };
  }

  private async syncDeal(
    row: CsvRow,
    mapping: ImportMapping,
    tenantId: string,
    leadId: string,
  ) {
    const company = this.text(row, mapping.company) || 'Imported account';
    const name = this.text(row, mapping.dealName) || `Deal for ${company}`;
    const stage = this.normalizeStage(this.text(row, mapping.stage));

    const existing = await this.prisma.deal.findFirst({
      where: { tenantId, leadId, name },
    });

    if (!existing) {
      const deal = await this.prisma.deal.create({
        data: {
          name,
          stage,
          tenantId,
          leadId,
        },
      });

      return { deal, created: true, updated: false };
    }

    if (existing.stage === stage) {
      return { deal: existing, created: false, updated: false };
    }

    const deal = await this.prisma.deal.update({
      where: { id: existing.id },
      data: { stage },
    });

    return { deal, created: false, updated: true };
  }

  private async createDiscoverySession(
    row: CsvRow,
    mapping: ImportMapping,
    tenantId: string,
    leadId: string,
    dealId?: string,
    userId?: string,
  ) {
    const discovery = {
      propertyType: this.text(row, mapping.propertyType),
      buyerRole: this.text(row, mapping.buyerRole),
      currentProvider: this.text(row, mapping.currentProvider),
      guardCount: this.number(row, mapping.guardCount),
      serviceHours: this.text(row, mapping.serviceHours),
      painPoints: this.list(row, mapping.painPoints),
      riskConcerns: this.list(row, mapping.riskConcerns),
      decisionTimeline: this.text(row, mapping.decisionTimeline),
      budgetSensitivity: this.text(row, mapping.budgetSensitivity),
      objections: this.list(row, mapping.objections),
      notes: this.text(row, mapping.notes),
    };

    const hasDiscoveryData = Object.values(discovery).some((value) =>
      Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined,
    );

    if (!hasDiscoveryData) return false;

    await this.prisma.discoverySession.create({
      data: {
        ...discovery,
        tenantId,
        leadId,
        dealId,
        createdBy: userId,
      },
    });

    return true;
  }

  private parseCsv(buffer: Buffer, maxRows: number) {
    const rows: CsvRow[] = [];
    let headers: string[] = [];
    let totalRows = 0;

    return new Promise<{ headers: string[]; rows: CsvRow[]; totalRows: number }>(
      (resolve, reject) => {
        Readable.from(buffer)
          .pipe(csv())
          .on('headers', (csvHeaders: string[]) => {
            headers = csvHeaders.map((header) => header.trim()).filter(Boolean);
          })
          .on('data', (row: CsvRow) => {
            totalRows += 1;
            if (rows.length < maxRows) rows.push(row);
          })
          .on('end', () => {
            if (headers.length === 0) {
              reject(new BadRequestException('CSV file must include a header row'));
              return;
            }
            resolve({ headers, rows, totalRows });
          })
          .on('error', (error) => reject(error));
      },
    );
  }

  private detectMapping(headers: string[]): ImportMapping {
    const normalizedHeaders = new Map(
      headers.map((header) => [this.normalizeHeader(header), header]),
    );
    const detected: ImportMapping = {};

    for (const field of IMPORT_FIELDS) {
      const match = FIELD_ALIASES[field]
        .map((alias) => this.normalizeHeader(alias))
        .find((alias) => normalizedHeaders.has(alias));

      if (match) detected[field] = normalizedHeaders.get(match);
    }

    return detected;
  }

  private normalizeMapping(input?: string | ImportMapping): ImportMapping {
    if (!input) throw new BadRequestException('Column mapping is required');

    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    const mapping: ImportMapping = {};

    for (const field of IMPORT_FIELDS) {
      const value = parsed[field];
      if (typeof value === 'string' && value.trim()) {
        mapping[field] = value.trim();
      }
    }

    return mapping;
  }

  private validateMapping(target: ImportTarget, mapping: ImportMapping) {
    if (!mapping.name) throw new BadRequestException('Map the contact name column before import');
    if (!mapping.company) throw new BadRequestException('Map the company column before import');
    if (target === 'deals' && !mapping.dealName) {
      throw new BadRequestException('Map the deal name column before importing deals');
    }
  }

  private normalizeTarget(target?: string): ImportTarget {
    if (target === 'leads' || target === 'deals') return target;
    throw new BadRequestException('Import target must be leads or deals');
  }

  private normalizeStage(value?: string | null) {
    const normalized = (value || '').trim().toLowerCase();
    if (['contacted', 'qualified'].includes(normalized)) return 'Contacted';
    if (['proposal', 'proposal sent', 'quoted', 'quote sent'].includes(normalized)) return 'Proposal';
    if (['won', 'closed won', 'closed'].includes(normalized)) return 'Won';
    if (['lost', 'closed lost'].includes(normalized)) return 'Lost';
    return normalized ? value!.trim() : 'New';
  }

  private text(row: CsvRow, header?: string) {
    if (!header) return null;
    const value = row[header];
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || null;
  }

  private number(row: CsvRow, header?: string) {
    const value = this.text(row, header);
    if (!value) return null;
    const numeric = Number.parseInt(value.replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private list(row: CsvRow, header?: string) {
    const value = this.text(row, header);
    if (!value) return [];
    return Array.from(
      new Set(
        value
          .split(/[\n;,|]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).slice(0, 12);
  }

  private normalizeHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
}
