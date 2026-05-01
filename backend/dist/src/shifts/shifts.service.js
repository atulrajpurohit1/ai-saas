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
let ShiftsService = class ShiftsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(userId, tenantId, dto) {
        const site = await this.prisma.site.findUnique({
            where: { id: dto.siteId },
        });
        if (!site) {
            throw new common_1.NotFoundException('Site not found');
        }
        if (site.tenantId !== tenantId) {
            throw new common_1.ForbiddenException('You do not have access to this site');
        }
        const shift = await this.prisma.shift.create({
            data: {
                siteId: dto.siteId,
                startTime: new Date(dto.startTime),
                endTime: new Date(dto.endTime),
                requiredGuards: dto.requiredGuards,
                tenantId: tenantId,
                status: 'open',
            },
            include: {
                site: {
                    select: { name: true }
                }
            }
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SHIFT_CREATED',
            entityType: 'Shift',
            entityId: shift.id,
            details: `Shift created for site "${site.name}" (${dto.requiredGuards} guards)`,
        });
        return shift;
    }
    async findAll(tenantId) {
        return this.prisma.shift.findMany({
            where: { tenantId },
            include: {
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
            },
            orderBy: {
                startTime: 'desc',
            },
        });
    }
    async assign(userId, tenantId, shiftId, guardId) {
        const shift = await this.prisma.shift.findUnique({
            where: { id: shiftId },
            include: { assignments: true },
        });
        if (!shift)
            throw new common_1.NotFoundException('Shift not found');
        if (shift.tenantId !== tenantId)
            throw new common_1.ForbiddenException('Access denied');
        const guard = await this.prisma.guard.findUnique({
            where: { id: guardId },
        });
        if (!guard)
            throw new common_1.NotFoundException('Guard not found');
        if (guard.tenantId !== tenantId)
            throw new common_1.ForbiddenException('Access denied');
        const availability = await this.prisma.availability.findUnique({
            where: { guardId },
        });
        if (availability && availability.status === 'unavailable') {
            await this.auditService.log({
                tenantId,
                userId,
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
            tenantId,
            userId,
            action: 'GUARD_ASSIGNED',
            entityType: 'Shift',
            entityId: shiftId,
            details: `Guard "${guard.name}" assigned to shift at "${shiftId}"`,
        });
        console.log(`[NOTIFICATION] Guard "${guard.name}" assigned to Shift #${shiftId}`);
        return result;
    }
    async unassign(userId, tenantId, shiftId) {
        const shift = await this.prisma.shift.findUnique({
            where: { id: shiftId },
            include: { assignments: true },
        });
        if (!shift)
            throw new common_1.NotFoundException('Shift not found');
        if (shift.tenantId !== tenantId)
            throw new common_1.ForbiddenException('Access denied');
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
            tenantId,
            userId,
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
        audit_service_1.AuditService])
], ShiftsService);
//# sourceMappingURL=shifts.service.js.map