import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchWhere } from '../branches/branch-scope';
import { GUARD_COMPLIANCE_UPLOAD_DIR } from '../common/file-storage.util';
import { CreateGuardComplianceDto } from './dto/create-guard-compliance.dto';
import { UpdateGuardComplianceDto } from './dto/update-guard-compliance.dto';
import { GUARD_COMPLIANCE_TYPES } from './compliance-types.constants';
import {
  ComplianceStatus,
  calculateRecordStatus,
} from './compliance-status.util';

@Injectable()
export class GuardComplianceService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async findGuardOrThrow(user: ActiveUser, guardId: string) {
    const guard = await this.prisma.guard.findFirst({
      where: { id: guardId, tenantId: user.tenantId, ...branchWhere(user) },
    });
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }
    return guard;
  }

  private async findRecordOrThrow(user: ActiveUser, id: string) {
    const record = await this.prisma.guardCompliance.findFirst({
      where: { id, tenantId: user.tenantId, guard: { ...branchWhere(user) } },
      include: { guard: { select: { id: true, name: true } } },
    });
    if (!record) {
      throw new NotFoundException('Compliance record not found');
    }
    return record;
  }

  private assertDateOrder(issueDate: Date | null, expirationDate: Date | null) {
    if (
      issueDate &&
      expirationDate &&
      expirationDate.getTime() < issueDate.getTime()
    ) {
      throw new BadRequestException(
        'Expiration date cannot be before issue date',
      );
    }
  }

  private statusOf(expirationDate: Date | null): ComplianceStatus {
    try {
      return calculateRecordStatus(expirationDate);
    } catch {
      // A malformed stored date must never be presented as VALID.
      return ComplianceStatus.EXPIRED;
    }
  }

  private serialize(
    record: {
      id: string;
      guardId: string;
      type: string;
      documentNumber: string | null;
      issuingAuthority: string | null;
      issueDate: Date | null;
      expirationDate: Date | null;
      notes: string | null;
      fileName: string | null;
      storedFileName: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    guardName: string,
  ) {
    return {
      id: record.id,
      guardId: record.guardId,
      guardName,
      type: record.type,
      status: this.statusOf(record.expirationDate),
      documentNumber: record.documentNumber,
      issuingAuthority: record.issuingAuthority,
      issueDate: record.issueDate,
      expirationDate: record.expirationDate,
      notes: record.notes,
      hasDocument: Boolean(record.storedFileName),
      fileName: record.fileName,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async create(user: ActiveUser, dto: CreateGuardComplianceDto) {
    const guard = await this.findGuardOrThrow(user, dto.guard_id);

    const issueDate = dto.issue_date ? new Date(dto.issue_date) : null;
    const expirationDate = dto.expiration_date
      ? new Date(dto.expiration_date)
      : null;
    this.assertDateOrder(issueDate, expirationDate);

    const record = await this.prisma.guardCompliance.create({
      data: {
        tenantId: user.tenantId,
        guardId: guard.id,
        type: dto.type,
        documentNumber: dto.document_number || null,
        issuingAuthority: dto.issuing_authority || null,
        issueDate,
        expirationDate,
        notes: dto.notes || null,
        createdBy: user.sub,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_COMPLIANCE_CREATED',
      entityType: 'GuardCompliance',
      entityId: record.id,
      details: `Added ${dto.type} compliance record for guard "${guard.name}"`,
    });

    return this.serialize(record, guard.name);
  }

  async update(user: ActiveUser, id: string, dto: UpdateGuardComplianceDto) {
    const record = await this.findRecordOrThrow(user, id);

    const nextIssue =
      dto.issue_date !== undefined
        ? dto.issue_date
          ? new Date(dto.issue_date)
          : null
        : record.issueDate;
    const nextExpiration =
      dto.expiration_date !== undefined
        ? dto.expiration_date
          ? new Date(dto.expiration_date)
          : null
        : record.expirationDate;
    this.assertDateOrder(nextIssue, nextExpiration);

    const updated = await this.prisma.guardCompliance.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.document_number !== undefined
          ? { documentNumber: dto.document_number || null }
          : {}),
        ...(dto.issuing_authority !== undefined
          ? { issuingAuthority: dto.issuing_authority || null }
          : {}),
        ...(dto.issue_date !== undefined ? { issueDate: nextIssue } : {}),
        ...(dto.expiration_date !== undefined
          ? { expirationDate: nextExpiration }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_COMPLIANCE_UPDATED',
      entityType: 'GuardCompliance',
      entityId: record.id,
      details: `Updated compliance record for guard "${record.guard.name}"`,
    });

    return this.serialize(updated, record.guard.name);
  }

  async remove(user: ActiveUser, id: string) {
    const record = await this.findRecordOrThrow(user, id);

    if (record.storedFileName) {
      const filePath = join(GUARD_COMPLIANCE_UPLOAD_DIR, record.storedFileName);
      if (existsSync(filePath)) unlinkSync(filePath);
    }

    await this.prisma.guardCompliance.delete({ where: { id } });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_COMPLIANCE_DELETED',
      entityType: 'GuardCompliance',
      entityId: id,
      details: `Removed ${record.type} compliance record for guard "${record.guard.name}"`,
    });

    return { success: true };
  }

  // Combines existing records (with computed status) with synthesized
  // MISSING entries for every guard×type combination that has no record at
  // all, for every tracked compliance type - this is what makes "who is
  // missing their firearm permit" answerable, not just "list what exists."
  async findAllForTenant(user: ActiveUser, guardId?: string) {
    const guards = await this.prisma.guard.findMany({
      where: {
        tenantId: user.tenantId,
        ...branchWhere(user),
        ...(guardId ? { id: guardId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const guardIds = guards.map((g) => g.id);
    if (guardIds.length === 0) return [];

    const records = await this.prisma.guardCompliance.findMany({
      where: { tenantId: user.tenantId, guardId: { in: guardIds } },
      orderBy: { createdAt: 'desc' },
    });

    const guardNameById = new Map(guards.map((g) => [g.id, g.name]));
    const seenGuardType = new Set<string>();
    const results = records.map((record) => {
      seenGuardType.add(`${record.guardId}:${record.type}`);
      return this.serialize(
        record,
        guardNameById.get(record.guardId) || 'Unknown Guard',
      );
    });

    for (const guard of guards) {
      for (const type of GUARD_COMPLIANCE_TYPES) {
        if (!seenGuardType.has(`${guard.id}:${type}`)) {
          results.push({
            id: null as unknown as string,
            guardId: guard.id,
            guardName: guard.name,
            type,
            status: ComplianceStatus.MISSING,
            documentNumber: null,
            issuingAuthority: null,
            issueDate: null,
            expirationDate: null,
            notes: null,
            hasDocument: false,
            fileName: null,
            createdAt: null as unknown as Date,
            updatedAt: null as unknown as Date,
          });
        }
      }
    }

    return results;
  }

  async attachDocument(
    user: ActiveUser,
    id: string,
    file: Express.Multer.File,
  ) {
    const record = await this.findRecordOrThrow(user, id);

    if (record.storedFileName) {
      const oldPath = join(GUARD_COMPLIANCE_UPLOAD_DIR, record.storedFileName);
      if (existsSync(oldPath)) unlinkSync(oldPath);
    }

    const updated = await this.prisma.guardCompliance.update({
      where: { id },
      data: { fileName: file.originalname, storedFileName: file.filename },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_COMPLIANCE_DOCUMENT_UPLOADED',
      entityType: 'GuardCompliance',
      entityId: record.id,
      details: `Uploaded document for ${record.type} compliance record - guard "${record.guard.name}"`,
    });

    return this.serialize(updated, record.guard.name);
  }

  async getDocumentForDownload(user: ActiveUser, id: string) {
    const record = await this.findRecordOrThrow(user, id);
    if (!record.storedFileName) {
      throw new NotFoundException('No document uploaded for this record');
    }

    const filePath = join(GUARD_COMPLIANCE_UPLOAD_DIR, record.storedFileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on server');
    }

    return {
      stream: createReadStream(filePath),
      filename: record.fileName || record.storedFileName,
    };
  }
}
