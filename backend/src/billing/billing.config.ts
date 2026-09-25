import { ServiceModule } from '@prisma/client';

/**
 * Stripe price ids, one per sellable service.
 *
 * Prices live in Stripe, not here -- the amounts, currency and interval are
 * whatever the Dashboard says. This file only records WHICH price id sells
 * WHICH service, so a price change in Stripe needs no deploy.
 *
 * Until the client confirms pricing these env vars are unset, and
 * `isCheckoutConfigured()` returns false. Every checkout endpoint then answers
 * 503 with a clear message rather than half-working.
 */
export type BillingInterval = 'monthly' | 'annual';

const ENV_KEYS: Record<ServiceModule, Record<BillingInterval, string>> = {
  LEAD_GEN: {
    monthly: 'STRIPE_PRICE_LEAD_GEN_MONTHLY',
    annual: 'STRIPE_PRICE_LEAD_GEN_ANNUAL',
  },
  GUARD_TOUR: {
    monthly: 'STRIPE_PRICE_GUARD_TOUR_MONTHLY',
    annual: 'STRIPE_PRICE_GUARD_TOUR_ANNUAL',
  },
  FINANCE: {
    monthly: 'STRIPE_PRICE_FINANCE_MONTHLY',
    annual: 'STRIPE_PRICE_FINANCE_ANNUAL',
  },
};

export function priceIdFor(
  module: ServiceModule,
  interval: BillingInterval,
): string | null {
  return process.env[ENV_KEYS[module][interval]]?.trim() || null;
}

/**
 * Stripe sends the module list back on the session, but a webhook is an
 * untrusted inbound request and metadata can be edited in the Dashboard. We
 * therefore resolve modules from the price ids Stripe reports as purchased,
 * and treat metadata only as a cross-check.
 */
export function moduleForPriceId(priceId: string): ServiceModule | null {
  for (const [module, intervals] of Object.entries(ENV_KEYS)) {
    for (const envKey of Object.values(intervals)) {
      if (process.env[envKey]?.trim() === priceId) {
        return module as ServiceModule;
      }
    }
  }
  return null;
}

export function stripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

/** Where Stripe returns the customer after checkout. */
export function billingReturnUrls() {
  const base = (
    process.env.BILLING_RETURN_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  return {
    success: `${base}/settings/plan?checkout=success`,
    cancel: `${base}/settings/plan?checkout=cancelled`,
    portalReturn: `${base}/settings/plan`,
  };
}

/** Free trial length in days, or null for no trial. */
export function trialDays(): number | null {
  const raw = process.env.STRIPE_TRIAL_DAYS?.trim();
  if (!raw) return null;
  const days = Number.parseInt(raw, 10);
  return Number.isFinite(days) && days > 0 ? days : null;
}

export function isCheckoutConfigured() {
  return Boolean(stripeSecretKey());
}

/** Services that actually have a price configured and can be sold today. */
export function sellableModules(interval: BillingInterval = 'monthly') {
  return (Object.keys(ENV_KEYS) as ServiceModule[]).filter((module) =>
    priceIdFor(module, interval),
  );
}
