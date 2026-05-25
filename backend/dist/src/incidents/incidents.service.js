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
const create_incident_dto_1 = require("./dto/create-incident.dto");
let IncidentsService = class IncidentsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    mapIncident(row) {
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
    incidentSelectSql(whereSql) {
        return client_1.Prisma.sql `
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
    async findForGuard(tenantId, guardId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${tenantId} AND i."guard_id" = ${guardId}`));
        return rows.map((row) => this.mapIncident(row));
    }
    async findAllForAdmin(tenantId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${tenantId}`));
        return rows.map((row) => this.mapIncident(row));
    }
    async findOneForAdmin(tenantId, incidentId, userId) {
        const rows = await this.prisma.$queryRaw(this.incidentSelectSql(client_1.Prisma.sql `WHERE i."tenant_id" = ${tenantId} AND i."id" = ${incidentId}`));
        const incident = rows[0];
        if (!incident) {
            throw new common_1.NotFoundException('Incident not found');
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
};
exports.IncidentsService = IncidentsService;
exports.IncidentsService = IncidentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], IncidentsService);
//# sourceMappingURL=incidents.service.js.map