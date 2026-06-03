import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { KnowledgeRetrievalService } from '../knowledge-base/knowledge-retrieval.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, INCIDENT_SEVERITIES } from './dto/create-incident.dto';
import { IncidentReviewStatus, INCIDENT_REVIEW_STATUSES, ReviewIncidentDto } from './dto/review-incident.dto';

type IncidentStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

type IncidentRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  branchName: string | null;
  branchLocation: string | null;
  branchStatus: string | null;
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
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedByEmail: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  siteName: string;
  siteAddress: string;
  guardName: string;
  guardEmail: string | null;
  guardPhone: string | null;
  shiftStartTime: Date;
  shiftEndTime: Date;
};

type ClientIncidentRow = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: 'approved';
  occurredAt: Date;
  attachmentUrl: string | null;
  reviewedAt: Date | null;
  siteId: string;
  siteName: string;
  siteAddress: string;
};

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private knowledgeBaseService: KnowledgeBaseService,
    private knowledgeRetrievalService: KnowledgeRetrievalService,
  ) {}

  private mapIncident(row: IncidentRow) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      branch: row.branchId
        ? {
            id: row.branchId,
            name: row.branchName,
            location: row.branchLocation,
            status: row.branchStatus,
          }
        : null,
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
      submittedAt: row.createdAt,
      reviewedById: row.reviewedById,
      reviewedBy: row.reviewedById
        ? {
            id: row.reviewedById,
            name: row.reviewedByName,
            email: row.reviewedByEmail,
          }
        : null,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
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

  private mapClientIncident(row: ClientIncidentRow) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      occurredAt: row.occurredAt,
      attachmentUrl: row.attachmentUrl,
      reviewedAt: row.reviewedAt,
      site: {
        id: row.siteId,
        name: row.siteName,
        address: row.siteAddress,
      },
    };
  }

  private mapClientIncidentListItem(row: ClientIncidentRow) {
    return {
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      occurredAt: row.occurredAt,
      site: {
        id: row.siteId,
        name: row.siteName,
      },
    };
  }

  private incidentSelectSql(whereSql: Prisma.Sql) {
    return Prisma.sql`
      SELECT
        i."id",
        i."tenant_id" AS "tenantId",
        i."branch_id" AS "branchId",
        b."name" AS "branchName",
        b."location" AS "branchLocation",
        b."status" AS "branchStatus",
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
        i."reviewed_by" AS "reviewedById",
        reviewer."name" AS "reviewedByName",
        reviewer."email" AS "reviewedByEmail",
        i."reviewed_at" AS "reviewedAt",
        i."review_note" AS "reviewNote",
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
      LEFT JOIN "Branch" b ON b."id" = i."branch_id"
      LEFT JOIN "User" reviewer ON reviewer."id" = i."reviewed_by"
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

  private validateReviewStatus(status: string): IncidentReviewStatus {
    if (!INCIDENT_REVIEW_STATUSES.includes(status as IncidentReviewStatus)) {
      throw new BadRequestException('Review status must be approved or rejected');
    }

    return status as IncidentReviewStatus;
  }

  private adminBranchSql(user: ActiveUser, requestedBranchId?: string | null) {
    if (user.isSuperAdmin) {
      return requestedBranchId
        ? Prisma.sql`AND i."branch_id" = ${requestedBranchId}`
        : Prisma.empty;
    }

    if (!user.branchId) {
      return Prisma.sql`AND i."branch_id" IS NULL`;
    }

    return Prisma.sql`AND (i."branch_id" = ${user.branchId} OR i."branch_id" IS NULL)`;
  }

  private async moveSubmittedIncidentToReview(
    tenantId: string,
    userId: string,
    incident: IncidentRow,
  ) {
    if (incident.status !== 'submitted') {
      return false;
    }

    const updatedCount = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Incident"
      SET "status" = 'under_review'
      WHERE "id" = ${incident.id}
        AND "tenant_id" = ${tenantId}
        AND "status" = 'submitted'
    `);

    if (updatedCount > 0) {
      await this.auditService.log({
        tenantId,
        userId,
        action: 'INCIDENT_UNDER_REVIEW',
        entityType: 'Incident',
        entityId: incident.id,
        details: `Incident "${incident.title}" moved to review`,
      });
    }

    return updatedCount > 0;
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
        "branch_id",
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
        ${shift.branchId},
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
        "branch_id" AS "branchId",
        NULL AS "branchName",
        NULL AS "branchLocation",
        NULL AS "branchStatus",
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
        NULL AS "reviewedById",
        NULL AS "reviewedByName",
        NULL AS "reviewedByEmail",
        NULL::timestamp AS "reviewedAt",
        NULL AS "reviewNote",
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

  async findAllForAdmin(user: ActiveUser, requestedBranchId?: string | null) {
    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(
        Prisma.sql`WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user, requestedBranchId)}`,
      ),
    );

    return rows.map((row) => this.mapIncident(row));
  }

  async findReviewQueueForAdmin(user: ActiveUser, requestedBranchId?: string | null) {
    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(
        Prisma.sql`WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user, requestedBranchId)} AND i."status" IN ('submitted', 'under_review')`,
      ),
    );

    return rows.map((row) => this.mapIncident(row));
  }

  async findOneForAdmin(user: ActiveUser, incidentId: string) {
    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(
        Prisma.sql`WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user)} AND i."id" = ${incidentId}`,
      ),
    );

    let incident = rows[0];
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const movedToReview = await this.moveSubmittedIncidentToReview(user.tenantId, user.sub, incident);
    if (movedToReview) {
      const updatedRows = await this.prisma.$queryRaw<IncidentRow[]>(
        this.incidentSelectSql(
          Prisma.sql`WHERE i."tenant_id" = ${user.tenantId} AND i."id" = ${incidentId}`,
        ),
      );
      incident = updatedRows[0] ?? incident;
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'INCIDENT_VIEWED',
      entityType: 'Incident',
      entityId: incident.id,
      details: `Admin viewed incident "${incident.title}"`,
    });

    const mapped = this.mapIncident(incident);
    const similarHistoricalCases = await this.knowledgeRetrievalService.retrieveRelevant({
      tenantId: user.tenantId,
      userId: user.sub,
      sourceModule: 'incidents.similar_cases',
      query: `${mapped.title} ${mapped.description} ${mapped.severity} ${mapped.site.name}`,
      categories: ['incidents'],
      excludeSourceId: incident.id,
      limit: 5,
    });

    return {
      ...mapped,
      similarHistoricalCases,
    };
  }

  async reviewIncident(user: ActiveUser, incidentId: string, dto: ReviewIncidentDto) {
    const status = this.validateReviewStatus(dto.status);
    const reviewNote = dto.review_note?.trim() || null;

    const rows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(
        Prisma.sql`WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user)} AND i."id" = ${incidentId}`,
      ),
    );

    const incident = rows[0];
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (incident.status === 'approved' || incident.status === 'rejected') {
      throw new BadRequestException('Incident has already been reviewed');
    }

    if (incident.status !== 'submitted' && incident.status !== 'under_review') {
      throw new BadRequestException('Incident cannot be reviewed from its current status');
    }

    await this.moveSubmittedIncidentToReview(user.tenantId, user.sub, incident);

    const reviewedAt = new Date();
    const updatedCount = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Incident"
      SET
        "status" = ${status},
        "reviewed_by" = ${user.sub},
        "reviewed_at" = ${reviewedAt},
        "review_note" = ${reviewNote}
      WHERE "id" = ${incidentId}
        AND "tenant_id" = ${user.tenantId}
        AND "status" IN ('submitted', 'under_review')
    `);

    if (updatedCount === 0) {
      throw new BadRequestException('Incident has already been reviewed');
    }

    const updatedRows = await this.prisma.$queryRaw<IncidentRow[]>(
      this.incidentSelectSql(
        Prisma.sql`WHERE i."tenant_id" = ${user.tenantId} AND i."id" = ${incidentId}`,
      ),
    );
    const reviewedIncident = updatedRows[0];

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: status === 'approved' ? 'INCIDENT_APPROVED' : 'INCIDENT_REJECTED',
      entityType: 'Incident',
      entityId: reviewedIncident.id,
      details: `Incident "${reviewedIncident.title}" ${status}`,
    });

    if (status === 'approved') {
      await this.knowledgeBaseService.createFromIncident(
        user.tenantId,
        user.sub,
        this.mapIncident(reviewedIncident),
      );
    }

    return this.mapIncident(reviewedIncident);
  }

  async findApprovedForClient(tenantId: string, clientId: string, userId: string) {
    const rows = await this.prisma.$queryRaw<ClientIncidentRow[]>(Prisma.sql`
      SELECT
        i."id",
        i."title",
        i."description",
        i."severity",
        i."status",
        i."occurred_at" AS "occurredAt",
        i."attachment_url" AS "attachmentUrl",
        i."reviewed_at" AS "reviewedAt",
        s."id" AS "siteId",
        s."name" AS "siteName",
        s."address" AS "siteAddress"
      FROM "Incident" i
      INNER JOIN "Site" s ON s."id" = i."site_id"
      WHERE i."tenant_id" = ${tenantId}
        AND i."status" = 'approved'
        AND s."client_id" = ${clientId}
      ORDER BY i."occurred_at" DESC, i."created_at" DESC
    `);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_INCIDENT_LIST_VIEWED',
      entityType: 'Incident',
      details: 'Client viewed approved incident list',
    });

    return rows.map((row) => this.mapClientIncidentListItem(row));
  }

  async findApprovedDetailForClient(
    tenantId: string,
    clientId: string,
    userId: string,
    incidentId: string,
  ) {
    const rows = await this.prisma.$queryRaw<ClientIncidentRow[]>(Prisma.sql`
      SELECT
        i."id",
        i."title",
        i."description",
        i."severity",
        i."status",
        i."occurred_at" AS "occurredAt",
        i."attachment_url" AS "attachmentUrl",
        i."reviewed_at" AS "reviewedAt",
        s."id" AS "siteId",
        s."name" AS "siteName",
        s."address" AS "siteAddress"
      FROM "Incident" i
      INNER JOIN "Site" s ON s."id" = i."site_id"
      WHERE i."tenant_id" = ${tenantId}
        AND i."id" = ${incidentId}
        AND i."status" = 'approved'
        AND s."client_id" = ${clientId}
      LIMIT 1
    `);

    const incident = rows[0];
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CLIENT_INCIDENT_DETAIL_VIEWED',
      entityType: 'Incident',
      entityId: incident.id,
      details: `Client viewed incident "${incident.title}"`,
    });

    return this.mapClientIncident(incident);
  }
}
