import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ReportsService } from './reports.service';
import { ReportDeliveryScheduler } from './report-delivery.scheduler';

describe('ReportDeliveryScheduler', () => {
  let scheduler: ReportDeliveryScheduler;
  let prisma: {
    dailyServiceReport: { findMany: jest.Mock; update: jest.Mock };
  };
  let reports: { deliverReportByEmail: jest.Mock };
  let entitlements: { hasModule: jest.Mock };

  const pendingReport = (id: string, tenantId = 'tenant-1') => ({
    id,
    tenantId,
    client: { id: 'c1', email: 'ops@example.com', reportEmailEnabled: true },
    site: { id: 's1', name: 'Depot' },
  });

  beforeEach(async () => {
    prisma = {
      dailyServiceReport: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    reports = {
      deliverReportByEmail: jest.fn().mockResolvedValue({ sent: true }),
    };
    entitlements = { hasModule: jest.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportDeliveryScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportsService, useValue: reports },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    scheduler = moduleRef.get(ReportDeliveryScheduler);
  });

  it('only picks up published reports set to automatic that have not been sent', async () => {
    await scheduler.deliverPending();

    expect(prisma.dailyServiceReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'published',
          emailSentAt: null,
          client: {
            reportEmailEnabled: true,
            reportEmailMode: 'AUTOMATIC',
          },
        }),
      }),
    );
  });

  it('sends each pending report and stamps it', async () => {
    prisma.dailyServiceReport.findMany.mockResolvedValue([
      pendingReport('r1'),
      pendingReport('r2'),
    ]);

    const result = await scheduler.deliverPending();

    expect(result).toEqual({ considered: 2, sent: 2 });
    expect(reports.deliverReportByEmail).toHaveBeenCalledTimes(2);
    expect(prisma.dailyServiceReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: { emailSentAt: expect.any(Date) },
      }),
    );
  });

  // Stamping on failure would silently drop the report forever.
  it('leaves a failed send unstamped so the next sweep retries it', async () => {
    prisma.dailyServiceReport.findMany.mockResolvedValue([pendingReport('r1')]);
    reports.deliverReportByEmail.mockResolvedValue({
      sent: false,
      error: 'smtp down',
    });

    const result = await scheduler.deliverPending();

    expect(result).toEqual({ considered: 1, sent: 0 });
    expect(prisma.dailyServiceReport.update).not.toHaveBeenCalled();
  });

  // A tenant that let Guard Tour lapse should stop emailing its clients.
  it('skips tenants without the Guard Tour service', async () => {
    prisma.dailyServiceReport.findMany.mockResolvedValue([pendingReport('r1')]);
    entitlements.hasModule.mockResolvedValue(false);

    const result = await scheduler.deliverPending();

    expect(result).toEqual({ considered: 1, sent: 0 });
    expect(reports.deliverReportByEmail).not.toHaveBeenCalled();
  });

  it('keeps going when one tenant is unentitled', async () => {
    prisma.dailyServiceReport.findMany.mockResolvedValue([
      pendingReport('r1', 'lapsed-tenant'),
      pendingReport('r2', 'good-tenant'),
    ]);
    entitlements.hasModule.mockImplementation((tenantId: string) =>
      Promise.resolve(tenantId === 'good-tenant'),
    );

    const result = await scheduler.deliverPending();

    expect(result).toEqual({ considered: 2, sent: 1 });
  });

  it('does nothing when there is nothing pending', async () => {
    await expect(scheduler.deliverPending()).resolves.toEqual({
      considered: 0,
      sent: 0,
    });
    expect(reports.deliverReportByEmail).not.toHaveBeenCalled();
  });

  // A slow sweep overlapping the next tick would double-send.
  it('does not start a second sweep while one is running', async () => {
    let release: () => void = () => undefined;
    prisma.dailyServiceReport.findMany.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = scheduler.sweep();
    await scheduler.sweep();
    expect(prisma.dailyServiceReport.findMany).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  // A throwing sweep must not leave the lock stuck and kill all future runs.
  it('releases the lock when a sweep throws', async () => {
    prisma.dailyServiceReport.findMany.mockRejectedValueOnce(
      new Error('db down'),
    );

    await expect(scheduler.sweep()).resolves.toBeUndefined();

    prisma.dailyServiceReport.findMany.mockResolvedValue([]);
    await scheduler.sweep();
    expect(prisma.dailyServiceReport.findMany).toHaveBeenCalledTimes(2);
  });
});
