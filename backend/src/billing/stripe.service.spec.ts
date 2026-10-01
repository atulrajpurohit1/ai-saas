import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

/**
 * Credit pack checkout must refuse to sell a pack whose Stripe price does not
 * charge what the pack says. The webhook grants credits from the constants
 * while Stripe charges whatever the price says, so a stale price id would sell
 * the new pack size at the old price.
 */
describe('StripeService credit pack checkout', () => {
  const PRICE_ID = 'price_starter';
  const originalEnv = { ...process.env };

  let service: StripeService;
  let prices: { retrieve: jest.Mock };
  let sessions: { create: jest.Mock };

  const price = (overrides: Record<string, unknown> = {}) => ({
    id: PRICE_ID,
    active: true,
    type: 'one_time',
    currency: 'usd',
    // Starter Pack: $149 for 3,000 credits.
    unit_amount: 14900,
    ...overrides,
  });

  beforeEach(() => {
    process.env.STRIPE_PRICE_CREDITS_STARTER = PRICE_ID;

    const prisma = {
      tenantSubscription: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ providerCustomerId: 'cus_existing' }),
      },
    };
    service = new StripeService(prisma as unknown as PrismaService);

    prices = { retrieve: jest.fn() };
    sessions = {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'cs_1', url: 'https://checkout.test/cs_1' }),
    };
    // The client is built lazily from STRIPE_SECRET_KEY; stand a fake in its
    // place so no network call is ever made.
    (service as unknown as { client: unknown }).client = {
      prices,
      checkout: { sessions },
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const buyStarter = () =>
    service.createCreditPackCheckoutSession({
      tenantId: 'tenant-1',
      pack: 'STARTER',
    });

  it('sells the pack when the price charges exactly what the pack says', async () => {
    prices.retrieve.mockResolvedValue(price());

    await expect(buyStarter()).resolves.toEqual({
      url: 'https://checkout.test/cs_1',
      sessionId: 'cs_1',
    });
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [{ price: PRICE_ID, quantity: 1 }],
      }),
    );
  });

  // The case that was live on the day the packs were resized: the Starter key
  // kept its env var, so the old $99 price would have sold 3,000 credits.
  it('refuses a stale price that charges the old amount', async () => {
    prices.retrieve.mockResolvedValue(price({ unit_amount: 9900 }));

    await expect(buyStarter()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('refuses a recurring price', async () => {
    prices.retrieve.mockResolvedValue(price({ type: 'recurring' }));

    await expect(buyStarter()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('refuses an archived price', async () => {
    prices.retrieve.mockResolvedValue(price({ active: false }));

    await expect(buyStarter()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('refuses a price in another currency', async () => {
    prices.retrieve.mockResolvedValue(price({ currency: 'eur' }));

    await expect(buyStarter()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe('StripeService plan checkout', () => {
  const GUARD_26_50 = 'aegislead_guard_26_50_149usd_monthly';
  const originalEnv = { ...process.env };

  let service: StripeService;
  let subscriptionRecord: { providerSubscriptionId: string | null } | null;
  let prices: { list: jest.Mock };
  let sessions: { create: jest.Mock };
  let subscriptions: { retrieve: jest.Mock; update: jest.Mock };

  const planPrice = (overrides: Record<string, unknown> = {}) => ({
    id: 'price_guard_26_50',
    lookup_key: GUARD_26_50,
    active: true,
    type: 'recurring',
    currency: 'usd',
    unit_amount: 14900,
    recurring: { interval: 'month', interval_count: 1 },
    ...overrides,
  });

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_plan';
    subscriptionRecord = null;

    const prisma = {
      tenantSubscription: {
        findUnique: jest
          .fn()
          .mockImplementation(({ select }) =>
            Promise.resolve(
              select?.providerCustomerId
                ? { providerCustomerId: 'cus_existing' }
                : subscriptionRecord,
            ),
          ),
      },
    };
    service = new StripeService(prisma as unknown as PrismaService);

    prices = {
      list: jest.fn().mockImplementation(({ lookup_keys }) =>
        Promise.resolve({
          data: lookup_keys.includes(GUARD_26_50) ? [planPrice()] : [],
        }),
      ),
    };
    sessions = {
      create: jest
        .fn()
        .mockResolvedValue({
          id: 'cs_plan',
          url: 'https://checkout.test/plan',
        }),
    };
    subscriptions = { retrieve: jest.fn(), update: jest.fn() };
    (service as unknown as { client: unknown }).client = {
      prices,
      checkout: { sessions },
      subscriptions,
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const buyGuard = (band: '26-50' | '500+' = '26-50') =>
    service.createPlanCheckoutSession({
      tenantId: 'tenant-1',
      packageKey: 'GUARD',
      band,
    });

  it('sells the band price that matches the table', async () => {
    await expect(buyGuard()).resolves.toEqual({
      url: 'https://checkout.test/plan',
      changed: false,
    });
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_guard_26_50', quantity: 1 }],
      }),
    );
  });

  it('refuses a price whose amount no longer matches the table', async () => {
    prices.list.mockResolvedValue({ data: [planPrice({ unit_amount: 9900 })] });

    await expect(buyGuard()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('refuses a yearly price under a monthly key', async () => {
    prices.list.mockResolvedValue({
      data: [planPrice({ recurring: { interval: 'year', interval_count: 1 } })],
    });

    await expect(buyGuard()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  // 500+ is quoted by sales; there is nothing to buy online.
  it('refuses the custom band', async () => {
    await expect(buyGuard('500+')).rejects.toBeInstanceOf(BadRequestException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  // A second checkout would create a second subscription and bill twice.
  it('moves an existing subscriber onto the new price instead', async () => {
    subscriptionRecord = { providerSubscriptionId: 'sub_live' };
    subscriptions.retrieve.mockResolvedValue({
      id: 'sub_live',
      status: 'active',
      items: { data: [{ id: 'si_lead' }, { id: 'si_finance' }] },
    });

    await expect(buyGuard()).resolves.toEqual({ url: null, changed: true });

    expect(sessions.create).not.toHaveBeenCalled();
    expect(subscriptions.update).toHaveBeenCalledWith(
      'sub_live',
      expect.objectContaining({
        items: [
          { id: 'si_lead', price: 'price_guard_26_50', quantity: 1 },
          { id: 'si_finance', deleted: true },
        ],
      }),
    );
  });

  it('starts a fresh checkout when the old subscription was cancelled', async () => {
    subscriptionRecord = { providerSubscriptionId: 'sub_old' };
    subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'canceled',
      items: { data: [{ id: 'si_old' }] },
    });

    await buyGuard();

    expect(subscriptions.update).not.toHaveBeenCalled();
    expect(sessions.create).toHaveBeenCalled();
  });
});
