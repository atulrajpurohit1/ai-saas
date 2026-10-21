import { isCompActive } from './comp.util';

describe('isCompActive', () => {
  const NOW = new Date('2026-10-21T12:00:00.000Z');

  const comp = (overrides: Partial<Parameters<typeof isCompActive>[0]> = {}) =>
    isCompActive(
      {
        source: 'COMP',
        status: 'ACTIVE',
        compExpiresAt: null,
        ...overrides,
      },
      NOW,
    );

  it('is active for an open-ended comp', () => {
    expect(comp()).toBe(true);
  });

  it('is active while the end date is still ahead', () => {
    expect(comp({ compExpiresAt: new Date('2026-12-01T00:00:00.000Z') })).toBe(
      true,
    );
  });

  it('is not active once the end date has passed', () => {
    expect(comp({ compExpiresAt: new Date('2026-10-01T00:00:00.000Z') })).toBe(
      false,
    );
  });

  // The boundary decides whether someone keeps access for one more request.
  // Expiring AT the instant is the honest reading of "expires at".
  it('is not active exactly at the end date', () => {
    expect(comp({ compExpiresAt: NOW })).toBe(false);
  });

  it('is not active once revoked', () => {
    expect(comp({ status: 'CANCELED' })).toBe(false);
  });

  /**
   * The case that keeps a comped tenant able to start paying later: once the
   * comp is over, Stripe must be allowed to provision them normally. If this
   * returned true the webhook would ignore their first real subscription.
   */
  it('lets Stripe take over a tenant whose comp has ended', () => {
    expect(comp({ status: 'CANCELED', compExpiresAt: NOW })).toBe(false);
  });

  it('is never active for a Stripe-backed subscription', () => {
    expect(comp({ source: 'STRIPE' })).toBe(false);
  });

  // A paying tenant in dunning keeps access, and nothing about that is a comp.
  it('is not active for a PAST_DUE Stripe subscription', () => {
    expect(comp({ source: 'STRIPE', status: 'PAST_DUE' })).toBe(false);
  });
});
