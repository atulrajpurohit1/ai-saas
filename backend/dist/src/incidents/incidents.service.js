"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const webhooks_service_1 = require("../webhooks/webhooks.service");
const create_incident_dto_1 = require("./dto/create-incident.dto");
const review_incident_dto_1 = require("./dto/review-incident.dto");
let IncidentsService = class IncidentsService {
    prisma;
    auditService;
    webhooksService;
    constructor(prisma, auditService, webhooksService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.webhooksService = webhooksService;
    }
    mapIncident(row) {
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
    mapClientIncident(row) {
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
    mapClientIncidentListItem(row) {
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
    incidentSelectSql(whereSql) {
        return client_1.Prisma.sql `
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
    validateCreateDto(dto) {
        const title = dto.title?.trim();
        const description = dto.description?.trim();
        const severity = dto.severity;
        const occurredAt = new Date(dto.occurred_at);
        const attachmentUrl = dto.attachment_url?.trim() || null;
        const notes = dto.notes?.trim() || null;
        if (!title || !description || !severity || !dto.occurred_at) {
            throw new common_1.BadRequestException('Title, description, severity, and occurred_at are required');
        }
        if (!create_incident_dto_1.INCIDENT_SEVERITIES.includes(severity)) {
            throw new common_1.BadRequestException('Severity must be low, medium, high, or critical');
        }
        if (Number.isNaN(occurredAt.getTime())) {
            throw new common_1.BadRequestException('occurred_at must be a valid date');
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
    validateReviewStatus(status) {
        if (!review_incident_dto_1.INCIDENT_REVIEW_STATUSES.includes(status)) {
            throw new common_1.BadRequestException('Review status must be approved or rejected');
        }
        return status;
    }
    adminBranchSql(user, requestedBranchId) {
        if (user.isSuperAdmin) {
            return requestedBranchId
                ? client_1.Prisma.sql `AND i."branch_id" = ${requestedBranchId}`
                : client_1.Prisma.empty;
        }
        if (!user.branchId) {
            return client_1.Prisma.sql `AND i."branch_id" IS NULL`;
        }
        return client_1.Prisma.sql `AND (i."branch_id" = ${user.branchId} OR i."branch_id" IS NULL)`;
    }
    async moveSubmittedIncidentToReview(tenantId, userId, incident) {
        if (incident.status !== 'submitted') {
            return false;
        }
        const updatedCount = await this.prisma.$executeRaw(client_1.Prisma.sql `
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
    async createForGuard(tenantId, guardId, shiftId, dto) {
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
            throw new common_1.NotFoundException('Shift not found');
        }
        const assignment = shift.assignments[0];
        if (!assignment) {
            throw new common_1.ForbiddenException('Shift is not assigned to this guard');
        }
        const hasCheckedIn = shift.status === 'in_progress' ||
            shift.attendanceEvents.some((event) => event.type === 'CHECK_IN');
        if (!hasCheckedIn) {
            throw new common_1.BadRequestException('Guard must check in before reporting an incident');
        }
        const incidentId = (0, crypto_1.randomUUID)();
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
        const mappedIncident = this.mapIncident(incident);
        await this.webhooksService.triggerEvent(tenantId, 'incident.created', { incident: mappedIncident });
        return mappedIncident;
    }
    async findForGuard(tenantId, guardId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${tenantId} AND i."guard_id" = ${guardId}`));
        return rows.map((row) => this.mapIncident(row));
    }
    async findAllForAdmin(user, requestedBranchId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user, requestedBranchId)}`));
        return rows.map((row) => this.mapIncident(row));
    }
    async findReviewQueueForAdmin(user, requestedBranchId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user, requestedBranchId)} AND i."status" IN ('submitted', 'under_review')`));
        return rows.map((row) => this.mapIncident(row));
    }
    async findOneForAdmin(user, incidentId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user)} AND i."id" = ${incidentId}`));
        let incident = rows[0];
        if (!incident) {
            throw new common_1.NotFoundException('Incident not found');
        }
        const movedToReview = await this.moveSubmittedIncidentToReview(user.tenantId, user.sub, incident);
        if (movedToReview) {
            const updatedRows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${user.tenantId} AND i."id" = ${incidentId}`));
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
        return this.mapIncident(incident);
    }
    async reviewIncident(user, incidentId, dto) {
        const status = this.validateReviewStatus(dto.status);
        const reviewNote = dto.review_note?.trim() || null;
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${user.tenantId} ${this.adminBranchSql(user)} AND i."id" = ${incidentId}`));
        const incident = rows[0];
        if (!incident) {
            throw new common_1.NotFoundException('Incident not found');
        }
        if (incident.status === 'approved' || incident.status === 'rejected') {
            throw new common_1.BadRequestException('Incident has already been reviewed');
        }
        if (incident.status !== 'submitted' && incident.status !== 'under_review') {
            throw new common_1.BadRequestException('Incident cannot be reviewed from its current status');
        }
        await this.moveSubmittedIncidentToReview(user.tenantId, user.sub, incident);
        const reviewedAt = new Date();
        const updatedCount = await this.prisma.$executeRaw(client_1.Prisma.sql `
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
            throw new common_1.BadRequestException('Incident has already been reviewed');
        }
        const updatedRows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${user.tenantId} AND i."id" = ${incidentId}`));
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
            await this.webhooksService.triggerEvent(user.tenantId, 'incident.approved', {
                incident: this.mapIncident(reviewedIncident),
            });
        }
        return this.mapIncident(reviewedIncident);
    }
    async findApprovedForClient(tenantId, clientId, userId) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
    async findApprovedDetailForClient(tenantId, clientId, userId, incidentId) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
            throw new common_1.NotFoundException('Incident not found');
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
};
exports.IncidentsService = IncidentsService;
exports.IncidentsService = IncidentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        webhooks_service_1.WebhooksService])
], IncidentsService);
//# sourceMappingURL=incidents.service.js.map