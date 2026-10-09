import { CreditsService } from '../billing/credits.service';
import { AbandonedJobScheduler } from './abandoned-job.scheduler';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';
import { UpstreamBudgetService } from './upstream-budget.service';

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

describe('AbandonedJobScheduler', () => {
  let scheduler: AbandonedJobScheduler;
  let credits: { findPendingReservations: jest.Mock; settle: jest.Mock };
  let provider: { getJobOutcome: jest.Mock };
  let upstreamBudget: { invalidate: jest.Mock };

  beforeEach(() => {
    credits = {
      findPendingReservations: jest.fn().mockResolvedValue([]),
      settle: jest.fn().mockResolvedValue({ released: 200, consumed: 0 }),
    };
    provider = { getJobOutcome: jest.fn() };
    upstreamBudget = { invalidate: jest.fn() };
    scheduler = new AbandonedJobScheduler(
      credits as unknown as CreditsService,
      provider as unknown as BlackPearlProspectingProvider,
      upstreamBudget as unknown as UpstreamBudgetService,
    );
  });

  it('only looks at holds older than the page itself ever polls', async () => {
    await scheduler.reconcile();

    // The page polls discovery for 20 minutes and playbooks for 30. Settling
    // sooner could race a page that is still waiting on the job.
    expect(credits.findPendingReservations).toHaveBeenCalledWith(45);
  });

  // The whole point: these searches used to be released blind, with nothing
  // recording what BlackPearl charged for them.
  it('refunds a search that finished after the page gave up, recording its cost', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(50) },
    ]);
    provider.getJobOutcome.mockResolvedValue({
      status: 'succeeded',
      upstreamCostUsd: 2.4,
    });

    const counts = await scheduler.reconcile();

    expect(provider.getJobOutcome).toHaveBeenCalledWith('job_a');
    // Refunded, not charged: the customer never received the results.
    expect(credits.settle).toHaveBeenCalledWith({
      reservationId: 'res-1',
      actualUsed: 0,
      description:
        'Search finished after the page stopped waiting for it; credits returned.',
      upstreamCostUsd: 2.4,
    });
    expect(upstreamBudget.invalidate).toHaveBeenCalled();
    expect(counts).toEqual({ succeeded: 1, failed: 0, expired: 0 });
  });

  it('refunds a failed search, recording its cost', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(50) },
    ]);
    provider.getJobOutcome.mockResolvedValue({
      status: 'failed',
      upstreamCostUsd: 0.5,
    });

    const counts = await scheduler.reconcile();

    expect(credits.settle).toHaveBeenCalledWith(
      expect.objectContaining({ actualUsed: 0, upstreamCostUsd: 0.5 }),
    );
    expect(counts).toEqual({ succeeded: 0, failed: 1, expired: 0 });
  });

  it('leaves a job that is still running alone', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(90) },
    ]);
    provider.getJobOutcome.mockResolvedValue({
      status: 'pending',
      upstreamCostUsd: null,
    });

    const counts = await scheduler.reconcile();

    expect(credits.settle).not.toHaveBeenCalled();
    expect(counts).toEqual({ succeeded: 0, failed: 0, expired: 0 });
  });

  it('leaves a job alone when its status cannot be read, for now', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(90) },
    ]);
    provider.getJobOutcome.mockResolvedValue(null);

    await scheduler.reconcile();

    // A failed status check says nothing about the job; the next tick retries.
    expect(credits.settle).not.toHaveBeenCalled();
  });

  it('gives up on a job still running after six hours and refunds it', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(6 * 60 + 1) },
    ]);
    provider.getJobOutcome.mockResolvedValue({
      status: 'pending',
      upstreamCostUsd: 1.1,
    });

    const counts = await scheduler.reconcile();

    expect(credits.settle).toHaveBeenCalledWith({
      reservationId: 'res-1',
      actualUsed: 0,
      description:
        'Search did not complete in time; credits returned automatically.',
      upstreamCostUsd: 1.1,
    });
    expect(counts).toEqual({ succeeded: 0, failed: 0, expired: 1 });
  });

  it('gives up after six hours even when the status never could be read', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(6 * 60 + 1) },
    ]);
    provider.getJobOutcome.mockResolvedValue(null);

    await scheduler.reconcile();

    expect(credits.settle).toHaveBeenCalledWith(
      expect.objectContaining({ actualUsed: 0, upstreamCostUsd: null }),
    );
  });

  it('does not count a hold someone else settled first', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(50) },
    ]);
    provider.getJobOutcome.mockResolvedValue({
      status: 'succeeded',
      upstreamCostUsd: 2.4,
    });
    // settle() answers null when the hold is no longer PENDING.
    credits.settle.mockResolvedValue(null);

    const counts = await scheduler.reconcile();

    expect(upstreamBudget.invalidate).not.toHaveBeenCalled();
    expect(counts).toEqual({ succeeded: 0, failed: 0, expired: 0 });
  });

  it('keeps going past a hold that throws', async () => {
    credits.findPendingReservations.mockResolvedValue([
      { id: 'res-1', jobId: 'job_a', createdAt: minutesAgo(50) },
      { id: 'res-2', jobId: 'job_b', createdAt: minutesAgo(50) },
    ]);
    provider.getJobOutcome
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ status: 'failed', upstreamCostUsd: null });

    const counts = await scheduler.reconcile();

    expect(credits.settle).toHaveBeenCalledTimes(1);
    expect(credits.settle).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'res-2' }),
    );
    expect(counts).toEqual({ succeeded: 0, failed: 1, expired: 0 });
  });

  it('swallows a failure to list holds', async () => {
    credits.findPendingReservations.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(scheduler.reconcile()).resolves.toEqual({
      succeeded: 0,
      failed: 0,
      expired: 0,
    });
  });

  it('skips a tick while the previous run is still going', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    credits.findPendingReservations.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const first = scheduler.reconcile();
    await scheduler.reconcile();

    expect(credits.findPendingReservations).toHaveBeenCalledTimes(1);

    resolveFirst([]);
    await first;
  });
});
