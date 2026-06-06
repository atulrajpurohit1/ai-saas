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
exports.TimesheetsService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const TIMESHEET_STATUSES = ['pending', 'approved', 'rejected', 'corrected'];
let TimesheetsService = class TimesheetsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    isValidStatus(status) {
        return TIMESHEET_STATUSES.includes(status);
    }
    timesheetInclude() {
        return {
            guard: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            shift: {
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    status: true,
                },
            },
            site: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                },
            },
            client: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    email: true,
                },
            },
        };
    }
    mapTimesheet(timesheet) {
        return {
            id: timesheet.id,
            tenantId: timesheet.tenantId,
            guardId: timesheet.guardId,
            shiftId: timesheet.shiftId,
            siteId: timesheet.siteId,
            clientId: timesheet.clientId,
            checkInTime: timesheet.checkInTime,
            checkOutTime: timesheet.checkOutTime,
            totalHours: timesheet.totalHours,
            status: timesheet.status,
            approvedBy: timesheet.approvedBy,
            approvedAt: timesheet.approvedAt,
            rejectionReason: timesheet.rejectionReason,
            createdAt: timesheet.createdAt,
            guard: timesheet.guard
                ? {
                    id: timesheet.guard.id,
                    name: timesheet.guard.name,
                    email: timesheet.guard.email,
                    phone: timesheet.guard.phone,
                }
                : null,
            shift: timesheet.shift
                ? {
                    id: timesheet.shift.id,
                    startTime: timesheet.shift.startTime,
                    endTime: timesheet.shift.endTime,
                    status: timesheet.shift.status,
                }
                : null,
            site: timesheet.site
                ? {
                    id: timesheet.site.id,
                    name: timesheet.site.name,
                    address: timesheet.site.address,
                }
                : null,
            client: timesheet.client
                ? {
                    id: timesheet.client.id,
                    name: timesheet.client.name,
                    companyName: timesheet.client.companyName,
                    email: timesheet.client.email,
                }
                : null,
        };
    }
    timesheetBranchWhere(user, requestedBranchId) {
        const branchId = requestedBranchId?.trim() || null;
        if (user.isSuperAdmin) {
            return branchId ? { shift: { branchId } } : {};
        }
        if (!user.branchId) {
            return { shift: { branchId: null } };
        }
        if (branchId && branchId !== user.branchId) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
        return {
            OR: [
                { shift: { branchId: user.branchId } },
                { shift: { branchId: null } },
            ],
        };
    }
    async findTimesheetOrThrow(user, id) {
        const timesheet = await this.prisma.timesheet.findFirst({
            where: {
                id,
                tenantId: user.tenantId,
                ...this.timesheetBranchWhere(user),
            },
            include: this.timesheetInclude(),
        });
        if (!timesheet) {
            throw new common_1.NotFoundException('Timesheet not found');
        }
        return timesheet;
    }
    async assertNotInvoiced(id) {
        const invoiceItemCount = await this.prisma.invoiceItem.count({
            where: { timesheetId: id },
        });
        if (invoiceItemCount > 0) {
            throw new common_1.BadRequestException('Timesheet has already been used for an invoice');
        }
    }
    parseOptionalDate(value, fieldName) {
        if (!value) {
            return undefined;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new common_1.BadRequestException(`${fieldName} must be a valid date`);
        }
        return parsed;
    }
    async findAllForAdmin(user, status, requestedBranchId) {
        if (status && !this.isValidStatus(status)) {
            throw new common_1.BadRequestException('Invalid timesheet status');
        }
        const timesheets = await this.prisma.timesheet.findMany({
            where: {
                tenantId: user.tenantId,
                ...(status ? { status } : {}),
                ...this.timesheetBranchWhere(user, requestedBranchId),
            },
            include: this.timesheetInclude(),
            orderBy: [{ createdAt: 'desc' }],
        });
        return timesheets.map((timesheet) => this.mapTimesheet(timesheet));
    }
    async findOneForAdmin(user, id) {
        const timesheet = await this.findTimesheetOrThrow(user, id);
        return this.mapTimesheet(timesheet);
    }
    async approve(user, timesheetId) {
        const existing = await this.findTimesheetOrThrow(user, timesheetId);
        if (user.role === 'guard' || user.guardId === existing.guardId || user.sub === existing.guardId) {
            throw new common_1.ForbiddenException('Guard cannot approve own timesheet');
        }
        if (existing.status === 'approved') {
            return this.mapTimesheet(existing);
        }
        if (existing.totalHours <= 0) {
            throw new common_1.BadRequestException('Timesheet must have billable hours before approval. Correct the hours first.');
        }
        if (!['pending', 'corrected'].includes(existing.status)) {
            throw new common_1.BadRequestException('Only pending or corrected timesheets can be approved');
        }
        const timesheet = await this.prisma.timesheet.update({
            where: { id: existing.id },
            data: {
                status: 'approved',
                approvedBy: user.sub,
                approvedAt: new Date(),
                rejectionReason: null,
            },
            include: this.timesheetInclude(),
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'TIMESHEET_APPROVED',
            entityType: 'Timesheet',
            entityId: timesheet.id,
            details: `Approved ${timesheet.totalHours}h for guard "${timesheet.guard.name}" at "${timesheet.site.name}"`,
        });
        return this.mapTimesheet(timesheet);
    }
    async reject(user, id, dto) {
        const reason = dto.rejection_reason?.trim();
        if (!reason) {
            throw new common_1.BadRequestException('rejection_reason is required');
        }
        const existing = await this.findTimesheetOrThrow(user, id);
        await this.assertNotInvoiced(existing.id);
        if (!['pending', 'corrected'].includes(existing.status)) {
            throw new common_1.BadRequestException('Only pending or corrected timesheets can be rejected');
        }
        const timesheet = await this.prisma.timesheet.update({
            where: { id: existing.id },
            data: {
                status: 'rejected',
                approvedBy: null,
                approvedAt: null,
                rejectionReason: reason,
            },
            include: this.timesheetInclude(),
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'TIMESHEET_REJECTED',
            entityType: 'Timesheet',
            entityId: timesheet.id,
            details: `Rejected timesheet for guard "${timesheet.guard.name}": ${reason}`,
        });
        return this.mapTimesheet(timesheet);
    }
    async correct(user, id, dto) {
        if (!Number.isFinite(dto.total_hours) || dto.total_hours < 0) {
            throw new common_1.BadRequestException('total_hours must be zero or greater');
        }
        const existing = await this.findTimesheetOrThrow(user, id);
        await this.assertNotInvoiced(existing.id);
        const checkInTime = this.parseOptionalDate(dto.check_in_time, 'check_in_time') ?? existing.checkInTime;
        const checkOutTime = this.parseOptionalDate(dto.check_out_time, 'check_out_time') ?? existing.checkOutTime;
        if (checkOutTime < checkInTime) {
            throw new common_1.BadRequestException('check_out_time must be on or after check_in_time');
        }
        const previous = {
            checkInTime: existing.checkInTime,
            checkOutTime: existing.checkOutTime,
            totalHours: existing.totalHours,
            status: existing.status,
        };
        const timesheet = await this.prisma.timesheet.update({
            where: { id: existing.id },
            data: {
                checkInTime,
                checkOutTime,
                totalHours: Math.round(dto.total_hours * 10) / 10,
                status: 'corrected',
                approvedBy: null,
                approvedAt: null,
                rejectionReason: null,
            },
            include: this.timesheetInclude(),
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'TIMESHEET_CORRECTED',
            entityType: 'Timesheet',
            entityId: timesheet.id,
            details: JSON.stringify({
                previous,
                next: {
                    checkInTime: timesheet.checkInTime,
                    checkOutTime: timesheet.checkOutTime,
                    totalHours: timesheet.totalHours,
                    status: timesheet.status,
                },
                reason: dto.correction_reason?.trim() || null,
            }),
        });
        return this.mapTimesheet(timesheet);
    }
};
exports.TimesheetsService = TimesheetsService;
exports.TimesheetsService = TimesheetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], TimesheetsService);
//# sourceMappingURL=timesheets.service.js.map