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
