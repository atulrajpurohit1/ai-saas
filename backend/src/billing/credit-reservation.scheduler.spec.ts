import { CreditReservationScheduler } from './credit-reservation.scheduler';
import { CreditsService } from './credits.service';

describe('CreditReservationScheduler', () => {
  let scheduler: CreditReservationScheduler;
  let credits: { expireStaleReservations: jest.Mock };

  beforeEach(() => {
    credits = {
      expireStaleReservations: jest
        .fn()
        .mockResolvedValue({ expired: 2, released: 30 }),
    };
    scheduler = new CreditReservationScheduler(
      credits as unknown as CreditsService,
    );
  });

  it('releases only holds older than a day', async () => {
    const result = await scheduler.sweep();

    // The cutoff must stay past AbandonedJobScheduler's six-hour limit, or a
    // blind release would beat it and lose the job's recorded cost.
    expect(credits.expireStaleReservations).toHaveBeenCalledWith(24 * 60);
    expect(result).toEqual({ expired: 2, released: 30 });
  });

  it('skips a tick while the previous sweep is still running', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    credits.expireStaleReservations.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const first = scheduler.sweep();
    await scheduler.sweep();

    expect(credits.expireStaleReservations).toHaveBeenCalledTimes(1);

    resolveFirst({ expired: 0, released: 0 });
    await first;
  });

  // A failing sweep must not take the scheduler process down, and must leave
  // the next tick free to retry.
  it('swallows a failure and still runs on the next tick', async () => {
    credits.expireStaleReservations.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(scheduler.sweep()).resolves.toEqual({
      expired: 0,
      released: 0,
    });

    await scheduler.sweep();
    expect(credits.expireStaleReservations).toHaveBeenCalledTimes(2);
  });
});
