/**
 * LIVE MODE counterpart of create-stripe-prices.ts.
 *
 * Creates the real, billable products and prices in the live Stripe account and
 * prints the env lines. Amounts come from the app's own constants so the
 * Dashboard and the code cannot drift apart at creation time. Idempotent by
 * lookup_key: re-running finds the existing price instead of creating a
 * duplicate, so a half-finished run is safe to repeat.
 *
 * Requires CONFIRM_LIVE=yes as well as a live key, because everything this
 * creates is chargeable to real customers.
 *
 *   CONFIRM_LIVE=yes npx ts-node scripts/create-live-stripe-prices.ts
 */
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import { CREDIT_PACKS, CREDIT_PACK_KEYS } from '../src/billing/credit-packs.constants';
import { MONTHLY_PRICES, GENERATION_ONLY_BAND } from '../src/billing/pricing.constants';

dotenv.config();

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_live_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not a LIVE key.');
  console.error('For test mode use scripts/create-stripe-prices.ts instead.');
  process.exit(1);
}
if (process.env.CONFIRM_LIVE !== 'yes') {
  console.error('Refusing to run: this creates REAL, billable prices.');
  console.error('Re-run with CONFIRM_LIVE=yes if that is what you intend.');
  process.exit(1);
}
const stripe = new Stripe(key);

async function findOrCreatePrice(params: {
  productName: string;
  lookupKey: string;
  amount: number;
  recurring: 'month' | 'year' | null;
  metadata: Record<string, string>;
}) {
  const { productName, lookupKey, amount, recurring, metadata } = params;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) {
    return { id: existing.data[0].id, created: false };
  }

  const product = await stripe.products.create({ name: productName, metadata });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount * 100, // Stripe takes the smallest currency unit.
    currency: 'usd',
    lookup_key: lookupKey,
    ...(recurring ? { recurring: { interval: recurring } } : {}),
    metadata,
  });

  return { id: price.id, created: true };
}

(async () => {
  const lines: string[] = [];

  console.log('*** LIVE MODE - creating real billable prices ***');
  console.log('--- Credit packs (one-time) ---');
  for (const packKey of CREDIT_PACK_KEYS) {
    const pack = CREDIT_PACKS[packKey];
    const result = await findOrCreatePrice({
      productName: `AegisLead ${pack.label} (${pack.credits} Prospect Search credits)`,
      // Size and price are part of the key, so resizing a pack creates a new
      // price instead of silently reusing the old one under the same name.
      lookupKey: `credits_${packKey.toLowerCase()}_${pack.credits}cr_${pack.price}usd`,
      amount: pack.price,
      recurring: null,
      metadata: { creditPack: packKey, credits: String(pack.credits) },
    });
    console.log(`  ${pack.label}: $${pack.price} / ${pack.credits} credits -> ${result.id} ${result.created ? '(created)' : '(existing)'}`);
    lines.push(`STRIPE_PRICE_CREDITS_${packKey}=${result.id}`);
  }

  // The app maps one price id per service per interval. Generation is pinned to
  // its base band ($299 flat); the others use the 1-25 band as the entry price,
  // since guard-band pricing above that is quoted, not sold self-serve here.
  const SERVICES: { env: string; label: string; monthly: number }[] = [
    { env: 'LEAD_GEN', label: 'AegisLead Generation', monthly: MONTHLY_PRICES.GENERATION[GENERATION_ONLY_BAND]! },
    { env: 'GUARD_TOUR', label: 'AegisLead Guard', monthly: MONTHLY_PRICES.GUARD['1-25']! },
    { env: 'FINANCE', label: 'AegisLead Operations', monthly: MONTHLY_PRICES.OPERATIONS['1-25']! },
  ];

  console.log('\n--- Subscriptions (monthly + annual) ---');
  for (const service of SERVICES) {
    const monthly = await findOrCreatePrice({
      productName: `${service.label} (monthly)`,
      lookupKey: `${service.env.toLowerCase()}_monthly`,
      amount: service.monthly,
      recurring: 'month',
      metadata: { module: service.env, interval: 'monthly' },
    });
    // Ten months for twelve: a conventional annual discount, and a round number.
    const annualAmount = service.monthly * 10;
    const annual = await findOrCreatePrice({
      productName: `${service.label} (annual)`,
      lookupKey: `${service.env.toLowerCase()}_annual`,
      amount: annualAmount,
      recurring: 'year',
      metadata: { module: service.env, interval: 'annual' },
    });

    console.log(`  ${service.label}: $${service.monthly}/mo -> ${monthly.id} ${monthly.created ? '(created)' : '(existing)'}`);
    console.log(`  ${service.label}: $${annualAmount}/yr -> ${annual.id} ${annual.created ? '(created)' : '(existing)'}`);
    lines.push(`STRIPE_PRICE_${service.env}_MONTHLY=${monthly.id}`);
    lines.push(`STRIPE_PRICE_${service.env}_ANNUAL=${annual.id}`);
  }

  console.log('\n--- env lines ---');
  lines.forEach((line) => console.log(line));
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
