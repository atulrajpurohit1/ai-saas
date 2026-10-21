import { SubscriptionSource, SubscriptionStatus } from '@prisma/client';

/** The subscription fields that decide whether a comp is live right now. */
export interface CompState {
  source: SubscriptionSource;
  status: SubscriptionStatus;
  compExpiresAt: Date | null;
}

/**
 * Is this tenant running on live complimentary access?
 *
 * Shared deliberately between the entitlement read and the Stripe webhook,
 * because the two must agree. Entitlements asks it to stop honouring a lapsed
 * comp; the webhook asks it to decide whether Stripe is allowed to write.
 *
 * The expiry is evaluated here rather than by a nightly job alone, so a job
 * that fails to run cannot leave free access quietly switched on.
 *
 * A cancelled or expired comp is NOT active, and that is the point: it lets a
 * comped tenant later buy a real subscription and have the webhook provision
 * it normally. Treating every COMP row as permanently off-limits to Stripe
 * would lock those tenants out of ever paying.
 */
export function isCompActive(
  subscription: CompState,
  now: Date = new Date(),
): boolean {
  if (subscription.source !== 'COMP') return false;
  if (subscription.status === 'CANCELED') return false;
  if (subscription.compExpiresAt && subscription.compExpiresAt <= now) {
    return false;
  }
  return true;
}
