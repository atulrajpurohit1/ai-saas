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
import {
  CLIENT_INSURANCE_UPLOAD_DIR,
  clientInsuranceUploadMaxBytes,
  clientInsuranceUploadMaxMb,
  isAllowedClientInsuranceDocument,
} from '../common/file-storage.util';
import {
  ComplianceStatus,
  calculateRecordStatus,
} from '../guard-compliance/compliance-status.util';
import {
  CLIENT_INSURANCE_REQUIRED_TYPES,
  CLIENT_INSURANCE_TYPES,
} from './client-insurance-types.constants';
import { CreateClientInsurancePolicyDto } from './dto/create-client-insurance-policy.dto';
import { UpdateClientInsurancePolicyDto } from './dto/update-client-insurance-policy.dto';

type PolicyRecord = {
  id: string;
  clientId: string;
  siteId: string | null;
  type: string;
  policyNumber: string | null;
  insurer: string | null;
  coverageAmount: number | null;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  notes: string | null;
  fileName: string | null;
  storedFileName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface ClientComplianceFilters {
  clientId?: string;
  siteId?: string;
  status?: string;
  type?: string;
}

@Injectable()
export class ClientComplianceService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // --- scoping helpers -----------------------------------------------------

  // Resolves a client the caller is actually allowed to see, using the exact
  // same tenant + branch scoping as every other admin client read. A
  // cross-tenant or out-of-branch id simply does not match.
  private async findClientInScopeOrThrow(user: ActiveUser, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId, ...branchWhere(user) },
      select: { id: true, name: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  // A site_id supplied for a policy must belong to the SAME client, same
  // tenant, and be within the caller's branch scope - otherwise a caller
  // could tie a policy to another client's / tenant's site.
  private async assertSiteBelongsToClient(
    user: ActiveUser,
    clientId: string,
    siteId: string,
  ) {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        tenantId: user.tenantId,
        clientId,
        ...branchWhere(user),
      },
      select: { id: true },
    });
    if (!site) {
      throw new BadRequestException(
        'Selected site does not belong to this client',
      );
    }
  }

  private async findRecordInScopeOrThrow(user: ActiveUser, id: string) {
    const record = await this.prisma.clientInsurancePolicy.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        client: { ...branchWhere(user) },
      },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!record) {
      throw new NotFoundException('Insurance policy not found');
    }
    return record;
  }

  // --- serialization -----------------------------------------------------

  private statusOf(expirationDate: Date | null): ComplianceStatus {
    try {
      return calculateRecordStatus(expirationDate);
    } catch {
      // A malformed stored date must never be presented as VALID.
      return ComplianceStatus.EXPIRED;
    }
  }

  private assertDateOrder(
    effectiveDate: Date | null,
    expirationDate: Date | null,
  ) {
    if (
      effectiveDate &&
      expirationDate &&
      expirationDate.getTime() < effectiveDate.getTime()
    ) {
      throw new BadRequestException(
        'Expiration date cannot be before the effective date',
      );
    }
  }

  private serialize(record: PolicyRecord, clientName: string, siteName?: string | null) {
    // storedFileName is deliberately never included - it is an internal
    // on-disk path fragment and exposing it would enable enumeration.
    return {
      id: record.id,
      clientId: record.clientId,
      clientName,
      siteId: record.siteId,
      siteName: siteName ?? null,
      scope: record.siteId ? ('site' as const) : ('client_wide' as const),
      type: record.type,
      status: this.statusOf(record.expirationDate),
      policyNumber: record.policyNumber,
      insurer: record.insurer,
      coverageAmount: record.coverageAmount,
      effectiveDate: record.effectiveDate,
      expirationDate: record.expirationDate,
      notes: record.notes,
      hasDocument: Boolean(record.storedFileName),
      fileName: record.fileName,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private unlinkQuietly(storedFileName: string) {
    try {
      const filePath = join(CLIENT_INSURANCE_UPLOAD_DIR, storedFileName);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // Best-effort cleanup - a missing file must not block the DB operation.
    }
  }

  // --- admin: mutations -------------------------------------------------

  async create(user: ActiveUser, dto: CreateClientInsurancePolicyDto) {
    const client = await this.findClientInScopeOrThrow(user, dto.client_id);

    const siteId = dto.site_id?.trim() || null;
    if (siteId) {
      await this.assertSiteBelongsToClient(user, client.id, siteId);
    }

    const effectiveDate = dto.effective_date
      ? new Date(dto.effective_date)
      : null;
    const expirationDate = dto.expiration_date
      ? new Date(dto.expiration_date)
      : null;
    this.assertDateOrder(effectiveDate, expirationDate);

    const record = await this.prisma.clientInsurancePolicy.create({
      data: {
        tenantId: user.tenantId,
        clientId: client.id,
        siteId,
        type: dto.type,
        policyNumber: dto.policy_number?.trim() || null,
        insurer: dto.insurer?.trim() || null,
        coverageAmount:
          typeof dto.coverage_amount === 'number' ? dto.coverage_amount : null,
        effectiveDate,
        expirationDate,
        notes: dto.notes?.trim() || null,
        createdBy: user.sub,
      },
      include: { site: { select: { name: true } } },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CLIENT_INSURANCE_POLICY_CREATED',
      entityType: 'ClientInsurancePolicy',
      entityId: record.id,
      details: `Added ${dto.type} insurance policy for client "${client.name}"`,
    });

    return this.serialize(record, client.name, record.site?.name);
  }

  async update(
    user: ActiveUser,
    id: string,
    dto: UpdateClientInsurancePolicyDto,
  ) {
    const record = await this.findRecordInScopeOrThrow(user, id);

    let nextSiteId = record.siteId;
    if (dto.site_id !== undefined) {
      nextSiteId = dto.site_id?.trim() || null;
      if (nextSiteId) {
        await this.assertSiteBelongsToClient(
          user,
          record.clientId,
          nextSiteId,
        );
      }
    }

    const nextEffective =
      dto.effective_date !== undefined
        ? dto.effective_date
          ? new Date(dto.effective_date)
          : null
        : record.effectiveDate;
    const nextExpiration =
      dto.expiration_date !== undefined
        ? dto.expiration_date
          ? new Date(dto.expiration_date)
          : null
        : record.expirationDate;
    this.assertDateOrder(nextEffective, nextExpiration);

    const updated = await this.prisma.clientInsurancePolicy.update({
      where: { id },
      data: {
        ...(dto.site_id !== undefined ? { siteId: nextSiteId } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.policy_number !== undefined
          ? { policyNumber: dto.policy_number?.trim() || null }
          : {}),
        ...(dto.insurer !== undefined
          ? { insurer: dto.insurer?.trim() || null }
          : {}),
        ...(dto.coverage_amount !== undefined
          ? {
              coverageAmount:
                typeof dto.coverage_amount === 'number'
                  ? dto.coverage_amount
                  : null,
            }
          : {}),
        ...(dto.effective_date !== undefined
          ? { effectiveDate: nextEffective }
          : {}),
        ...(dto.expiration_date !== undefined
          ? { expirationDate: nextExpiration }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
      },
      include: { site: { select: { name: true } } },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CLIENT_INSURANCE_POLICY_UPDATED',
      entityType: 'ClientInsurancePolicy',
      entityId: record.id,
      details: `Updated insurance policy for client "${record.client.name}"`,
    });

    return this.serialize(updated, record.client.name, updated.site?.name);
  }

  async remove(user: ActiveUser, id: string) {
    const record = await this.findRecordInScopeOrThrow(user, id);

    if (record.storedFileName) {
      this.unlinkQuietly(record.storedFileName);
    }

    await this.prisma.clientInsurancePolicy.delete({ where: { id } });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CLIENT_INSURANCE_POLICY_DELETED',
      entityType: 'ClientInsurancePolicy',
      entityId: id,
      details: `Removed ${record.type} insurance policy for client "${record.client.name}"`,
    });

    return { success: true };
  }

  async attachDocument(
    user: ActiveUser,
    id: string,
    file: Express.Multer.File,
  ) {
    const record = await this.findRecordInScopeOrThrow(user, id);

    if (!isAllowedClientInsuranceDocument(file.originalname, file.mimetype)) {
      this.unlinkQuietly(file.filename);
      throw new BadRequestException(
        'Unsupported file. Only PDF, JPG, PNG, or WEBP insurance documents are allowed.',
      );
    }

    if (file.size > clientInsuranceUploadMaxBytes()) {
      this.unlinkQuietly(file.filename);
      throw new BadRequestException(
        `Insurance document must be ${clientInsuranceUploadMaxMb()} MB or smaller.`,
      );
    }

    if (record.storedFileName) {
      this.unlinkQuietly(record.storedFileName);
    }

    const updated = await this.prisma.clientInsurancePolicy.update({
      where: { id },
      data: { fileName: file.originalname, storedFileName: file.filename },
      include: { site: { select: { name: true } } },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CLIENT_INSURANCE_DOCUMENT_UPLOADED',
      entityType: 'ClientInsurancePolicy',
      entityId: record.id,
      details: `Uploaded document for ${record.type} insurance policy - client "${record.client.name}"`,
    });

    return this.serialize(updated, record.client.name, updated.site?.name);
  }

  // --- admin: reads ----------------------------------------------------

  // Real policies (with computed status) + synthesized MISSING rows for every
  // (client x required-type) with no policy at all - this is what makes "which
  // client has no COI on file" answerable. Mirrors
  // GuardComplianceService.findAllForTenant.
  async findAll(user: ActiveUser, filters: ClientComplianceFilters = {}) {
    const clients = await this.prisma.client.findMany({
      where: {
        tenantId: user.tenantId,
        ...branchWhere(user),
        ...(filters.clientId ? { id: filters.clientId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) return [];

    const policies = await this.prisma.clientInsurancePolicy.findMany({
      where: {
        tenantId: user.tenantId,
        clientId: { in: clientIds },
        ...(filters.siteId ? { siteId: filters.siteId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: { site: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
    const seenClientType = new Set<string>();

    const results: ReturnType<typeof this.serialize>[] = policies.map(
      (policy) => {
        seenClientType.add(`${policy.clientId}:${policy.type}`);
        return this.serialize(
          policy,
          clientNameById.get(policy.clientId) || 'Unknown Client',
          policy.site?.name,
        );
      },
    );

    // Synthesized MISSING rows are only meaningful for the unfiltered /
    // client-filtered view - not when the caller has narrowed to a site or a
    // single non-required type.
    if (!filters.siteId && !filters.type) {
      for (const client of clients) {
        for (const type of CLIENT_INSURANCE_REQUIRED_TYPES) {
          if (!seenClientType.has(`${client.id}:${type}`)) {
            results.push({
              id: null as unknown as string,
              clientId: client.id,
              clientName: client.name,
              siteId: null,
              siteName: null,
              scope: 'client_wide',
              type,
              status: ComplianceStatus.MISSING,
              policyNumber: null,
              insurer: null,
              coverageAmount: null,
              effectiveDate: null,
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
    }

    const statusFilter = filters.status?.trim().toUpperCase();
    if (
      statusFilter &&
      (Object.values(ComplianceStatus) as string[]).includes(statusFilter)
    ) {
      return results.filter((r) => r.status === statusFilter);
    }

    return results;
  }

  async getSummary(user: ActiveUser, clientId?: string) {
    const rows = await this.findAll(
      user,
      clientId ? { clientId } : {},
    );
    const summary = {
      total: rows.length,
      valid: 0,
      expiringSoon: 0,
      expired: 0,
      missing: 0,
    };
    for (const row of rows) {
      if (row.status === ComplianceStatus.VALID) summary.valid += 1;
      else if (row.status === ComplianceStatus.EXPIRING_SOON)
        summary.expiringSoon += 1;
      else if (row.status === ComplianceStatus.EXPIRED) summary.expired += 1;
      else if (row.status === ComplianceStatus.MISSING) summary.missing += 1;
    }
    return summary;
  }

  async getDocumentForDownload(user: ActiveUser, id: string) {
    const record = await this.findRecordInScopeOrThrow(user, id);
    return this.resolveDocumentFile(record.storedFileName, record.fileName);
  }

  // --- client portal: read-only, own policies only --------------------

  async findAllForClient(tenantId: string, clientId: string, userId: string) {
    const [client, policies] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: clientId, tenantId },
        select: { name: true },
      }),
      this.prisma.clientInsurancePolicy.findMany({
        where: { tenantId, clientId },
        include: { site: { select: { id: true, name: true } } },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_INSURANCE_LIST_VIEWED',
      entityType: 'ClientInsurancePolicy',
      details: 'Client viewed their insurance policy list',
    });

    return policies.map((policy) =>
      this.serialize(policy, client?.name || '', policy.site?.name),
    );
  }

  async getDocumentForClient(
    tenantId: string,
    clientId: string,
    policyId: string,
  ) {
    const record = await this.prisma.clientInsurancePolicy.findFirst({
      where: { id: policyId, tenantId, clientId },
      select: { storedFileName: true, fileName: true },
    });
    if (!record) {
      throw new NotFoundException('Insurance policy not found');
    }
    return this.resolveDocumentFile(record.storedFileName, record.fileName);
  }

  private resolveDocumentFile(
    storedFileName: string | null,
    fileName: string | null,
  ) {
    if (!storedFileName) {
      throw new NotFoundException('No document uploaded for this policy');
    }
    const filePath = join(CLIENT_INSURANCE_UPLOAD_DIR, storedFileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Document file not found on server');
    }
    return {
      stream: createReadStream(filePath),
      filename: fileName || storedFileName,
    };
  }

  // Exposed for tests / callers that need the tracked type list.
  static readonly TYPES = CLIENT_INSURANCE_TYPES;
}
