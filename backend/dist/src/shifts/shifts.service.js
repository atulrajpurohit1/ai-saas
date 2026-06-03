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
exports.ShiftsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const recommendation_service_1 = require("../ai-insights/recommendation.service");
const branch_scope_1 = require("../branches/branch-scope");
let ShiftsService = class ShiftsService {
    prisma;
    auditService;
    recommendationService;
    constructor(prisma, auditService, recommendationService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.recommendationService = recommendationService;
    }
    summarizeAttendance(events) {
        const checkIn = events.find((event) => event.type === 'CHECK_IN');
        const checkOut = events.find((event) => event.type === 'CHECK_OUT');
        return {
            attendanceStatus: checkOut ? 'completed' : checkIn ? 'checked_in' : 'not_started',
            checkInTime: checkIn?.timestamp ?? null,
            checkOutTime: checkOut?.timestamp ?? null,
        };
    }
    async create(user, dto) {
        const branchId = (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        const site = await this.prisma.site.findFirst({
            where: { id: dto.siteId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!site) {
            throw new common_1.NotFoundException('Site not found');
        }
        if (branchId && site.branchId && site.branchId !== branchId) {
            throw new common_1.ForbiddenException('Site must belong to the selected branch');
        }
        const shift = await this.prisma.shift.create({
            data: {
                siteId: dto.siteId,
                startTime: new Date(dto.startTime),
                endTime: new Date(dto.endTime),
                requiredGuards: dto.requiredGuards,
                tenantId: user.tenantId,
                branchId: branchId ?? site.branchId,
                status: 'open',
            },
            include: {
                site: {
                    select: { name: true }
                }
            }
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'SHIFT_CREATED',
            entityType: 'Shift',
            entityId: shift.id,
            details: `Shift created for site "${site.name}" (${dto.requiredGuards} guards)`,
        });
        return shift;
    }
    async findAll(user, requestedBranchId) {
        try {
            const shifts = await this.prisma.shift.findMany({
                where: (0, branch_scope_1.branchScopedWhere)(user, requestedBranchId),
                include: {
                    branch: {
                        select: { id: true, name: true, location: true, status: true },
                    },
                    site: {
                        select: {
                            name: true,
                        },
                    },
                    assignments: {
                        include: {
                            guard: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                    attendanceEvents: {
                        orderBy: {
                            timestamp: 'asc',
                        },
                    },
                },
                orderBy: {
                    startTime: 'desc',
                },
            });
            return shifts.map((shift) => {
                const attendance = this.summarizeAttendance(shift.attendanceEvents);
                const { attendanceEvents, ...shiftWithoutEvents } = shift;
                return {
                    ...shiftWithoutEvents,
                    attendanceStatus: attendance.attendanceStatus,
                    checkInTime: attendance.checkInTime,
                    checkOutTime: attendance.checkOutTime,
                };
            });
        }
        catch (error) {
            console.error('Shifts findAll error:', error.message);
            throw new common_1.InternalServerErrorException('Failed to fetch shifts. The database may be unavailable.');
        }
    }
    async recommendGuards(user, shiftId) {
        const shift = await this.prisma.shift.findFirst({
            where: { id: shiftId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            select: { id: true },
        });
        if (!shift) {
            throw new common_1.NotFoundException('Shift not found');
        }
        const recommendations = await this.recommendationService.recommendGuards(user.tenantId, shiftId, true);
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_RECOMMENDATIONS_GENERATED',
            entityType: 'Shift',
            entityId: shiftId,
            details: `${recommendations.length} guard recommendations generated`,
        });
        return recommendations;
    }
    async assign(user, shiftId, guardId) {
        const shift = await this.prisma.shift.findFirst({
            where: { id: shiftId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            include: { assignments: true },
        });
        if (!shift)
            throw new common_1.NotFoundException('Shift not found');
        const guard = await this.prisma.guard.findFirst({
            where: { id: guardId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!guard)
            throw new common_1.NotFoundException('Guard not found');
        if (shift.branchId && guard.branchId && shift.branchId !== guard.branchId) {
            throw new common_1.ForbiddenException('Guard and shift must belong to the same branch');
        }
        const availability = await this.prisma.availability.findUnique({
            where: { guardId },
        });
        if (availability && availability.status === 'unavailable') {
            await this.auditService.log({
                tenantId: user.tenantId,
                userId: user.sub,
                action: 'ASSIGNMENT_REJECTED',
                entityType: 'Shift',
                entityId: shiftId,
                details: `Assignment of guard "${guard.name}" rejected due to unavailability`,
            });
            throw new common_1.ForbiddenException('Guard is currently unavailable');
        }
        if (shift.assignments.length > 0) {
            throw new common_1.ForbiddenException('Shift is already assigned');
        }
        let selectedRecommendation = null;
        try {
            const recommendations = await this.recommendationService.recommendGuards(user.tenantId, shiftId, false);
            selectedRecommendation =
                recommendations.find((recommendation) => recommendation.guard_id === guardId) ??
                    null;
        }
        catch (error) {
            console.warn('Failed to evaluate guard recommendation during assignment:', error instanceof Error ? error.message : error);
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const assignment = await tx.assignment.create({
                data: {
                    shiftId,
                    guardId,
                    status: 'pending',
                },
            });
            await tx.shift.update({
                where: { id: shiftId },
                data: { status: 'assigned' },
            });
            return assignment;
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_ASSIGNED',
            entityType: 'Shift',
            entityId: shiftId,
            details: `Guard "${guard.name}" assigned to shift at "${shiftId}"`,
        });
        if (selectedRecommendation) {
            await this.auditService.log({
                tenantId: user.tenantId,
                userId: user.sub,
                action: 'RECOMMENDED_GUARD_ASSIGNED',
                entityType: 'Shift',
                entityId: shiftId,
                details: `Recommended guard "${guard.name}" assigned with score ${selectedRecommendation.score}`,
            });
        }
        console.log(`[NOTIFICATION] Guard "${guard.name}" assigned to Shift #${shiftId}`);
        return result;
    }
    async unassign(user, shiftId) {
        const shift = await this.prisma.shift.findFirst({
            where: { id: shiftId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            include: { assignments: true },
        });
        if (!shift)
            throw new common_1.NotFoundException('Shift not found');
        if (shift.assignments.length === 0) {
            throw new common_1.NotFoundException('No assignment found for this shift');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.assignment.deleteMany({
                where: { shiftId },
            });
            await tx.shift.update({
                where: { id: shiftId },
                data: { status: 'open' },
            });
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_UNASSIGNED',
            entityType: 'Shift',
            entityId: shiftId,
            details: `Guard unassigned from shift "${shiftId}"`,
        });
        console.log(`[NOTIFICATION] Guard unassigned from Shift #${shiftId}`);
        return { message: 'Guard unassigned successfully' };
    }
};
exports.ShiftsService = ShiftsService;
exports.ShiftsService = ShiftsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        recommendation_service_1.RecommendationService])
], ShiftsService);
//# sourceMappingURL=shifts.service.js.map