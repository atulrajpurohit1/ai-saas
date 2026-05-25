import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, INCIDENT_SEVERITIES } from './dto/create-incident.dto';

type IncidentStatus = 'submitted' | 'reviewed' | 'rejected';

type IncidentRow = {
  id: string;
  tenantId: string;
  shiftId: string;
  siteId: string;
  guardId: string;
  title: string;
  description: string;
  severity: string;
  status: IncidentStatus;
  occurredAt: Date;
  attachmentUrl: string | null;
  notes: string | null;
  createdAt: Date;
  siteName: string;
  siteAddress: string;
  guardName: string;
  guardEmail: string | null;
  guardPhone: string | null;
  shiftStartTime: Date;
  shiftEndTime: Date;
};

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private mapIncident(row: IncidentRow) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      shiftId: row.shiftId,
      siteId: row.siteId,
      guardId: row.guardId,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      occurredAt: row.occurredAt,
      attachmentUrl: row.attachmentUrl,
      notes: row.notes,
      createdAt: row.createdAt,
      site: {
        id: row.siteId,
        name: row.siteName,
        address: row.siteAddress,
      },
      guard: {
        id: row.guardId,
        name: row.guardName,
        email: row.guardEmail,
        phone: row.guardPhone,
      },
      shift: {
        id: row.shiftId,
        startTime: row.shiftStartTime,
        endTime: row.shiftEndTime,
      },
    };
  }

  private incidentSelectSql(whereSql: Prisma.Sql) {
    return Prisma.sql`
      SELECT
        i."id",
        i."tenant_id" AS "tenantId",
        i."shift_id" AS "shiftId",
        i."site_id" AS "siteId",
        i."guard_id" AS "guardId",
        i."title",
        i."description",
        i."severity",
        i."status",
        i."occurred_at" AS "occurredAt",
        i."attachment_url" AS "attachmentUrl",
        i."notes",
        i."created_at" AS "createdAt",
        s."name" AS "siteName",
        s."address" AS "siteAddress",
        g."name" AS "guardName",
        g."email" AS "guardEmail",
        g."phone" AS "guardPhone",
        sh."startTime" AS "shiftStartTime",
        sh."endTime" AS "shiftEndTime"
      FROM "Incident" i
      INNER JOIN "Site" s ON s."id" = i."site_id"
      INNER JOIN "Guard" g ON g."id" = i."guard_id"
      INNER JOIN "Shift" sh ON sh."id" = i."shift_id"
      ${whereSql}
      ORDER BY i."occurred_at" DESC, i."created_at" DESC
    `;
  }

  private validateCreateDto(dto: CreateIncidentDto) {
    const title = dto.title?.trim();
    const description = dto.description?.trim();
    const severity = dto.severity;
    const occurredAt = new Date(dto.occurred_at);
    const attachmentUrl = dto.attachment_url?.trim() || null;
    const notes = dto.notes?.trim() || null;

    if (!title || !description || !severity || !dto.occurred_at) {
      throw new BadRequestException('Title, description, severity, and occurred_at are required');
    }

    if (!INCIDENT_SEVERITIES.includes(severity)) {
      throw new BadRequestException('Severity must be low, medium, high, or critical');
    }

    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('occurred_at must be a valid date');
    }

    return {
      title,
      description,
      severity,
      occurredAt,
      attachmentUrl,
      notes,
    };
  }

  async createForGuard(
    tenantId: string,
    guardId: string,
    shiftId: string,
    dto: CreateIncidentDto,
  ) {
    const input = this.validateCreateDto(dto);

    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId },
      include: {
        site: true,
        assignments: {
          where: { guardId },
          include: { guard: true },
        },
        attendanceEvents: {
          where: { guardId, tenantId },
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const assignment = shift.assignments[0];
    if (!assignment) {
      throw new ForbiddenException('Shift is not assigned to this guard');
    }

    const hasCheckedIn =
      shift.status === 'in_progress' ||
      shift.attendanceEvents.some((event) => event.type === 'CHECK_IN');

    if (!hasCheckedIn) {
      throw new BadRequestException('Guard must check in before reporting an incident');
    }

    const incidentId = randomUUID();

    const rows = await this.prisma.$queryRaw<IncidentRow[]>(Prisma.sql`
      INSERT INTO "Incident" (
        "id",
        "tenant_id",
        "shift_id",
        "site_id",
        "guard_id",
        "title",
        "description",
        "severity",
        "status",
        "occurred_at",
        "attachment_url",
        "notes"
      )
      VALUES (
        ${incidentId},
        ${tenantId},
        ${shift.id},
        ${shift.siteId},
        ${guardId},
        ${input.title},
        ${input.description},
        ${input.severity},
        'submitted',
        ${input.occurredAt},
        ${input.attachmentUrl},
        ${input.notes}
      )
      RETURNING
        "id",
        "tenant_id" AS "tenantId",
        "shift_id" AS "shiftId",
        "site_id" AS "siteId",
        "guard_id" AS "guardId",
        "title",
        "description",
        "severity",
        "status",
        "occurred_at" AS "occurredAt",
        "attachment_url" AS "attachmentUrl",
        "notes",
        "created_at" AS "createdAt",
        ${shift.site.name} AS "siteName",
        ${shift.site.address} AS "siteAddress",
        ${assignment.guard.name} AS "guardName",
        ${assignment.guard.email} AS "guardEmail",
        ${assignment.guard.phone} AS "guardPhone",
        ${shift.startTime}::timestamp AS "shiftStartTime",
        ${shift.endTime}::timestamp AS "shiftEndTime"
    `);

    const incident = rows[0];

    await this.auditService.log({
      tenantId,
      userId: guardId,
      action: 'INCIDENT_CREATED',
      entityType: 'Incident',
      entityId: incident.id,
      details: `Guard "${assignment.guard.name}" submitted incident "${incident.title}"`,
    });

    return this.mapIncident(incident);
  }

  async findForGuard(tenantId: string, guardId: string) {
    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(Prisma.sql`WHERE i."tenant_id" = ${tenantId} AND i."guard_id" = ${guardId}`),
    );

    return rows.map((row) => this.mapIncident(row));
  }

  async findAllForAdmin(tenantId: string) {
    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(Prisma.sql`WHERE i."tenant_id" = ${tenantId}`),
    );

    return rows.map((row) => this.mapIncident(row));
  }

  async findOneForAdmin(tenantId: string, incidentId: string, userId: string) {
    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(
        Prisma.sql`WHERE i."tenant_id" = ${tenantId} AND i."id" = ${incidentId}`,
      ),
    );

    const incident = rows[0];
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'INCIDENT_VIEWED',
      entityType: 'Incident',
      entityId: incident.id,
      details: `Admin viewed incident "${incident.title}"`,
    });

    return this.mapIncident(incident);
  }
}
