import { ProspectDiscoveryCollectorScheduler } from './prospect-discovery-collector.scheduler';
import { ProspectDiscoveryJobService } from './prospect-discovery-job.service';
import { ProspectSearchService } from './prospect-search.service';

describe('ProspectDiscoveryCollectorScheduler', () => {
  let scheduler: ProspectDiscoveryCollectorScheduler;
  let jobs: {
    pendingForCollection: jest.Mock;
    pendingOlderThan: jest.Mock;
    claimTerminal: jest.Mock;
    markPolled: jest.Mock;
  };
  let prospectSearch: { getDiscoveryJobStatus: jest.Mock };

  const pendingJob = {
    id: 'row-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    jobId: 'bp-job-1',
    request: { objective: 'Security guards in Chicago', limit: 20 },
  };

  beforeEach(() => {
    jobs = {
      pendingForCollection: jest.fn().mockResolvedValue([]),
      pendingOlderThan: jest.fn().mockResolvedValue([]),
      claimTerminal: jest.fn().mockResolvedValue(true),
      markPolled: jest.fn().mockResolvedValue(undefined),
    };

    prospectSearch = {
      getDiscoveryJobStatus: jest.fn().mockResolvedValue({
        status: 'completed',
        query: 'Security guards in Chicago',
        result: { prospects: [{ id: 'p1' }] },
      }),
    };

    scheduler = new ProspectDiscoveryCollectorScheduler(
      jobs as unknown as ProspectDiscoveryJobService,
      prospectSearch as unknown as ProspectSearchService,
    );
  });

  it('collects an unattended job through the same path a browser polls, so it is cached, recorded and settled', async () => {
    jobs.pendingForCollection.mockResolvedValue([pendingJob]);

    await scheduler.collect();

    expect(prospectSearch.getDiscoveryJobStatus).toHaveBeenCalledTimes(1);
    const [jobId, dto, user] =
      prospectSearch.getDiscoveryJobStatus.mock.calls[0];
    expect(jobId).toBe('bp-job-1');
    // Replayed criteria: the cache key and the result's label come from these.
    expect(dto).toEqual(pendingJob.request);
    // The search belongs to the user who ran it, not to whoever swept it.
    expect(user).toEqual({ sub: 'user-1', tenantId: 'tenant-1' });
  });

  it('leaves jobs young enough that the customer page is probably still polling', async () => {
    await scheduler.collect();

    const { olderThan, youngerThan } = jobs.pendingForCollection.mock.calls[0][0];
    const graceMs = Date.now() - olderThan.getTime();
    // Roughly three minutes, allowing for the clock moving during the test.
    expect(graceMs).toBeGreaterThan(2.5 * 60_000);
    expect(graceMs).toBeLessThan(3.5 * 60_000);
    expect(youngerThan.getTime()).toBeLessThan(olderThan.getTime());
  });

  it('keeps going when one job fails, so a single bad job cannot strand the batch', async () => {
    jobs.pendingForCollection.mockResolvedValue([
      pendingJob,
      { ...pendingJob, id: 'row-2', jobId: 'bp-job-2' },
    ]);
    prospectSearch.getDiscoveryJobStatus
      .mockRejectedValueOnce(new Error('upstream 503'))
      .mockResolvedValueOnce({
        status: 'completed',
        query: 'q',
        result: { prospects: [] },
      });

    await expect(scheduler.collect()).resolves.toBeUndefined();

    expect(prospectSearch.getDiscoveryJobStatus).toHaveBeenCalledTimes(2);
  });

  it('retires a job that upstream never answered, leaving the refund to the credit sweep', async () => {
    jobs.pendingOlderThan.mockResolvedValue([pendingJob]);

    await scheduler.collect();

    expect(jobs.claimTerminal).toHaveBeenCalledWith(
      'tenant-1',
      'bp-job-1',
      'ABANDONED',
      expect.stringContaining('No result after'),
    );
    // Retiring must not poll it again.
    expect(prospectSearch.getDiscoveryJobStatus).not.toHaveBeenCalled();
  });

  it('does not let a slow sweep overlap the next tick', async () => {
    let release: () => void = () => {};
    jobs.pendingForCollection.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = scheduler.collect();
    await scheduler.collect(); // second tick while the first is still running

    expect(jobs.pendingForCollection).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it('never throws, so a failed sweep cannot take the scheduler down', async () => {
    jobs.pendingForCollection.mockRejectedValue(new Error('database down'));

    await expect(scheduler.collect()).resolves.toBeUndefined();

    // And the lock is released, so the next tick still runs.
    jobs.pendingForCollection.mockResolvedValue([]);
    await scheduler.collect();
    expect(jobs.pendingForCollection).toHaveBeenCalledTimes(2);
  });
});
