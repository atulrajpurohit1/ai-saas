import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { TimesheetsService } from './timesheets.service';

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let prisma: {
    timesheet: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
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
        findMany: jest.fn(),
        update: jest.fn(),
      },
      invoiceItem: {
        count: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new TimesheetsService(prisma as unknown as PrismaService, auditService as unknown as AuditService);
  });

  const adminUser: ActiveUser = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: 'admin',
    branchId: 'branch-1',
    isSuperAdmin: false,
  };

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
          branchId: 'branch-1',
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
      service.approve(adminUser, 'timesheet-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.approve(adminUser, 'timesheet-1'),
    ).rejects.toThrow('Timesheet must have billable hours before approval. Correct the hours first.');
    expect(prisma.timesheet.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('limits branch admins to their branch only', async () => {
    prisma.timesheet.findMany.mockResolvedValue([]);

    await service.findAllForAdmin(adminUser, 'pending');

    expect(prisma.timesheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'pending',
          shift: { branchId: 'branch-1' },
        }),
      }),
    );
  });

  it('blocks branch admins from requesting another branch', async () => {
    await expect(
      service.findAllForAdmin(adminUser, 'pending', 'branch-2'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not approve an already invoiced timesheet', async () => {
    prisma.timesheet.findFirst.mockResolvedValue({
      id: 'timesheet-1',
      tenantId: 'tenant-1',
      guardId: 'guard-1',
      shiftId: 'shift-1',
      siteId: 'site-1',
      clientId: 'client-1',
      checkInTime: new Date('2026-05-25T17:28:00.000Z'),
      checkOutTime: new Date('2026-05-25T21:28:00.000Z'),
      totalHours: 4,
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: new Date('2026-05-25T17:28:00.000Z'),
      guard: { id: 'guard-1', name: 'Guard One', email: null, phone: null },
      shift: {
        id: 'shift-1',
        branchId: 'branch-1',
        startTime: new Date('2026-05-25T17:00:00.000Z'),
        endTime: new Date('2026-05-25T21:00:00.000Z'),
        status: 'completed',
      },
      site: { id: 'site-1', name: 'Site One', address: '100 Main St' },
      client: { id: 'client-1', name: 'Client One', companyName: null, email: 'client@example.com' },
    });
    prisma.invoiceItem.count.mockResolvedValue(1);

    await expect(
      service.approve(adminUser, 'timesheet-1'),
    ).rejects.toThrow('Timesheet has already been used for an invoice');
    expect(prisma.timesheet.update).not.toHaveBeenCalled();
  });
});
