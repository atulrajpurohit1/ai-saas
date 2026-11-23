import { AuditService } from '../audit/audit.service';
import { RecommendationService } from '../ai-insights/recommendation.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { EmailService } from '../email/email.service';
import { ShiftsService } from './shifts.service';

// Declared separately so the $transaction callback can be annotated without
// `tx` referencing its own type (TS2502).
type MockShiftTx = {
  assignment: { create: jest.Mock; count?: jest.Mock; deleteMany?: jest.Mock };
  shift: { update: jest.Mock };
};

describe('ShiftsService smart guard recommendations', () => {
  let service: ShiftsService;
  let prisma: {
    shift: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update?: jest.Mock;
    };
    guard: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    availability: {
      findUnique: jest.Mock;
    };
    assignment: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    site?: { findFirst: jest.Mock };
    attendanceEvent?: { count: jest.Mock };
    patrolRun?: { count: jest.Mock };
    timesheet?: { count: jest.Mock };
    invoiceItem?: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let aiService: { explainGuardRecommendation: jest.Mock };
  let webhooksService: { triggerEvent: jest.Mock };
  let emailService: { sendShiftAssignmentEmail: jest.Mock };
  let recommendationService: RecommendationService;

  const tenantId = 'tenant-1';
  const userId = 'admin-1';
  const activeUser = { sub: userId, tenantId, role: 'admin' } as any;
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
        create: jest.fn(),
      },
      guard: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      availability: {
        findUnique: jest.fn(),
      },
      assignment: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      site: { findFirst: jest.fn() },
      attendanceEvent: { count: jest.fn().mockResolvedValue(0) },
      patrolRun: { count: jest.fn().mockResolvedValue(0) },
      timesheet: { count: jest.fn().mockResolvedValue(0) },
      invoiceItem: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    aiService = {
      explainGuardRecommendation: jest.fn().mockResolvedValue(null),
    };
    webhooksService = { triggerEvent: jest.fn().mockResolvedValue(undefined) };
    emailService = {
      sendShiftAssignmentEmail: jest.fn().mockResolvedValue({
        messageId: 'mail-1',
        previewUrl: false,
      }),
    };
    recommendationService = new RecommendationService(
      prisma as unknown as PrismaService,
      aiService as unknown as AiService,
    );
    service = new ShiftsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      recommendationService,
      webhooksService as unknown as WebhooksService,
      emailService as unknown as EmailService,
    );
  });

  it('ranks guards by availability, site experience, attendance, incidents, and workload', async () => {
    prisma.guard.findMany.mockResolvedValue([
      guard('guard-ramesh', 'Ramesh'),
      guard('guard-smith', 'Smith'),
    ]);
    prisma.shift.findMany.mockResolvedValue([
      pastShift(
        'past-site-1',
        siteId,
        'guard-ramesh',
        '2026-06-02T08:00:00.000Z',
        '2026-06-02T08:00:00.000Z',
      ),
      pastShift(
        'past-site-2',
        siteId,
        'guard-ramesh',
        '2026-06-04T08:00:00.000Z',
        '2026-06-04T08:01:00.000Z',
      ),
      pastShift(
        'past-other-1',
        'site-2',
        'guard-smith',
        '2026-06-03T08:00:00.000Z',
        '2026-06-03T08:20:00.000Z',
      ),
      pastShift(
        'past-other-2',
        'site-2',
        'guard-smith',
        '2026-06-05T08:00:00.000Z',
        null,
        [{ guardId: 'guard-smith' }, { guardId: 'other-guard' }],
      ),
      upcomingShift('upcoming-1', 'guard-smith', '2026-06-21T08:00:00.000Z'),
      upcomingShift('upcoming-2', 'guard-smith', '2026-06-22T08:00:00.000Z'),
      upcomingShift('upcoming-3', 'guard-smith', '2026-06-23T08:00:00.000Z'),
      upcomingShift('upcoming-4', 'guard-smith', '2026-06-24T08:00:00.000Z'),
      upcomingShift('upcoming-5', 'guard-smith', '2026-06-25T08:00:00.000Z'),
    ]);

    const recommendations = await service.recommendGuards(activeUser, shiftId);

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

    const recommendations = await service.recommendGuards(activeUser, shiftId);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].guard_id).toBe('guard-available');
  });

  it('logs when a recommended guard is assigned', async () => {
    prisma.shift.findUnique.mockResolvedValue({
      id: shiftId,
      tenantId,
      assignments: [],
    });
    prisma.guard.findFirst.mockResolvedValue({
      id: 'guard-ramesh',
      tenantId,
      name: 'Ramesh',
    });
    prisma.availability.findUnique.mockResolvedValue(null);
    prisma.guard.findMany.mockResolvedValue([guard('guard-ramesh', 'Ramesh')]);
    prisma.shift.findMany.mockResolvedValue([
      pastShift(
        'past-site-1',
        siteId,
        'guard-ramesh',
        '2026-06-02T08:00:00.000Z',
        '2026-06-02T08:00:00.000Z',
      ),
    ]);

    const tx = {
      assignment: {
        create: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          shiftId,
          guardId: 'guard-ramesh',
          status: 'confirmed',
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      shift: {
        update: jest
          .fn()
          .mockResolvedValue({ id: shiftId, status: 'assigned' }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (tx: MockShiftTx) => Promise<unknown>) => callback(tx),
    );

    await service.assign(activeUser, shiftId, 'guard-ramesh');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECOMMENDED_GUARD_ASSIGNED',
        tenantId,
        entityId: shiftId,
        details: expect.stringContaining('score'),
      }),
    );
  });

  it('refuses to assign a deactivated guard', async () => {
    prisma.guard.findFirst.mockResolvedValue({
      id: 'guard-left',
      tenantId,
      name: 'Left',
      deactivatedAt: new Date('2026-06-10T00:00:00.000Z'),
    });

    await expect(
      service.assign(activeUser, shiftId, 'guard-left'),
    ).rejects.toThrow('Guard has been deactivated');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('only recommends active guards', async () => {
    await service.recommendGuards(activeUser, shiftId);

    expect(prisma.guard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, deactivatedAt: null }),
      }),
    );
  });

  describe('site guard auto assignment', () => {
    const futureShift = {
      ...targetShift,
      startTime: new Date('2027-06-20T08:00:00.000Z'),
      endTime: new Date('2027-06-20T16:00:00.000Z'),
      requiredGuards: 2,
      assignments: [],
      site: {
        id: siteId,
        name: 'Site A',
        address: '1 Main Street',
        autoAssignGuards: true,
      },
    };

    it('fills every open slot from the ranked guard list', async () => {
      prisma.shift.findFirst.mockResolvedValue(futureShift);
      jest
        .spyOn(recommendationService, 'recommendGuards')
        .mockResolvedValue([
          recommendation('guard-one', 'Guard One', 90),
          recommendation('guard-two', 'Guard Two', 80),
          recommendation('guard-three', 'Guard Three', 70),
        ]);
      const assign = jest
        .spyOn(service, 'assign')
        .mockResolvedValue({ id: 'assignment' } as any);

      const result = await service.autoAssignShift(activeUser, shiftId);

      expect(assign).toHaveBeenCalledTimes(2);
      expect(assign).toHaveBeenNthCalledWith(
        1,
        activeUser,
        shiftId,
        'guard-one',
        expect.objectContaining({ automatic: true }),
      );
      expect(assign).toHaveBeenNthCalledWith(
        2,
        activeUser,
        shiftId,
        'guard-two',
        expect.objectContaining({ automatic: true }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          requestedSlots: 2,
          assignedCount: 2,
          remainingSlots: 0,
        }),
      );
    });

    it('skips a rejected candidate and continues with the next guard', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...futureShift,
        requiredGuards: 1,
      });
      jest
        .spyOn(recommendationService, 'recommendGuards')
        .mockResolvedValue([
          recommendation('guard-busy', 'Busy Guard', 90),
          recommendation('guard-free', 'Free Guard', 80),
        ]);
      const assign = jest
        .spyOn(service, 'assign')
        .mockRejectedValueOnce(new Error('overlapping shift'))
        .mockResolvedValueOnce({ id: 'assignment' } as any);

      const result = await service.autoAssignShift(activeUser, shiftId);

      expect(assign).toHaveBeenCalledTimes(2);
      expect(result.assignments).toEqual([
        { guardId: 'guard-free', guardName: 'Free Guard' },
      ]);
      expect(result.remainingSlots).toBe(0);
    });

    it('does nothing when the site toggle is off', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...futureShift,
        site: { ...futureShift.site, autoAssignGuards: false },
      });
      const recommend = jest.spyOn(recommendationService, 'recommendGuards');

      const result = await service.autoAssignShift(activeUser, shiftId);

      expect(recommend).not.toHaveBeenCalled();
      expect(result.assignedCount).toBe(0);
      expect(result.remainingSlots).toBe(2);
    });

    it('requires portal access for an automatic assignment', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...futureShift,
        requiredGuards: 1,
      });
      prisma.guard.findFirst.mockResolvedValue({
        id: 'guard-no-login',
        tenantId,
        name: 'No Login',
        deactivatedAt: null,
        passwordHash: null,
      });

      await expect(
        service.assign(activeUser, shiftId, 'guard-no-login', {
          automatic: true,
          recommendation: recommendation('guard-no-login', 'No Login', 90),
        }),
      ).rejects.toThrow('does not have portal access');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an overlapping shift during automatic assignment', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...futureShift,
        requiredGuards: 1,
      });
      prisma.guard.findFirst.mockResolvedValue({
        id: 'guard-busy',
        tenantId,
        name: 'Busy Guard',
        deactivatedAt: null,
        passwordHash: 'hash',
      });
      prisma.availability.findUnique.mockResolvedValue(null);
      prisma.assignment.findFirst.mockResolvedValue({ id: 'overlap' });

      await expect(
        service.assign(activeUser, shiftId, 'guard-busy', {
          automatic: true,
          recommendation: recommendation('guard-busy', 'Busy Guard', 90),
        }),
      ).rejects.toThrow('overlapping shift');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('runs automatic assignment after creating a shift at an enabled site', async () => {
      prisma.site!.findFirst.mockResolvedValue({
        id: siteId,
        name: 'Site A',
        branchId: null,
        autoAssignGuards: true,
      });
      prisma.shift.create.mockResolvedValue({
        id: shiftId,
        siteId,
        startTime: futureShift.startTime,
        endTime: futureShift.endTime,
        requiredGuards: 1,
        site: { name: 'Site A' },
      });
      const autoAssign = jest
        .spyOn(service, 'autoAssignShift')
        .mockResolvedValue({
          shiftId,
          requestedSlots: 1,
          assignedCount: 1,
          remainingSlots: 0,
          assignments: [{ guardId: 'guard-one', guardName: 'Guard One' }],
        });

      await service.create(activeUser, {
        siteId,
        startTime: futureShift.startTime.toISOString(),
        endTime: futureShift.endTime.toISOString(),
        requiredGuards: 1,
      });

      expect(autoAssign).toHaveBeenCalledWith(activeUser, shiftId);
    });
  });

  /**
   * Multi-guard staffing. A shift takes up to `requiredGuards` distinct
   * guards; the shift only reads `assigned` once every slot is filled, and
   * each guard can be removed on their own.
   */
  describe('multi-guard staffing', () => {
    const twoGuardShift = {
      ...targetShift,
      requiredGuards: 2,
      assignments: [{ id: 'assignment-1', shiftId, guardId: 'guard-ramesh' }],
    };

    const txWith = (assignedAfter: number) => {
      const tx = {
        assignment: {
          create: jest.fn().mockResolvedValue({
            id: 'assignment-2',
            shiftId,
            guardId: 'guard-smith',
            status: 'confirmed',
          }),
          count: jest.fn().mockResolvedValue(assignedAfter),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        shift: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(
        async (callback: (tx: MockShiftTx) => Promise<unknown>) => callback(tx),
      );
      return tx;
    };

    beforeEach(() => {
      prisma.guard.findFirst.mockResolvedValue({
        id: 'guard-smith',
        tenantId,
        name: 'Smith',
      });
      prisma.availability.findUnique.mockResolvedValue(null);
    });

    it('accepts a second guard and marks the shift assigned once full', async () => {
      prisma.shift.findFirst.mockResolvedValue(twoGuardShift);
      const tx = txWith(2);

      await service.assign(activeUser, shiftId, 'guard-smith');

      expect(tx.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guardId: 'guard-smith',
            status: 'confirmed',
          }),
        }),
      );
      expect(tx.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'assigned' } }),
      );
    });

    it('leaves the shift open while slots remain', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...twoGuardShift,
        requiredGuards: 3,
      });
      const tx = txWith(2);

      await service.assign(activeUser, shiftId, 'guard-smith');

      expect(tx.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'open' } }),
      );
    });

    it('rejects a guard who is already on the shift', async () => {
      prisma.shift.findFirst.mockResolvedValue(twoGuardShift);
      prisma.guard.findFirst.mockResolvedValue({
        id: 'guard-ramesh',
        tenantId,
        name: 'Ramesh',
      });

      await expect(
        service.assign(activeUser, shiftId, 'guard-ramesh'),
      ).rejects.toThrow('already assigned to this shift');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects assignment to a fully staffed shift', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...twoGuardShift,
        requiredGuards: 1,
      });

      await expect(
        service.assign(activeUser, shiftId, 'guard-smith'),
      ).rejects.toThrow('Shift is fully staffed');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not pull an in-progress shift back to a staffing state', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...twoGuardShift,
        status: 'in_progress',
      });
      const tx = txWith(2);

      await service.assign(activeUser, shiftId, 'guard-smith');

      expect(tx.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'in_progress' } }),
      );
    });

    it('unassigns one guard and reopens the shift', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...twoGuardShift,
        status: 'assigned',
        assignments: [
          {
            id: 'assignment-1',
            shiftId,
            guardId: 'guard-ramesh',
            guard: { name: 'Ramesh' },
          },
          {
            id: 'assignment-2',
            shiftId,
            guardId: 'guard-smith',
            guard: { name: 'Smith' },
          },
        ],
        attendanceEvents: [],
      });
      const tx = txWith(1);

      await service.unassign(activeUser, shiftId, 'guard-smith');

      expect(tx.assignment.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['assignment-2'] } },
      });
      expect(tx.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'open' } }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GUARD_UNASSIGNED',
          details: expect.stringContaining('Smith'),
        }),
      );
    });

    it('refuses to unassign a guard who has already checked in', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...twoGuardShift,
        status: 'in_progress',
        assignments: [
          {
            id: 'assignment-1',
            shiftId,
            guardId: 'guard-ramesh',
            guard: { name: 'Ramesh' },
          },
        ],
        attendanceEvents: [{ guardId: 'guard-ramesh' }],
      });

      await expect(
        service.unassign(activeUser, shiftId, 'guard-ramesh'),
      ).rejects.toThrow('already checked in');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reports attendance per assignment, not per shift', async () => {
      prisma.shift.findMany.mockResolvedValue([
        {
          ...twoGuardShift,
          status: 'in_progress',
          assignments: [
            {
              id: 'assignment-1',
              shiftId,
              guardId: 'guard-ramesh',
              guard: { id: 'guard-ramesh', name: 'Ramesh' },
            },
            {
              id: 'assignment-2',
              shiftId,
              guardId: 'guard-smith',
              guard: { id: 'guard-smith', name: 'Smith' },
            },
          ],
          attendanceEvents: [
            {
              guardId: 'guard-ramesh',
              type: 'CHECK_IN',
              timestamp: new Date('2026-06-20T08:01:00.000Z'),
            },
          ],
        },
      ]);

      const [shift] = await service.findAll(activeUser);

      expect(shift).not.toHaveProperty('attendanceStatus');
      expect(shift.assignments[0]).toEqual(
        expect.objectContaining({
          guardId: 'guard-ramesh',
          attendanceStatus: 'checked_in',
        }),
      );
      expect(shift.assignments[1]).toEqual(
        expect.objectContaining({
          guardId: 'guard-smith',
          attendanceStatus: 'not_started',
          checkInTime: null,
        }),
      );
    });
  });

  /**
   * No-shows. If an assigned guard never checked in, the shift used to sit
   * `assigned` forever: nothing went red and nobody was told.
   */
  describe('no-show detection', () => {
    const listWith = (startTime: Date, checkedIn: boolean) => {
      prisma.shift.findMany.mockResolvedValue([
        {
          ...targetShift,
          startTime,
          assignments: [
            {
              id: 'assignment-1',
              guardId: 'guard-ramesh',
              guard: { id: 'guard-ramesh', name: 'Ramesh' },
            },
          ],
          attendanceEvents: checkedIn
            ? [
                {
                  guardId: 'guard-ramesh',
                  type: 'CHECK_IN',
                  timestamp: new Date(startTime.getTime() + 60_000),
                },
              ]
            : [],
        },
      ]);
      return service.findAll(activeUser);
    };

    it('flags a guard who is overdue and has not checked in', async () => {
      const [shift] = await listWith(
        new Date(Date.now() - 60 * 60 * 1000),
        false,
      );

      expect(shift.assignments[0].noShow).toBe(true);
    });

    it('does not flag a guard who is only a few minutes late', async () => {
      const [shift] = await listWith(
        new Date(Date.now() - 5 * 60 * 1000),
        false,
      );

      expect(shift.assignments[0].noShow).toBe(false);
    });

    // The whole reason it is derived: a late guard who finally arrives must
    // stop being a no-show with no job to clear a stored flag.
    it('clears once the late guard checks in', async () => {
      const [shift] = await listWith(
        new Date(Date.now() - 60 * 60 * 1000),
        true,
      );

      expect(shift.assignments[0].noShow).toBe(false);
    });

    it('does not flag a shift that has not started', async () => {
      const [shift] = await listWith(
        new Date(Date.now() + 60 * 60 * 1000),
        false,
      );

      expect(shift.assignments[0].noShow).toBe(false);
    });
  });

  /**
   * Telling the guard. Assignment "notification" used to be a console.log, so
   * a guard had to log in on their own and notice they had been rostered.
   */
  describe('guard notification', () => {
    const shiftWithSite = {
      ...targetShift,
      requiredGuards: 2,
      assignments: [],
      site: { id: siteId, name: 'Site A', address: '1 Dock Road' },
    };

    const runAssign = (guardOverrides: Record<string, unknown> = {}) => {
      prisma.shift.findFirst.mockResolvedValue(shiftWithSite);
      prisma.guard.findFirst.mockResolvedValue({
        id: 'guard-smith',
        tenantId,
        name: 'Smith',
        email: 'smith@example.com',
        ...guardOverrides,
      });
      prisma.availability.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(
        async (callback: (tx: MockShiftTx) => Promise<unknown>) =>
          callback({
            assignment: {
              create: jest.fn().mockResolvedValue({ id: 'assignment-2' }),
              count: jest.fn().mockResolvedValue(1),
            },
            shift: { update: jest.fn().mockResolvedValue({}) },
          }),
      );
      return service.assign(activeUser, shiftId, 'guard-smith');
    };

    it('emails the guard the site, address and times on assignment', async () => {
      await runAssign();

      expect(emailService.sendShiftAssignmentEmail).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          email: 'smith@example.com',
          guardName: 'Smith',
          siteName: 'Site A',
          siteAddress: '1 Dock Road',
          startTime: targetShift.startTime,
          endTime: targetShift.endTime,
          change: 'assigned',
        }),
      );
    });

    it('records that a guard with no email could not be told', async () => {
      await runAssign({ email: null });

      expect(emailService.sendShiftAssignmentEmail).not.toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GUARD_NOTIFY_SKIPPED',
          details: expect.stringContaining('no email address'),
        }),
      );
    });

    // The roster change is already committed when the mail is sent, so a dead
    // mail server must never surface to the scheduler as a failed assignment.
    it('does not fail the assignment when the email fails', async () => {
      emailService.sendShiftAssignmentEmail.mockRejectedValue(
        new Error('smtp down'),
      );

      await expect(runAssign()).resolves.toEqual(
        expect.objectContaining({ id: 'assignment-2' }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GUARD_NOTIFY_FAILED',
          details: expect.stringContaining('smtp down'),
        }),
      );
    });
  });

  /**
   * Editing and deleting. Without these, a typo in the end time meant
   * creating a second shift and leaving the wrong one in the list forever.
   */
  describe('update and delete', () => {
    const editable = {
      ...targetShift,
      requiredGuards: 2,
      status: 'assigned',
      assignments: [
        {
          id: 'assignment-1',
          guardId: 'guard-ramesh',
          guard: {
            id: 'guard-ramesh',
            name: 'Ramesh',
            email: 'ramesh@example.com',
          },
        },
      ],
      site: { name: 'Site A', address: '1 Dock Road' },
      attendanceEvents: [],
    };

    beforeEach(() => {
      prisma.shift.update = jest.fn().mockResolvedValue({
        id: shiftId,
        status: 'assigned',
        site: { name: 'Site A', autoAssignGuards: false },
      });
      (prisma as unknown as { shift: { delete: jest.Mock } }).shift.delete =
        jest.fn().mockResolvedValue({ id: shiftId });
    });

    it('moves the times and tells the assigned guard', async () => {
      prisma.shift.findFirst.mockResolvedValue(editable);
      const newEnd = '2026-06-20T18:00:00.000Z';

      await service.update(activeUser, shiftId, { endTime: newEnd });

      expect(prisma.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endTime: new Date(newEnd) }),
        }),
      );
      expect(emailService.sendShiftAssignmentEmail).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          email: 'ramesh@example.com',
          change: 'updated',
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SHIFT_UPDATED',
          details: expect.stringContaining('end '),
        }),
      );
    });

    it('refuses a time change once a guard has checked in', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...editable,
        attendanceEvents: [{ id: 'ev-1' }],
      });

      await expect(
        service.update(activeUser, shiftId, {
          endTime: '2026-06-20T18:00:00.000Z',
        }),
      ).rejects.toThrow('can no longer be changed');
      expect(prisma.shift.update).not.toHaveBeenCalled();
    });

    it('still allows the headcount to change after check-in', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...editable,
        attendanceEvents: [{ id: 'ev-1' }],
      });

      await service.update(activeUser, shiftId, { requiredGuards: 3 });

      expect(prisma.shift.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requiredGuards: 3, status: 'open' }),
        }),
      );
      // Nothing moved, so nobody needs an email.
      expect(emailService.sendShiftAssignmentEmail).not.toHaveBeenCalled();
    });

    it('refuses to need fewer guards than are already assigned', async () => {
      prisma.shift.findFirst.mockResolvedValue({
        ...editable,
        assignments: [
          { id: 'a-1', guardId: 'g-1', guard: { id: 'g-1', name: 'A' } },
          { id: 'a-2', guardId: 'g-2', guard: { id: 'g-2', name: 'B' } },
        ],
      });

      await expect(
        service.update(activeUser, shiftId, { requiredGuards: 1 }),
      ).rejects.toThrow('Unassign someone');
    });

    it('refuses an end time that is not after the start', async () => {
      prisma.shift.findFirst.mockResolvedValue(editable);

      await expect(
        service.update(activeUser, shiftId, {
          endTime: '2026-06-20T07:00:00.000Z',
        }),
      ).rejects.toThrow('End time must be after the start time');
    });

    it('deletes a shift nothing has happened on', async () => {
      prisma.shift.findFirst.mockResolvedValue(editable);

      await expect(service.remove(activeUser, shiftId)).resolves.toEqual({
        id: shiftId,
        deleted: true,
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SHIFT_DELETED' }),
      );
    });

    // Every shift relation cascades, so deleting a worked shift would destroy
    // the attendance and the timesheet billed from it.
    it('refuses to delete a shift with attendance recorded', async () => {
      prisma.shift.findFirst.mockResolvedValue(editable);
      prisma.attendanceEvent!.count.mockResolvedValue(1);

      await expect(service.remove(activeUser, shiftId)).rejects.toThrow(
        'Unassign the guard instead',
      );
      expect(
        (prisma as unknown as { shift: { delete: jest.Mock } }).shift.delete,
      ).not.toHaveBeenCalled();
    });

    it('refuses to delete a shift that has been billed', async () => {
      prisma.shift.findFirst.mockResolvedValue(editable);
      prisma.invoiceItem!.count.mockResolvedValue(1);

      await expect(service.remove(activeUser, shiftId)).rejects.toThrow(
        'cannot be deleted',
      );
    });
  });

  function recommendation(guardId: string, guardName: string, score: number) {
    return {
      guard_id: guardId,
      guard_name: guardName,
      score,
      reasons: ['Available for this shift (+30).'],
      warnings: [],
      explanation: `${guardName} is available.`,
      metrics: {
        attendance_rate: 100,
        site_shifts: 0,
        late_check_ins: 0,
        missed_shifts: 0,
        incidents: 0,
        upcoming_workload: 0,
      },
    };
  }

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
