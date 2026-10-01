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
import {
  GUARD_BANDS,
  MONTHLY_PRICES,
  PACKAGE_KEYS,
  PACKAGE_LABELS,
  planLookupKey,
} from '../src/billing/pricing.constants';

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

  // Plans: one product per package, one monthly price per guard band. Checkout
  // finds these by lookup_key (planLookupKey), so there are no env lines to
  // set. 500+ has no price -- it is quoted by sales.
  console.log('\n--- Plans (monthly, by active guards) ---');
  const products = await stripe.products.list({ active: true, limit: 100 });
  for (const packageKey of PACKAGE_KEYS) {
    let product = products.data.find(
      (candidate) => candidate.metadata?.aegisleadPackage === packageKey,
    );
    if (!product) {
      product = await stripe.products.create({
        name: PACKAGE_LABELS[packageKey],
        metadata: { aegisleadPackage: packageKey },
      });
    }

    for (const { key: band } of GUARD_BANDS) {
      const lookupKey = planLookupKey(packageKey, band);
      const amount = MONTHLY_PRICES[packageKey][band];
      if (!lookupKey || amount === null) continue;

      const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      if (existing.data[0]) {
        console.log(`  ${PACKAGE_LABELS[packageKey]} ${band}: $${amount}/mo -> ${existing.data[0].id} (existing)`);
        continue;
      }

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amount * 100,
        currency: 'usd',
        recurring: { interval: 'month' },
        lookup_key: lookupKey,
        nickname: `${band.replace('-', '–')} active guards`,
        metadata: { package: packageKey, band },
      });
      console.log(`  ${PACKAGE_LABELS[packageKey]} ${band}: $${amount}/mo -> ${price.id} (created)`);
    }
  }

  console.log('\n--- env lines ---');
  lines.forEach((line) => console.log(line));
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
