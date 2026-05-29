import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftsService } from './shifts.service';

describe('ShiftsService smart guard recommendations', () => {
  let service: ShiftsService;
  let prisma: {
    shift: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update?: jest.Mock;
    };
    guard: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    availability: {
      findUnique: jest.Mock;
    };
    assignment?: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let aiService: { explainGuardRecommendation: jest.Mock };

  const tenantId = 'tenant-1';
  const userId = 'admin-1';
  const shiftId = 'shift-new';
  const siteId = 'site-1';
  const targetShift = {
    id: shiftId,
    tenantId,
    siteId,
    startTime: new Date('2026-06-20T08:00:00.000Z'),
    endTime: new Date('2026-06-20T16:00:00.000Z'),
    requiredGuards: 1,
    status: 'open',
    assignments: [],
    site: {
      id: siteId,
      name: 'Site A',
    },
  };

  beforeEach(() => {
    prisma = {
      shift: {
        findFirst: jest.fn().mockResolvedValue(targetShift),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      guard: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      availability: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    aiService = { explainGuardRecommendation: jest.fn().mockResolvedValue(null) };
    service = new ShiftsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      aiService as unknown as AiService,
    );
  });

  it('ranks guards by availability, site experience, attendance, incidents, and workload', async () => {
    prisma.guard.findMany.mockResolvedValue([
      guard('guard-ramesh', 'Ramesh'),
      guard('guard-smith', 'Smith'),
    ]);
    prisma.shift.findMany.mockResolvedValue([
      pastShift('past-site-1', siteId, 'guard-ramesh', '2026-06-02T08:00:00.000Z', '2026-06-02T08:00:00.000Z'),
      pastShift('past-site-2', siteId, 'guard-ramesh', '2026-06-04T08:00:00.000Z', '2026-06-04T08:01:00.000Z'),
      pastShift('past-other-1', 'site-2', 'guard-smith', '2026-06-03T08:00:00.000Z', '2026-06-03T08:20:00.000Z'),
      pastShift('past-other-2', 'site-2', 'guard-smith', '2026-06-05T08:00:00.000Z', null, [
        { guardId: 'guard-smith' },
        { guardId: 'other-guard' },
      ]),
      upcomingShift('upcoming-1', 'guard-smith', '2026-06-21T08:00:00.000Z'),
      upcomingShift('upcoming-2', 'guard-smith', '2026-06-22T08:00:00.000Z'),
      upcomingShift('upcoming-3', 'guard-smith', '2026-06-23T08:00:00.000Z'),
      upcomingShift('upcoming-4', 'guard-smith', '2026-06-24T08:00:00.000Z'),
      upcomingShift('upcoming-5', 'guard-smith', '2026-06-25T08:00:00.000Z'),
    ]);

    const recommendations = await service.recommendGuards(userId, tenantId, shiftId);

    expect(recommendations[0]).toEqual(
      expect.objectContaining({
        guard_id: 'guard-ramesh',
        guard_name: 'Ramesh',
        score: 80,
      }),
    );
    expect(recommendations[0].reasons).toEqual(
      expect.arrayContaining([
        'Available for this shift (+30).',
        'Previously worked 2 shifts at this site (+20).',
        'Strong attendance history at 100% (+20).',
      ]),
    );
    expect(recommendations[1].guard_id).toBe('guard-smith');
    expect(recommendations[1].warnings).toEqual(
      expect.arrayContaining([
        'No prior experience at this site.',
        'Attendance history is 50%.',
        '5 upcoming shifts in the next 7 days (-20).',
      ]),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GUARD_RECOMMENDATIONS_GENERATED',
        tenantId,
        entityId: shiftId,
      }),
    );
  });

  it('excludes guards unavailable for the shift window', async () => {
    prisma.guard.findMany.mockResolvedValue([
      guard('guard-available', 'Available Guard'),
      {
        ...guard('guard-unavailable', 'Unavailable Guard'),
        availability: {
          status: 'unavailable',
          startDate: null,
          endDate: null,
        },
      },
    ]);

    const recommendations = await service.recommendGuards(userId, tenantId, shiftId);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].guard_id).toBe('guard-available');
  });

  it('logs when a recommended guard is assigned', async () => {
    prisma.shift.findUnique.mockResolvedValue({
      id: shiftId,
      tenantId,
      assignments: [],
    });
    prisma.guard.findUnique.mockResolvedValue({
      id: 'guard-ramesh',
      tenantId,
      name: 'Ramesh',
    });
    prisma.availability.findUnique.mockResolvedValue(null);
    prisma.guard.findMany.mockResolvedValue([guard('guard-ramesh', 'Ramesh')]);
    prisma.shift.findMany.mockResolvedValue([
      pastShift('past-site-1', siteId, 'guard-ramesh', '2026-06-02T08:00:00.000Z', '2026-06-02T08:00:00.000Z'),
    ]);

    const tx = {
      assignment: {
        create: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          shiftId,
          guardId: 'guard-ramesh',
          status: 'pending',
        }),
      },
      shift: {
        update: jest.fn().mockResolvedValue({ id: shiftId, status: 'assigned' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx));

    await service.assign(userId, tenantId, shiftId, 'guard-ramesh');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECOMMENDED_GUARD_ASSIGNED',
        tenantId,
        entityId: shiftId,
        details: expect.stringContaining('score'),
      }),
    );
  });

  function guard(id: string, name: string) {
    return {
      id,
      name,
      tenantId,
      phone: null,
      email: null,
      passwordHash: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      availability: {
        status: 'available',
        startDate: null,
        endDate: null,
      },
    };
  }

  function pastShift(
    id: string,
    shiftSiteId: string,
    guardId: string,
    startTime: string,
    checkInTime: string | null,
    assignments = [{ guardId }],
  ) {
    return {
      id,
      tenantId,
      siteId: shiftSiteId,
      startTime: new Date(startTime),
      endTime: new Date(new Date(startTime).getTime() + 8 * 60 * 60 * 1000),
      requiredGuards: 1,
      status: 'completed',
      createdAt: new Date(startTime),
      assignments,
      attendanceEvents: checkInTime
        ? [
            {
              guardId,
              type: 'CHECK_IN',
              timestamp: new Date(checkInTime),
            },
          ]
        : [],
      incidents: [],
    };
  }

  function upcomingShift(id: string, guardId: string, startTime: string) {
    return {
      id,
      tenantId,
      siteId: 'site-2',
      startTime: new Date(startTime),
      endTime: new Date(new Date(startTime).getTime() + 8 * 60 * 60 * 1000),
      requiredGuards: 1,
      status: 'assigned',
      createdAt: new Date(startTime),
      assignments: [{ guardId }],
      attendanceEvents: [],
      incidents: [],
    };
  }
});
