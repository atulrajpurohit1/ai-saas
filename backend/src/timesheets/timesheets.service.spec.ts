import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimesheetsService } from './timesheets.service';

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let prisma: {
    timesheet: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    invoiceItem: {
      count: jest.Mock;
    };
  };
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      timesheet: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      invoiceItem: {
        count: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new TimesheetsService(prisma as unknown as PrismaService, auditService as unknown as AuditService);
  });

  it('does not approve a zero-hour timesheet', async () => {
    prisma.timesheet.findFirst.mockResolvedValue({
      id: 'timesheet-1',
      tenantId: 'tenant-1',
      guardId: 'guard-1',
      shiftId: 'shift-1',
      siteId: 'site-1',
      clientId: 'client-1',
      checkInTime: new Date('2026-05-25T17:28:00.000Z'),
      checkOutTime: new Date('2026-05-25T17:28:00.000Z'),
      totalHours: 0,
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: new Date('2026-05-25T17:28:00.000Z'),
      guard: {
        id: 'guard-1',
        name: 'Guard One',
        email: null,
        phone: null,
      },
      shift: {
        id: 'shift-1',
        startTime: new Date('2026-05-25T19:24:00.000Z'),
        endTime: new Date('2026-05-26T03:24:00.000Z'),
        status: 'completed',
      },
      site: {
        id: 'site-1',
        name: 'Site One',
        address: '100 Main St',
      },
      client: {
        id: 'client-1',
        name: 'Client One',
        companyName: null,
        email: 'client@example.com',
      },
    });

    await expect(
      service.approve({
        tenantId: 'tenant-1',
        userId: 'admin-1',
        userRole: 'admin',
        timesheetId: 'timesheet-1',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.approve({
        tenantId: 'tenant-1',
        userId: 'admin-1',
        userRole: 'admin',
        timesheetId: 'timesheet-1',
      }),
    ).rejects.toThrow('Timesheet must have billable hours before approval. Correct the hours first.');
    expect(prisma.timesheet.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
