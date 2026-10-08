import { ServiceModule } from '@prisma/client';
import { isDevelopmentLike } from '../config/environment-check';

/**
 * Per-service Stripe price ids from before band pricing.
 *
 * Plans are now sold by package and guard band, found in Stripe by lookup_key
 * (see planLookupKey in pricing.constants). These env vars are no longer used
 * to SELL anything; they remain only so the webhook still recognises a
 * subscription bought on one of the old per-service prices.
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

/**
 * Where Stripe returns the customer after checkout.
 *
 * This MUST be the origin the customer is actually signed in on. Sessions live
 * in that origin's localStorage, so returning them to a different host -- even
 * another domain serving the same app -- lands them with no session and bounces
 * them to the login screen straight after paying. Their purchase still
 * completes (the webhook is server-side), which is what makes the misconfigured
 * case so easy to miss.
 */
export function billingReturnUrls() {
  const configured = process.env.BILLING_RETURN_URL || process.env.FRONTEND_URL;

  // Falling back to localhost in a deployed environment sends real customers to
  // their OWN machine after payment. Say so loudly rather than silently
  // producing a URL that cannot work.
  // isDevelopmentLike, not `NODE_ENV === 'production'`: with NODE_ENV unset
  // the old test stayed silent, so a deployed service fell back to localhost
  // AND said nothing about it.
  if (!configured && !isDevelopmentLike()) {
    // eslint-disable-next-line no-console
    console.error(
      'BILLING_RETURN_URL is not set. Stripe will return paying customers to ' +
        'http://localhost:3000, which is their own machine. Set it to the origin ' +
        'customers sign in on.',
    );
  }

  const base = (configured || 'http://localhost:3000').replace(/\/+$/, '');

  return {
    success: `${base}/settings/plan?checkout=success`,
    cancel: `${base}/settings/plan?checkout=cancelled`,
    portalReturn: `${base}/settings/plan`,
    // Credit packs return to the credits screen rather than the plan screen,
    // so the customer lands where their new balance is shown.
    creditsSuccess: `${base}/settings/credits?checkout=success`,
    creditsCancel: `${base}/settings/credits?checkout=cancelled`,
    // Saving a card for auto-recharge is not a purchase, so it returns with
    // its own marker -- otherwise the credits screen would announce "payment
    // received" for a card that has not been charged.
    //
    // `{CHECKOUT_SESSION_ID}` is substituted by Stripe on redirect. The id is
    // required: no webhook records a `setup` session, so the only thing that
    // saves the card is the frontend posting this id back to
    // `POST billing/credits/auto-recharge/card`. Without it the customer
    // completes the flow and nothing is stored.
    cardSetupSuccess: `${base}/settings/credits?cardSetup=success&session_id={CHECKOUT_SESSION_ID}`,
    cardSetupCancel: `${base}/settings/credits?cardSetup=cancelled`,
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
