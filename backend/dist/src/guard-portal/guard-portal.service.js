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
exports.GuardPortalService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
let GuardPortalService = class GuardPortalService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async getProfile(tenantId, guardId) {
        const guard = await this.prisma.guard.findFirst({
            where: { id: guardId, tenantId },
            include: { availability: true },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard profile not found');
        }
        return {
            id: guard.id,
            name: guard.name,
            phone: guard.phone,
            email: guard.email,
            availabilityStatus: guard.availability?.status || 'available',
        };
    }
    async getAssignedShifts(tenantId, guardId) {
        await this.getProfile(tenantId, guardId);
        const assignments = await this.prisma.assignment.findMany({
            where: {
                guardId,
                shift: { tenantId },
            },
            include: {
                shift: {
                    include: {
                        site: true,
                    },
                },
            },
        });
        return assignments
            .sort((left, right) => left.shift.startTime.getTime() - right.shift.startTime.getTime())
            .map((assignment) => ({
            id: assignment.shift.id,
            shiftId: assignment.shift.id,
            siteName: assignment.shift.site.name,
            siteAddress: assignment.shift.site.address,
            startTime: assignment.shift.startTime,
            endTime: assignment.shift.endTime,
            status: assignment.shift.status,
            assignmentStatus: assignment.status,
        }));
    }
    async getShiftDetail(tenantId, guardId, shiftId) {
        const assignment = await this.prisma.assignment.findFirst({
            where: {
                guardId,
                shiftId,
                shift: { tenantId },
            },
            include: {
                guard: true,
                shift: {
                    include: {
                        site: true,
                    },
                },
            },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException('You do not have access to this shift');
        }
        await this.auditService.log({
            tenantId,
            userId: guardId,
            action: 'GUARD_SHIFT_VIEWED',
            entityType: 'Shift',
            entityId: shiftId,
            details: `Guard "${assignment.guard.name}" viewed assigned shift`,
        });
        return {
            id: assignment.shift.id,
            shiftId: assignment.shift.id,
            startTime: assignment.shift.startTime,
            endTime: assignment.shift.endTime,
            status: assignment.shift.status,
            assignmentStatus: assignment.status,
            site: {
                id: assignment.shift.site.id,
                name: assignment.shift.site.name,
                address: assignment.shift.site.address,
                instructions: assignment.shift.site.instructions,
            },
            assignedGuard: {
                id: assignment.guard.id,
                name: assignment.guard.name,
                phone: assignment.guard.phone,
                email: assignment.guard.email,
            },
        };
    }
};
exports.GuardPortalService = GuardPortalService;
exports.GuardPortalService = GuardPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GuardPortalService);
//# sourceMappingURL=guard-portal.service.js.map