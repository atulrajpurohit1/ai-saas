import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CorrectTimesheetDto } from './dto/correct-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';

const TIMESHEET_STATUSES = ['pending', 'approved', 'rejected', 'corrected'] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

@Injectable()
export class TimesheetsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  isValidStatus(status: string): status is TimesheetStatus {
    return TIMESHEET_STATUSES.includes(status as TimesheetStatus);
  }

  private timesheetInclude() {
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
          branchId: true,
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
    } satisfies Prisma.TimesheetInclude;
  }

  private mapTimesheet(timesheet: any) {
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
            branchId: timesheet.shift.branchId,
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

  private timesheetBranchWhere(user: ActiveUser, requestedBranchId?: string | null): Prisma.TimesheetWhereInput {
    const branchId = requestedBranchId?.trim() || null;

    if (user.isSuperAdmin) {
      return branchId ? { shift: { branchId } } : {};
    }

    if (!user.branchId) {
      return { id: '__no_branch_access__' };
    }

    if (branchId && branchId !== user.branchId) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    return { shift: { branchId: user.branchId } };
  }

  private async findTimesheetOrThrow(user: ActiveUser, id: string) {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.timesheetBranchWhere(user),
      },
      include: this.timesheetInclude(),
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    return timesheet;
  }

  private async assertNotInvoiced(id: string) {
    const invoiceItemCount = await this.prisma.invoiceItem.count({
      where: { timesheetId: id },
    });

    if (invoiceItemCount > 0) {
      throw new BadRequestException('Timesheet has already been used for an invoice');
    }
  }

  private parseOptionalDate(value: string | undefined, fieldName: string) {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return parsed;
  }

  async findAllForAdmin(user: ActiveUser, status?: string, requestedBranchId?: string | null) {
    if (status && !this.isValidStatus(status)) {
      throw new BadRequestException('Invalid timesheet status');
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

  async findOneForAdmin(user: ActiveUser, id: string) {
    const timesheet = await this.findTimesheetOrThrow(user, id);
    return this.mapTimesheet(timesheet);
  }

  async approve(user: ActiveUser, timesheetId: string) {
    const existing = await this.findTimesheetOrThrow(user, timesheetId);

    if (user.role === 'guard' || user.guardId === existing.guardId || user.sub === existing.guardId) {
      throw new ForbiddenException('Guard cannot approve own timesheet');
    }

    if (existing.status === 'approved') {
      return this.mapTimesheet(existing);
    }

    await this.assertNotInvoiced(existing.id);

    if (existing.totalHours <= 0) {
      throw new BadRequestException('Timesheet must have billable hours before approval. Correct the hours first.');
    }

    if (!['pending', 'corrected'].includes(existing.status)) {
      throw new BadRequestException('Only pending or corrected timesheets can be approved');
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
      details: `Approved ${timesheet.totalHours}h for guard "${this.guardLabel(timesheet)}" at "${this.siteLabel(timesheet)}"`,
    });

    return this.mapTimesheet(timesheet);
  }

  async reject(user: ActiveUser, id: string, dto: RejectTimesheetDto) {
    const reason = dto.rejection_reason?.trim();
    if (!reason) {
      throw new BadRequestException('rejection_reason is required');
    }

    const existing = await this.findTimesheetOrThrow(user, id);
    await this.assertNotInvoiced(existing.id);

    if (!['pending', 'corrected'].includes(existing.status)) {
      throw new BadRequestException('Only pending or corrected timesheets can be rejected');
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
      details: `Rejected timesheet for guard "${this.guardLabel(timesheet)}": ${reason}`,
    });

    return this.mapTimesheet(timesheet);
  }

  async correct(user: ActiveUser, id: string, dto: CorrectTimesheetDto) {
    if (!Number.isFinite(dto.total_hours) || dto.total_hours < 0) {
      throw new BadRequestException('total_hours must be zero or greater');
    }

    const existing = await this.findTimesheetOrThrow(user, id);
    await this.assertNotInvoiced(existing.id);

    const checkInTime = this.parseOptionalDate(dto.check_in_time, 'check_in_time') ?? existing.checkInTime;
    const checkOutTime = this.parseOptionalDate(dto.check_out_time, 'check_out_time') ?? existing.checkOutTime;

    if (checkOutTime < checkInTime) {
      throw new BadRequestException('check_out_time must be on or after check_in_time');
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

  private guardLabel(timesheet: any) {
    return timesheet.guard?.name || timesheet.guardId || 'Unknown guard';
  }

  private siteLabel(timesheet: any) {
    return timesheet.site?.name || timesheet.siteId || 'Unknown site';
  }
}
