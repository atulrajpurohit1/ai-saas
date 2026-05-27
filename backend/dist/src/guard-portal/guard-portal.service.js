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
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
let GuardPortalService = class GuardPortalService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
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
    async logInvalidAttendanceAttempt(data) {
        await this.auditService.log({
            tenantId: data.tenantId,
            userId: data.guardId,
            action: data.action === 'CHECK_IN' ? 'GUARD_CHECK_IN_INVALID' : 'GUARD_CHECK_OUT_INVALID',
            entityType: 'Shift',
            entityId: data.shiftId,
            details: data.reason,
        });
    }
    isDuplicateAttendanceEvent(error) {
        return error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    roundHours(value) {
        return Math.round(value * 10) / 10;
    }
    async getAssignedShiftContext(tenantId, guardId, shiftId, auditAction) {
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
            if (auditAction) {
                await this.logInvalidAttendanceAttempt({
                    tenantId,
                    guardId,
                    shiftId,
                    action: auditAction,
                    reason: 'Shift not found',
                });
            }
            throw new common_1.NotFoundException('Shift not found');
        }
        const assignment = shift.assignments[0];
        if (!assignment) {
            if (auditAction) {
                await this.logInvalidAttendanceAttempt({
                    tenantId,
                    guardId,
                    shiftId,
                    action: auditAction,
                    reason: 'Shift is not assigned to this guard',
                });
            }
            throw new common_1.ForbiddenException('Shift is not assigned to this guard');
        }
        return { shift, assignment };
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
                        attendanceEvents: {
                            where: { guardId, tenantId },
                            orderBy: { timestamp: 'asc' },
                        },
                    },
                },
            },
        });
        return assignments
            .sort((left, right) => left.shift.startTime.getTime() - right.shift.startTime.getTime())
            .map((assignment) => {
            const attendance = this.summarizeAttendance(assignment.shift.attendanceEvents);
            return {
                id: assignment.shift.id,
                shiftId: assignment.shift.id,
                siteName: assignment.shift.site.name,
                siteAddress: assignment.shift.site.address,
                startTime: assignment.shift.startTime,
                endTime: assignment.shift.endTime,
                status: assignment.shift.status,
                assignmentStatus: assignment.status,
                attendanceStatus: attendance.attendanceStatus,
                checkInTime: attendance.checkInTime,
                checkOutTime: attendance.checkOutTime,
            };
        });
    }
    async getShiftDetail(tenantId, guardId, shiftId) {
        const { shift, assignment } = await this.getAssignedShiftContext(tenantId, guardId, shiftId);
        const attendance = this.summarizeAttendance(shift.attendanceEvents);
        await this.auditService.log({
            tenantId,
            userId: guardId,
            action: 'GUARD_SHIFT_VIEWED',
            entityType: 'Shift',
            entityId: shiftId,
            details: `Guard "${assignment.guard.name}" viewed assigned shift`,
        });
        return {
            id: shift.id,
            shiftId: shift.id,
            startTime: shift.startTime,
            endTime: shift.endTime,
            status: shift.status,
            assignmentStatus: assignment.status,
            attendanceStatus: attendance.attendanceStatus,
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            site: {
                id: shift.site.id,
                name: shift.site.name,
                address: shift.site.address,
                instructions: shift.site.instructions,
            },
            assignedGuard: {
                id: assignment.guard.id,
                name: assignment.guard.name,
                phone: assignment.guard.phone,
                email: assignment.guard.email,
            },
        };
    }
    async checkIn(tenantId, guardId, shiftId) {
        const { shift, assignment } = await this.getAssignedShiftContext(tenantId, guardId, shiftId, 'CHECK_IN');
        const attendance = this.summarizeAttendance(shift.attendanceEvents);
        if (attendance.checkInTime) {
            await this.logInvalidAttendanceAttempt({
                tenantId,
                guardId,
                shiftId,
                action: 'CHECK_IN',
                reason: 'Guard has already checked in for this shift',
            });
            throw new common_1.BadRequestException('Guard has already checked in for this shift');
        }
        if (attendance.checkOutTime) {
            await this.logInvalidAttendanceAttempt({
                tenantId,
                guardId,
                shiftId,
                action: 'CHECK_IN',
                reason: 'Guard has already checked out for this shift',
            });
            throw new common_1.BadRequestException('Guard has already checked out for this shift');
        }
        try {
            const event = await this.prisma.$transaction(async (tx) => {
                const attendanceEvent = await tx.attendanceEvent.create({
                    data: {
                        tenantId,
                        guardId,
                        shiftId,
                        type: 'CHECK_IN',
                        source: 'guard_portal',
                    },
                });
                await tx.shift.update({
                    where: { id: shiftId },
                    data: { status: 'in_progress' },
                });
                return attendanceEvent;
            });
            await this.auditService.log({
                tenantId,
                userId: guardId,
                action: 'GUARD_CHECKED_IN',
                entityType: 'Shift',
                entityId: shiftId,
                details: `Guard "${assignment.guard.name}" checked in`,
            });
            return {
                message: 'Checked in successfully',
                shiftStatus: 'in_progress',
                attendanceStatus: 'checked_in',
                checkInTime: event.timestamp,
                checkOutTime: null,
            };
        }
        catch (error) {
            if (this.isDuplicateAttendanceEvent(error)) {
                await this.logInvalidAttendanceAttempt({
                    tenantId,
                    guardId,
                    shiftId,
                    action: 'CHECK_IN',
                    reason: 'Guard has already checked in for this shift',
                });
                throw new common_1.BadRequestException('Guard has already checked in for this shift');
            }
            throw error;
        }
    }
    async checkOut(tenantId, guardId, shiftId) {
        const { shift, assignment } = await this.getAssignedShiftContext(tenantId, guardId, shiftId, 'CHECK_OUT');
        const attendance = this.summarizeAttendance(shift.attendanceEvents);
        if (attendance.checkOutTime) {
            await this.logInvalidAttendanceAttempt({
                tenantId,
                guardId,
                shiftId,
                action: 'CHECK_OUT',
                reason: 'Guard has already checked out for this shift',
            });
            throw new common_1.BadRequestException('Guard has already checked out for this shift');
        }
        if (!attendance.checkInTime) {
            await this.logInvalidAttendanceAttempt({
                tenantId,
                guardId,
                shiftId,
                action: 'CHECK_OUT',
                reason: 'Guard must check in before checking out',
            });
            throw new common_1.BadRequestException('Guard must check in before checking out');
        }
        const checkInTime = attendance.checkInTime;
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const attendanceEvent = await tx.attendanceEvent.create({
                    data: {
                        tenantId,
                        guardId,
                        shiftId,
                        type: 'CHECK_OUT',
                        source: 'guard_portal',
                    },
                });
                await tx.shift.update({
                    where: { id: shiftId },
                    data: { status: 'completed' },
                });
                const totalHours = this.roundHours(Math.max(0, (attendanceEvent.timestamp.getTime() - checkInTime.getTime()) / 3_600_000));
                const timesheet = await tx.timesheet.upsert({
                    where: {
                        tenantId_shiftId_guardId: {
                            tenantId,
                            shiftId,
                            guardId,
                        },
                    },
                    update: {
                        siteId: shift.siteId,
                        clientId: shift.site.clientId,
                        checkInTime,
                        checkOutTime: attendanceEvent.timestamp,
                        totalHours,
                        status: 'pending',
                        approvedBy: null,
                        approvedAt: null,
                        rejectionReason: null,
                    },
                    create: {
                        tenantId,
                        guardId,
                        shiftId,
                        siteId: shift.siteId,
                        clientId: shift.site.clientId,
                        checkInTime,
                        checkOutTime: attendanceEvent.timestamp,
                        totalHours,
                        status: 'pending',
                    },
                });
                return { attendanceEvent, timesheet };
            });
            await this.auditService.log({
                tenantId,
                userId: guardId,
                action: 'GUARD_CHECKED_OUT',
                entityType: 'Shift',
                entityId: shiftId,
                details: `Guard "${assignment.guard.name}" checked out`,
            });
            return {
                message: 'Checked out successfully',
                shiftStatus: 'completed',
                attendanceStatus: 'completed',
                checkInTime,
                checkOutTime: result.attendanceEvent.timestamp,
                timesheetId: result.timesheet.id,
                timesheetStatus: result.timesheet.status,
                totalHours: result.timesheet.totalHours,
            };
        }
        catch (error) {
            if (this.isDuplicateAttendanceEvent(error)) {
                await this.logInvalidAttendanceAttempt({
                    tenantId,
                    guardId,
                    shiftId,
                    action: 'CHECK_OUT',
                    reason: 'Guard has already checked out for this shift',
                });
                throw new common_1.BadRequestException('Guard has already checked out for this shift');
            }
            throw error;
        }
    }
};
exports.GuardPortalService = GuardPortalService;
exports.GuardPortalService = GuardPortalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GuardPortalService);
//# sourceMappingURL=guard-portal.service.js.map