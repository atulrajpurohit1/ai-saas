import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { IncidentsService } from '../incidents/incidents.service';
import { PatrolsService } from '../patrols/patrols.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuardPortalService } from './guard-portal.service';

/**
 * Offline sync replay. Regression cover for actions that failed on the server
 * being dropped from the guard's queue and never retried: a failed action must
 * be retried on the next sync, a refused one reported as rejected, and two
 * overlapping syncs must not both apply the same action.
 */
describe('GuardPortalService offline sync', () => {
  const tenantId = 'tenant-1';
  const guardId = 'guard-1';

  let service: GuardPortalService;
  let prisma: {
    guardSyncQueue: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let patrols: { completePatrolRun: jest.Mock };

  const action = {
    id: 'action-1',
    actionType: 'patrol_run_complete',
    payload: { runId: 'run-1' },
    createdAt: '2026-10-09T08:00:00.000Z',
  };

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: action.id,
    tenantId,
    guardId,
    actionType: action.actionType,
    payload: action.payload,
    status: 'pending',
    errorMessage: null,
    retryCount: 0,
    createdAt: new Date(action.createdAt),
    updatedAt: new Date(),
    syncedAt: null,
    ...overrides,
  });

  const sync = () =>
    service.processSyncQueue(tenantId, guardId, { actions: [action] });

  beforeEach(() => {
    prisma = {
      guardSyncQueue: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(row()),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(row(data))),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    patrols = { completePatrolRun: jest.fn().mockResolvedValue({}) };

    service = new GuardPortalService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      {} as IncidentsService,
      patrols as unknown as PatrolsService,
    );
  });

  it('applies a new action and marks it synced', async () => {
    const [result] = await sync();

    expect(patrols.completePatrolRun).toHaveBeenCalledWith(
      tenantId,
      guardId,
      'run-1',
    );
    expect(result.status).toBe('synced');
  });

  it('marks a transient failure as failed so it is retried', async () => {
    patrols.completePatrolRun.mockRejectedValue(new Error('connection reset'));

    const [result] = await sync();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'failed',
        retryCount: 1,
        errorMessage: 'connection reset',
      }),
    );
  });

  it('marks a 4xx as rejected, since it will never succeed', async () => {
    patrols.completePatrolRun.mockRejectedValue(
      new NotFoundException('Patrol run not found'),
    );

    const [result] = await sync();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'rejected',
        errorMessage: 'Patrol run not found',
      }),
    );
  });

  it('retries a previously failed action when it is sent again', async () => {
    prisma.guardSyncQueue.findFirst.mockResolvedValue(
      row({ status: 'failed', retryCount: 1 }),
    );

    const [result] = await sync();

    expect(prisma.guardSyncQueue.create).not.toHaveBeenCalled();
    expect(prisma.guardSyncQueue.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: action.id }),
        data: { status: 'pending' },
      }),
    );
    expect(patrols.completePatrolRun).toHaveBeenCalled();
    expect(result.status).toBe('synced');
  });

  it('gives up after the last allowed attempt', async () => {
    prisma.guardSyncQueue.findFirst.mockResolvedValue(
      row({ status: 'failed', retryCount: 4 }),
    );
    patrols.completePatrolRun.mockRejectedValue(new Error('still down'));

    const [result] = await sync();

    expect(result).toEqual(
      expect.objectContaining({ status: 'rejected', retryCount: 5 }),
    );
  });

  it.each(['synced', 'rejected'])(
    'does not re-apply an action that is already %s',
    async (status) => {
      prisma.guardSyncQueue.findFirst.mockResolvedValue(row({ status }));

      const [result] = await sync();

      expect(patrols.completePatrolRun).not.toHaveBeenCalled();
      expect(result.status).toBe(status);
    },
  );

  it('does not apply an action another request has already claimed', async () => {
    prisma.guardSyncQueue.findFirst.mockResolvedValue(
      row({ status: 'failed' }),
    );
    prisma.guardSyncQueue.updateMany.mockResolvedValue({ count: 0 });

    const [result] = await sync();

    expect(patrols.completePatrolRun).not.toHaveBeenCalled();
    expect(result.status).toBe('in_progress');
  });

  it('does not apply an action another request created first', async () => {
    prisma.guardSyncQueue.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.guardSyncQueue.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row({ status: 'pending' }));

    const [result] = await sync();

    expect(patrols.completePatrolRun).not.toHaveBeenCalled();
    expect(result.status).toBe('in_progress');
  });

  it('rejects an unknown action type instead of retrying it', async () => {
    const [result] = await service.processSyncQueue(tenantId, guardId, {
      actions: [{ ...action, actionType: 'teleport' }],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'rejected',
        errorMessage: 'Unknown action type: teleport',
      }),
    );
  });
});

/**
 * Multi-guard check-out. The first guard to leave must not mark the whole
 * shift completed while a colleague is still on duty.
 */
describe('GuardPortalService check-out shift status', () => {
  const tenantId = 'tenant-1';
  const shiftId = 'shift-1';
  const checkInTime = new Date('2026-10-09T08:00:00.000Z');
  const checkOutTime = new Date('2026-10-09T16:00:00.000Z');

  let service: GuardPortalService;
  let tx: {
    attendanceEvent: { create: jest.Mock; count: jest.Mock };
    shift: { update: jest.Mock };
    timesheet: { upsert: jest.Mock };
  };

  const shiftFor = (guardId: string) => ({
    id: shiftId,
    tenantId,
    siteId: 'site-1',
    status: 'in_progress',
    startTime: checkInTime,
    endTime: checkOutTime,
    site: { id: 'site-1', clientId: 'client-1', name: 'Site A' },
    assignments: [{ id: `a-${guardId}`, guardId, guard: { name: guardId } }],
    attendanceEvents: [{ type: 'CHECK_IN', timestamp: checkInTime }],
  });

  beforeEach(() => {
    tx = {
      attendanceEvent: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'out-1', timestamp: checkOutTime }),
        count: jest.fn(),
      },
      shift: { update: jest.fn().mockResolvedValue({}) },
      timesheet: {
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'ts-1', status: 'pending', totalHours: 8 }),
      },
    };
    const prisma = {
      shift: { findFirst: jest.fn((args) => Promise.resolve(shiftFor(args.include.assignments.where.guardId))) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    service = new GuardPortalService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      {} as IncidentsService,
      {} as PatrolsService,
    );
  });

  it('keeps the shift in progress while another guard is still checked in', async () => {
    // Two guards checked in, this is the first check-out.
    tx.attendanceEvent.count
      .mockResolvedValueOnce(2) // CHECK_IN
      .mockResolvedValueOnce(1); // CHECK_OUT

    const result = await service.checkOut(tenantId, 'guard-1', shiftId);

    expect(tx.shift.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'in_progress' } }),
    );
    expect(result.shiftStatus).toBe('in_progress');
    expect(result.attendanceStatus).toBe('completed');
  });

  it('marks the shift completed once nobody is still on duty', async () => {
    tx.attendanceEvent.count
      .mockResolvedValueOnce(2) // CHECK_IN
      .mockResolvedValueOnce(2); // CHECK_OUT

    const result = await service.checkOut(tenantId, 'guard-2', shiftId);

    expect(tx.shift.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'completed' } }),
    );
    expect(result.shiftStatus).toBe('completed');
  });
});

/**
 * Check-in window. Before this, check-in validated only "not already checked
 * in", so a guard could check in to next Thursday's shift today and produce a
 * timesheet for any duration against any date.
 */
describe('GuardPortalService check-in window', () => {
  const tenantId = 'tenant-1';
  const guardId = 'guard-1';
  const shiftId = 'shift-1';
  // Shift runs 22:00 to 06:00; check-in opens at 21:00. Built from local
  // components, not a UTC string, because the messages a guard reads are
  // formatted in local time and these assertions must hold in any timezone.
  const startTime = new Date(2026, 10, 14, 22, 0, 0);
  const endTime = new Date(2026, 10, 15, 6, 0, 0);
  const localTime = (...parts: [number, number, number, number, number]) =>
    new Date(parts[0], parts[1], parts[2], parts[3], parts[4], 0);

  let service: GuardPortalService;
  let audit: { log: jest.Mock };
  let tx: {
    attendanceEvent: { create: jest.Mock; count: jest.Mock };
    shift: { update: jest.Mock };
    timesheet: { upsert: jest.Mock };
  };

  const at = (...parts: [number, number, number, number, number]) =>
    jest.setSystemTime(localTime(...parts));

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    tx = {
      attendanceEvent: {
        create: jest.fn(({ data }) =>
          Promise.resolve({ id: 'ev-1', timestamp: data.timestamp ?? new Date() }),
        ),
        count: jest.fn().mockResolvedValue(1),
      },
      shift: { update: jest.fn().mockResolvedValue({}) },
      timesheet: {
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'ts-1', status: 'pending', totalHours: 8 }),
      },
    };
    audit = { log: jest.fn() };
    const prisma = {
      shift: {
        findFirst: jest.fn().mockResolvedValue({
          id: shiftId,
          tenantId,
          siteId: 'site-1',
          startTime,
          endTime,
          status: 'assigned',
          site: { id: 'site-1', clientId: 'client-1', name: 'Site A' },
          assignments: [{ id: 'a-1', guardId, guard: { name: 'Ramesh' } }],
          attendanceEvents: [],
        }),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    service = new GuardPortalService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      {} as IncidentsService,
      {} as PatrolsService,
    );
  });

  it('accepts a check-in inside the window', async () => {
    at(2026, 10, 14, 21, 30);

    const result = await service.checkIn(tenantId, guardId, shiftId);

    expect(result.attendanceStatus).toBe('checked_in');
    expect(tx.attendanceEvent.create).toHaveBeenCalled();
  });

  it('refuses a check-in before the window opens, and says when it does', async () => {
    at(2026, 10, 14, 18, 0);

    await expect(service.checkIn(tenantId, guardId, shiftId)).rejects.toThrow(
      /Check-in opens at 14-11-2026/,
    );
    expect(tx.attendanceEvent.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GUARD_CHECK_IN_INVALID' }),
    );
  });

  it('refuses a check-in after the shift has ended', async () => {
    at(2026, 10, 15, 9, 0);

    await expect(service.checkIn(tenantId, guardId, shiftId)).rejects.toThrow(
      /Check-in opens/,
    );
    expect(tx.attendanceEvent.create).not.toHaveBeenCalled();
  });

  it('replays a queued check-in against when the guard pressed it', async () => {
    // Pressed at 22:05 with no signal; the queue only drains after the shift.
    at(2026, 10, 15, 8, 0);
    const pressedAt = localTime(2026, 10, 14, 22, 5);

    await service.checkIn(tenantId, guardId, shiftId, pressedAt);

    expect(tx.attendanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timestamp: pressedAt }),
      }),
    );
  });

  it('ignores a device clock running fast, so the window cannot open early', async () => {
    at(2026, 10, 14, 18, 0);
    // Device claims it is already inside the window.
    const pressedAt = localTime(2026, 10, 14, 21, 30);

    await expect(
      service.checkIn(tenantId, guardId, shiftId, pressedAt),
    ).rejects.toThrow(/Check-in opens/);
  });

  it('flags a late check-out instead of refusing it', async () => {
    at(2026, 10, 15, 8, 0);
    const prisma = (
      service as unknown as { prisma: { shift: { findFirst: jest.Mock } } }
    ).prisma;
    prisma.shift.findFirst.mockResolvedValue({
      id: shiftId,
      tenantId,
      siteId: 'site-1',
      startTime,
      endTime,
      status: 'in_progress',
      site: { id: 'site-1', clientId: 'client-1', name: 'Site A' },
      assignments: [{ id: 'a-1', guardId, guard: { name: 'Ramesh' } }],
      attendanceEvents: [{ type: 'CHECK_IN', timestamp: startTime }],
    });

    await service.checkOut(tenantId, guardId, shiftId);

    expect(tx.attendanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: 'Checked out late' }),
      }),
    );
  });
});

/**
 * The guard's shift list. It returned every assignment the guard had ever
 * had, oldest first, so after a few months today's shift was buried in a
 * wall of completed ones.
 */
describe('GuardPortalService assigned shift list', () => {
  const tenantId = 'tenant-1';
  const guardId = 'guard-1';

  let service: GuardPortalService;
  let assignment: { findMany: jest.Mock };

  const shiftRow = (id: string, startTime: Date) => ({
    id: `assignment-${id}`,
    guardId,
    status: 'confirmed',
    shift: {
      id,
      startTime,
      endTime: new Date(startTime.getTime() + 8 * 60 * 60 * 1000),
      status: 'assigned',
      site: { name: 'Site A', address: '1 Dock Road' },
      attendanceEvents: [],
    },
  });

  beforeEach(() => {
    assignment = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma = {
      guard: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: guardId, tenantId, name: 'Ramesh' }),
      },
      assignment,
    };
    service = new GuardPortalService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      {} as IncidentsService,
      {} as PatrolsService,
    );
  });

  it('asks only for the recent and upcoming window by default', async () => {
    await service.getAssignedShifts(tenantId, guardId);

    const where = assignment.findMany.mock.calls[0][0].where;
    expect(where.shift.endTime.gte).toBeInstanceOf(Date);
    // Seven days back, give or take the moment the test ran.
    const daysBack =
      (Date.now() - where.shift.endTime.gte.getTime()) / 86_400_000;
    expect(daysBack).toBeGreaterThan(6.9);
    expect(daysBack).toBeLessThan(7.1);
  });

  it('drops the window when history is asked for', async () => {
    await service.getAssignedShifts(tenantId, guardId, true);

    const where = assignment.findMany.mock.calls[0][0].where;
    expect(where.shift.endTime).toBeUndefined();
  });

  it('returns newest first, so today is at the top', async () => {
    assignment.findMany.mockResolvedValue([
      shiftRow('older', new Date('2026-11-09T22:00:00.000Z')),
      shiftRow('newest', new Date('2026-11-12T22:00:00.000Z')),
      shiftRow('middle', new Date('2026-11-10T22:00:00.000Z')),
    ]);

    const shifts = await service.getAssignedShifts(tenantId, guardId);

    expect(shifts.map((shift) => shift.id)).toEqual([
      'newest',
      'middle',
      'older',
    ]);
  });

  it('no longer reports an assignment status the guard cannot act on', async () => {
    assignment.findMany.mockResolvedValue([
      shiftRow('s1', new Date('2026-11-12T22:00:00.000Z')),
    ]);

    const [shift] = await service.getAssignedShifts(tenantId, guardId);

    expect(shift).not.toHaveProperty('assignmentStatus');
    expect(shift.attendanceStatus).toBe('not_started');
  });
});
