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
exports.EmergencyAlertsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const branch_scope_1 = require("../branches/branch-scope");
const emergency_alert_status_util_1 = require("./emergency-alert-status.util");
const alertInclude = {
    guard: { select: { id: true, name: true, phone: true } },
    branch: { select: { id: true, name: true } },
    patrolRun: {
        select: {
            id: true,
            status: true,
            patrolRoute: { select: { id: true, name: true } },
            shift: {
                select: {
                    id: true,
                    site: { select: { id: true, name: true } },
                },
            },
        },
    },
    acknowledgedBy: { select: { id: true, name: true, email: true } },
    resolvedBy: { select: { id: true, name: true, email: true } },
};
let EmergencyAlertsService = class EmergencyAlertsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    serialize(alert) {
        return {
            id: alert.id,
            status: alert.status,
            triggeredAt: alert.triggeredAt,
            acknowledgedAt: alert.acknowledgedAt,
            resolvedAt: alert.resolvedAt,
            notes: alert.notes,
            guard: alert.guard,
            branch: alert.branch,
            site: alert.patrolRun?.shift?.site ?? null,
            patrolRoute: alert.patrolRun?.patrolRoute ?? null,
            patrolRunId: alert.patrolRun?.id ?? null,
            acknowledgedBy: alert.acknowledgedBy,
            resolvedBy: alert.resolvedBy,
            location: alert.lastLatitude !== null && alert.lastLongitude !== null
                ? {
                    latitude: alert.lastLatitude,
                    longitude: alert.lastLongitude,
                    accuracyMeters: alert.lastAccuracyMeters,
                    capturedAt: alert.locationCapturedAt,
                }
                : null,
            createdAt: alert.createdAt,
            updatedAt: alert.updatedAt,
        };
    }
    async triggerForGuard(tenantId, guardId) {
        const guard = await this.prisma.guard.findFirst({
            where: { id: guardId, tenantId },
            select: { id: true, name: true, branchId: true },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        const existingActive = await this.prisma.emergencyAlert.findFirst({
            where: {
                tenantId,
                guardId,
                status: emergency_alert_status_util_1.EmergencyAlertStatus.ACTIVE,
            },
            include: alertInclude,
            orderBy: { triggeredAt: 'desc' },
        });
        if (existingActive) {
            return this.serialize(existingActive);
        }
        const activeRun = await this.prisma.patrolRun.findFirst({
            where: { tenantId, guardId, status: 'in_progress' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                lastLatitude: true,
                lastLongitude: true,
                lastAccuracyMeters: true,
                lastLocationAt: true,
            },
        });
        const created = await this.prisma.emergencyAlert.create({
            data: {
                tenantId,
                guardId,
                branchId: guard.branchId,
                patrolRunId: activeRun?.id ?? null,
                status: emergency_alert_status_util_1.EmergencyAlertStatus.ACTIVE,
                lastLatitude: activeRun?.lastLatitude ?? null,
                lastLongitude: activeRun?.lastLongitude ?? null,
                lastAccuracyMeters: activeRun?.lastAccuracyMeters ?? null,
                locationCapturedAt: activeRun?.lastLocationAt ?? null,
            },
            include: alertInclude,
        });
        await this.auditService.log({
            tenantId,
            userId: guardId,
            action: 'EMERGENCY_ALERT_TRIGGERED',
            entityType: 'EmergencyAlert',
            entityId: created.id,
            details: `Guard "${guard.name}" triggered a panic/duress alert${activeRun ? ' during an active patrol' : ''}`,
        });
        return this.serialize(created);
    }
    async findActiveForGuard(tenantId, guardId) {
        const alert = await this.prisma.emergencyAlert.findFirst({
            where: {
                tenantId,
                guardId,
                status: {
                    in: [emergency_alert_status_util_1.EmergencyAlertStatus.ACTIVE, emergency_alert_status_util_1.EmergencyAlertStatus.ACKNOWLEDGED],
                },
            },
            include: alertInclude,
            orderBy: { triggeredAt: 'desc' },
        });
        return alert ? this.serialize(alert) : null;
    }
    async findAllForAdmin(user, status) {
        const alerts = await this.prisma.emergencyAlert.findMany({
            where: {
                tenantId: user.tenantId,
                ...(0, branch_scope_1.branchWhere)(user),
                ...(status ? { status } : {}),
            },
            include: alertInclude,
            orderBy: { triggeredAt: 'desc' },
        });
        return alerts.map((alert) => this.serialize(alert));
    }
    async findAlertOrThrow(user, id) {
        const alert = await this.prisma.emergencyAlert.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            include: alertInclude,
        });
        if (!alert) {
            throw new common_1.NotFoundException('Emergency alert not found');
        }
        return alert;
    }
    async acknowledge(user, id, dto) {
        const alert = await this.findAlertOrThrow(user, id);
        (0, emergency_alert_status_util_1.assertCanAcknowledge)(alert.status);
        const updated = await this.prisma.emergencyAlert.update({
            where: { id },
            data: {
                status: emergency_alert_status_util_1.EmergencyAlertStatus.ACKNOWLEDGED,
                acknowledgedAt: new Date(),
                acknowledgedById: user.sub,
                ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
            },
            include: alertInclude,
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'EMERGENCY_ALERT_ACKNOWLEDGED',
            entityType: 'EmergencyAlert',
            entityId: id,
            details: `Acknowledged panic/duress alert for guard "${alert.guard?.name}"`,
        });
        return this.serialize(updated);
    }
    async resolve(user, id, dto) {
        const alert = await this.findAlertOrThrow(user, id);
        (0, emergency_alert_status_util_1.assertCanResolve)(alert.status);
        const updated = await this.prisma.emergencyAlert.update({
            where: { id },
            data: {
                status: emergency_alert_status_util_1.EmergencyAlertStatus.RESOLVED,
                resolvedAt: new Date(),
                resolvedById: user.sub,
                ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
            },
            include: alertInclude,
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'EMERGENCY_ALERT_RESOLVED',
            entityType: 'EmergencyAlert',
            entityId: id,
            details: `Resolved panic/duress alert for guard "${alert.guard?.name}"`,
        });
        return this.serialize(updated);
    }
};
exports.EmergencyAlertsService = EmergencyAlertsService;
exports.EmergencyAlertsService = EmergencyAlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EmergencyAlertsService);
//# sourceMappingURL=emergency-alerts.service.js.map