import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyContext } from '../api-keys/api-keys.service';
import { WebhooksService } from '../webhooks/webhooks.service';

const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];

@Injectable()
export class PublicApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly webhooksService: WebhooksService,
  ) {}

  async listClients(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.client.findMany({
      where: { tenantId: apiKey.tenantId },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: this.limit(query.limit),
    });
  }

  async createClient(apiKey: ApiKeyContext, body: any) {
    const name = this.requiredString(body.name, 'name');
    const email = this.requiredString(body.email, 'email');
    const branchId = await this.resolveBranch(apiKey.tenantId, body.branch_id);

    const client = await this.prisma.client.create({
      data: {
        tenantId: apiKey.tenantId,
        branchId,
        name,
        companyName: this.optionalString(body.company_name ?? body.companyName),
        email,
        phone: this.optionalString(body.phone),
      },
    });

    await this.auditEntity(apiKey, 'CLIENT_CREATED', 'Client', client.id, `Client "${client.name}" created through public API`);
    await this.webhooksService.triggerEvent(apiKey.tenantId, 'client.created', { client });
    return client;
  }

  async listSites(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.site.findMany({
      where: { tenantId: apiKey.tenantId },
      select: {
        id: true,
        name: true,
        address: true,
        instructions: true,
        branchId: true,
        clientId: true,
        createdAt: true,
        client: {
          select: { id: true, name: true, companyName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: this.limit(query.limit),
    });
  }

  async createSite(apiKey: ApiKeyContext, body: any) {
    const clientId = this.optionalString(body.client_id ?? body.clientId);
    const branchId = await this.resolveBranch(apiKey.tenantId, body.branch_id);

    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, tenantId: apiKey.tenantId },
        select: { id: true, branchId: true },
      });
      if (!client) throw new NotFoundException('Client not found');
      if (branchId && client.branchId && branchId !== client.branchId) {
        throw new ForbiddenException('Site branch must match client branch');
      }
    }

    const site = await this.prisma.site.create({
      data: {
        tenantId: apiKey.tenantId,
        branchId,
        clientId,
        name: this.requiredString(body.name, 'name'),
        address: this.requiredString(body.address, 'address'),
        instructions: this.optionalString(body.instructions),
      },
    });

    await this.auditEntity(apiKey, 'SITE_CREATED', 'Site', site.id, `Site "${site.name}" created through public API`);
    return site;
  }

  async listGuards(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.guard.findMany({
      where: { tenantId: apiKey.tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        branchId: true,
        createdAt: true,
        availability: true,
      },
      orderBy: { createdAt: 'desc' },
      take: this.limit(query.limit),
    });
  }

  async createGuard(apiKey: ApiKeyContext, body: any) {
    const name = this.requiredString(body.name, 'name');
    const phone = this.optionalString(body.phone);
    const email = this.optionalString(body.email)?.toLowerCase();
    if (!phone && !email) {
      throw new BadRequestException('Guard phone or email is required');
    }

    const guard = await this.prisma.guard.create({
      data: {
        tenantId: apiKey.tenantId,
        branchId: await this.resolveBranch(apiKey.tenantId, body.branch_id),
        name,
        phone,
        email,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        branchId: true,
        createdAt: true,
      },
    });

    await this.auditEntity(apiKey, 'GUARD_CREATED', 'Guard', guard.id, `Guard "${guard.name}" created through public API`);
    await this.webhooksService.triggerEvent(apiKey.tenantId, 'guard.created', { guard });
    return guard;
  }

  async listShifts(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.shift.findMany({
      where: { tenantId: apiKey.tenantId },
      include: {
        site: { select: { id: true, name: true, address: true, clientId: true } },
        assignments: {
          include: {
            guard: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take: this.limit(query.limit),
    });
  }

  async createShift(apiKey: ApiKeyContext, body: any) {
    const siteId = this.requiredString(body.site_id ?? body.siteId, 'site_id');
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId: apiKey.tenantId },
      select: { id: true, name: true, branchId: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    const requiredGuards = Number(body.required_guards ?? body.requiredGuards ?? 1);
    if (!Number.isInteger(requiredGuards) || requiredGuards < 1) {
      throw new BadRequestException('required_guards must be a positive integer');
    }
    const startTime = this.requiredDate(body.start_time ?? body.startTime, 'start_time');
    const endTime = this.requiredDate(body.end_time ?? body.endTime, 'end_time');
    if (endTime <= startTime) {
      throw new BadRequestException('end_time must be after start_time');
    }

    const shift = await this.prisma.shift.create({
      data: {
        tenantId: apiKey.tenantId,
        branchId: site.branchId,
        siteId,
        startTime,
        endTime,
        requiredGuards,
        status: 'open',
      },
      include: {
        site: { select: { id: true, name: true, address: true } },
      },
    });

    await this.auditEntity(apiKey, 'SHIFT_CREATED', 'Shift', shift.id, `Shift created through public API for site "${site.name}"`);
    await this.webhooksService.triggerEvent(apiKey.tenantId, 'shift.created', { shift });
    return shift;
  }

  async assignShift(apiKey: ApiKeyContext, shiftId: string, body: any) {
    const guardId = this.requiredString(body.guard_id ?? body.guardId, 'guard_id');
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: apiKey.tenantId },
      include: { assignments: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.assignments.length > 0) {
      throw new BadRequestException('Shift already has an assignment');
    }

    const guard = await this.prisma.guard.findFirst({
      where: { id: guardId, tenantId: apiKey.tenantId },
      select: { id: true, name: true, branchId: true },
    });
    if (!guard) throw new NotFoundException('Guard not found');
    if (shift.branchId && guard.branchId && shift.branchId !== guard.branchId) {
      throw new ForbiddenException('Guard and shift must belong to the same branch');
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: { shiftId, guardId, status: 'pending' },
      });
      await tx.shift.update({
        where: { id: shiftId },
        data: { status: 'assigned' },
      });
      return created;
    });

    await this.auditEntity(apiKey, 'GUARD_ASSIGNED', 'Shift', shift.id, `Guard "${guard.name}" assigned through public API`);
    await this.webhooksService.triggerEvent(apiKey.tenantId, 'shift.assigned', {
      shift_id: shift.id,
      guard_id: guard.id,
      assignment,
    });
    return assignment;
  }

  async listIncidents(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.incident.findMany({
      where: { tenantId: apiKey.tenantId },
      include: {
        site: { select: { id: true, name: true, address: true } },
        guard: { select: { id: true, name: true, email: true, phone: true } },
        shift: { select: { id: true, startTime: true, endTime: true, status: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: this.limit(query.limit),
    });
  }

  async createIncident(apiKey: ApiKeyContext, body: any) {
    const shiftId = this.requiredString(body.shift_id ?? body.shiftId, 'shift_id');
    const guardId = this.requiredString(body.guard_id ?? body.guardId, 'guard_id');
    const severity = this.requiredString(body.severity, 'severity');
    if (!INCIDENT_SEVERITIES.includes(severity)) {
      throw new BadRequestException('Severity must be low, medium, high, or critical');
    }

    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: apiKey.tenantId },
      select: { id: true, siteId: true, branchId: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');

    const guard = await this.prisma.guard.findFirst({
      where: { id: guardId, tenantId: apiKey.tenantId },
      select: { id: true, name: true },
    });
    if (!guard) throw new NotFoundException('Guard not found');

    const incident = await this.prisma.incident.create({
      data: {
        tenantId: apiKey.tenantId,
        branchId: shift.branchId,
        shiftId,
        siteId: shift.siteId,
        guardId,
        title: this.requiredString(body.title, 'title'),
        description: this.requiredString(body.description, 'description'),
        severity,
        status: 'submitted',
        occurredAt: this.requiredDate(body.occurred_at ?? body.occurredAt, 'occurred_at'),
        attachmentUrl: this.optionalString(body.attachment_url ?? body.attachmentUrl),
        notes: this.optionalString(body.notes),
      },
    });

    await this.auditEntity(apiKey, 'INCIDENT_CREATED', 'Incident', incident.id, `Incident "${incident.title}" submitted through public API`);
    await this.webhooksService.triggerEvent(apiKey.tenantId, 'incident.created', { incident });
    return incident;
  }

  async listInvoices(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.invoice.findMany({
      where: { tenantId: apiKey.tenantId },
      include: {
        client: { select: { id: true, name: true, companyName: true, email: true } },
        site: { select: { id: true, name: true, address: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: this.limit(query.limit),
    });
  }

  async listReports(apiKey: ApiKeyContext, query: Record<string, string | undefined>) {
    return this.prisma.dailyServiceReport.findMany({
      where: { tenantId: apiKey.tenantId },
      include: {
        client: { select: { id: true, name: true, companyName: true, email: true } },
        site: { select: { id: true, name: true, address: true } },
      },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
      take: this.limit(query.limit),
    });
  }

  private async resolveBranch(tenantId: string, branchId?: string | null) {
    const normalized = this.optionalString(branchId);
    if (!normalized) return null;

    const branch = await this.prisma.branch.findFirst({
      where: { id: normalized, tenantId },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException('branch_id must belong to this tenant');
    return branch.id;
  }

  private async auditEntity(
    apiKey: ApiKeyContext,
    action: string,
    entityType: string,
    entityId: string,
    details: string,
  ) {
    await this.auditService.log({
      tenantId: apiKey.tenantId,
      userId: `api_key:${apiKey.id}`,
      action,
      entityType,
      entityId,
      details,
    });
  }

  private limit(value?: string) {
    const parsed = Number(value || 50);
    if (!Number.isFinite(parsed)) return 50;
    return Math.min(Math.max(Math.trunc(parsed), 1), 100);
  }

  private requiredString(value: unknown, fieldName: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private optionalString(value: unknown) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private requiredDate(value: unknown, fieldName: string) {
    const raw = this.requiredString(value, fieldName);
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }
    return date;
  }
}
