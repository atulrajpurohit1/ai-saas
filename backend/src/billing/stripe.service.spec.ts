import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import {
  LEAD_GEN_BASE_PRICE,
  LEAD_GEN_TIERS,
  leadGenTierLookupKey,
} from './lead-gen-tiers.constants';

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
  /** A TenantModule row means this tenant has been provisioned before. */
  let hasPriorModules: boolean;
  let activeSale: {
    id?: string;
    name?: string;
    percentOff?: number;
    bonusCredits?: number;
    stripeCouponId: string | null;
  } | null;
  let saleLookup: jest.Mock;
  let offerCreate: jest.Mock;
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
    hasPriorModules = false;
    activeSale = null;
    saleLookup = jest
      .fn()
      .mockImplementation(() => Promise.resolve(activeSale));
    offerCreate = jest.fn().mockResolvedValue({});

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
      tenantModule: {
        findFirst: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(hasPriorModules ? { id: 'module-row' } : null),
          ),
      },
      saleCampaign: {
        findFirst: saleLookup,
      },
      saleCheckoutOffer: { create: offerCreate },
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
      create: jest.fn().mockResolvedValue({
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

  it('applies an active sale to the first invoice and skips the free trial', async () => {
    process.env.STRIPE_TRIAL_DAYS = '14';
    activeSale = { percentOff: 25, stripeCouponId: 'coupon_black_friday' };

    await buyGuard();

    const [session] = sessions.create.mock.calls[0] as [
      {
        discounts: { coupon: string }[];
        subscription_data: Record<string, unknown>;
      },
    ];
    expect(session.discounts).toEqual([{ coupon: 'coupon_black_friday' }]);
    expect(session.subscription_data).not.toHaveProperty('trial_period_days');
    expect(saleLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enabled: true,
          packageKeys: { has: 'GUARD' },
        }),
        orderBy: [
          { percentOff: 'desc' },
          { bonusCredits: 'desc' },
          { createdAt: 'asc' },
        ],
      }),
    );
  });

  it('records a credits-only offer at checkout without creating a discount', async () => {
    process.env.STRIPE_TRIAL_DAYS = '14';
    activeSale = {
      id: 'sale-1',
      name: 'Black Friday',
      percentOff: 0,
      bonusCredits: 1000,
      stripeCouponId: null,
    };

    await buyGuard();

    const [session] = sessions.create.mock.calls[0] as [
      {
        discounts?: unknown;
        metadata: { saleOfferId: string };
        subscription_data: {
          metadata: { saleOfferId: string };
          trial_period_days?: number;
        };
      },
    ];
    expect(session.discounts).toBeUndefined();
    expect(session.subscription_data.trial_period_days).toBeUndefined();
    expect(session.subscription_data.metadata.saleOfferId).toBe(
      session.metadata.saleOfferId,
    );
    expect(offerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: session.metadata.saleOfferId,
        campaignId: 'sale-1',
        tenantId: 'tenant-1',
        packageKey: 'GUARD',
        bonusCredits: 1000,
        stripeSessionId: 'cs_plan',
      }),
    });
  });

  it('does not gift sale credits to a returning paid subscriber', async () => {
    subscriptionRecord = { providerSubscriptionId: 'sub_cancelled' };
    subscriptions.retrieve.mockResolvedValue({ status: 'canceled' });
    activeSale = {
      id: 'sale-1',
      name: 'Black Friday',
      percentOff: 25,
      bonusCredits: 1000,
      stripeCouponId: 'coupon_sale',
    };

    await buyGuard();

    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ coupon: 'coupon_sale' }],
        metadata: expect.not.objectContaining({
          saleOfferId: expect.any(String),
        }),
      }),
    );
    expect(offerCreate).not.toHaveBeenCalled();
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

  describe('Lead Gen plans', () => {
    const PRO_KEY = leadGenTierLookupKey('PRO');
    const BASE_KEY = 'aegislead_generation_1_25_299usd_monthly';

    const tierPrice = (overrides: Record<string, unknown> = {}) => ({
      id: 'price_leadgen_pro',
      lookup_key: PRO_KEY,
      active: true,
      type: 'recurring',
      currency: 'usd',
      unit_amount: LEAD_GEN_TIERS.PRO.price * 100,
      recurring: { interval: 'month', interval_count: 1 },
      ...overrides,
    });

    const basePrice = (overrides: Record<string, unknown> = {}) => ({
      id: 'price_leadgen_base',
      lookup_key: BASE_KEY,
      active: true,
      type: 'recurring',
      currency: 'usd',
      unit_amount: LEAD_GEN_BASE_PRICE * 100,
      recurring: { interval: 'month', interval_count: 1 },
      ...overrides,
    });

    const buyLeadGen = (tier?: 'STARTER' | 'PRO' | 'ELITE') =>
      service.createPlanCheckoutSession({
        tenantId: 'tenant-1',
        packageKey: 'GENERATION',
        band: '1-25',
        tier,
      });

    beforeEach(() => {
      prices.list.mockImplementation(
        ({ lookup_keys }: { lookup_keys: string[] }) =>
          Promise.resolve({
            data: [
              ...(lookup_keys.includes(PRO_KEY) ? [tierPrice()] : []),
              ...(lookup_keys.includes(BASE_KEY) ? [basePrice()] : []),
            ],
          }),
      );
    });

    it('sells the tier price', async () => {
      await expect(buyLeadGen('PRO')).resolves.toEqual({
        url: 'https://checkout.test/plan',
        changed: false,
      });
      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_leadgen_pro', quantity: 1 }],
          metadata: expect.objectContaining({
            package: 'GENERATION',
            leadGenTier: 'PRO',
            includedCredits: String(LEAD_GEN_TIERS.PRO.includedCredits),
          }) as unknown as Record<string, string>,
        }),
      );
    });

    // No tier means the base plan: the platform fee alone, no credits. It is
    // the same $299 price Generation was always sold at, so there is no
    // second product to keep in step. Who may buy it is the controller's
    // business, not this layer's.
    it('sells the base plan when no tier is named', async () => {
      await expect(buyLeadGen()).resolves.toEqual({
        url: 'https://checkout.test/plan',
        changed: false,
      });
      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_leadgen_base', quantity: 1 }],
        }),
      );
    });

    // The band a Lead Gen buyer sends is irrelevant -- the price is flat --
    // and honouring it would charge them one of the old banded amounts.
    it('ignores the guard band on a base plan purchase', async () => {
      await service.createPlanCheckoutSession({
        tenantId: 'tenant-1',
        packageKey: 'GENERATION',
        band: '251-500',
      });

      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_leadgen_base', quantity: 1 }],
        }),
      );
    });

    it('refuses a tier price that no longer matches the published price', async () => {
      prices.list.mockResolvedValue({
        data: [tierPrice({ unit_amount: 29_900 })],
      });

      await expect(buyLeadGen('PRO')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('reports only the tiers Stripe can actually sell', async () => {
      await expect(service.sellableLeadGenTiers()).resolves.toEqual(['PRO']);
    });

    it('reports the base plan as sellable when its price is live', async () => {
      await expect(service.leadGenBaseSellable()).resolves.toBe(true);
    });

    it('reports the base plan as unsellable when the price is missing', async () => {
      prices.list.mockResolvedValue({ data: [] });
      await expect(service.leadGenBaseSellable()).resolves.toBe(false);
    });
  });

  // A second checkout would create a second subscription and bill twice.
  it('moves an existing subscriber onto the new price instead', async () => {
    subscriptionRecord = { providerSubscriptionId: 'sub_live' };
    subscriptions.retrieve.mockResolvedValue({
      id: 'sub_live',
      status: 'active',
      items: { data: [{ id: 'si_lead' }, { id: 'si_finance' }] },
    });
    activeSale = { stripeCouponId: 'coupon_black_friday' };

    await expect(buyGuard()).resolves.toEqual({ url: null, changed: true });

    expect(sessions.create).not.toHaveBeenCalled();
    expect(saleLookup).not.toHaveBeenCalled();
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

  /**
   * Lead Gen is an add-on. Buying it used to replace whatever the tenant was
   * already paying for, so a Guard customer who wanted to prospect lost their
   * patrols -- a billing limitation masquerading as a product rule.
   */
  describe('Lead Gen alongside another package', () => {
    const PRO_KEY = leadGenTierLookupKey('PRO');
    const GUARD_1_25 = 'aegislead_guard_1_25_99usd_monthly';
    const COMPLETE_1_25 = 'aegislead_complete_1_25_499usd_monthly';

    const live = (items: { id: string; lookup_key?: string }[]) => {
      subscriptionRecord = { providerSubscriptionId: 'sub_live' };
      subscriptions.retrieve.mockResolvedValue({
        id: 'sub_live',
        status: 'active',
        items: {
          data: items.map(({ id, lookup_key }) => ({
            id,
            price: { id: `price_${id}`, lookup_key },
          })),
        },
      });
    };

    beforeEach(() => {
      prices.list.mockImplementation(
        ({ lookup_keys }: { lookup_keys: string[] }) =>
          Promise.resolve({
            data: [
              ...(lookup_keys.includes(PRO_KEY)
                ? [
                    {
                      id: 'price_leadgen_pro',
                      lookup_key: PRO_KEY,
                      active: true,
                      type: 'recurring',
                      currency: 'usd',
                      unit_amount: LEAD_GEN_TIERS.PRO.price * 100,
                      recurring: { interval: 'month', interval_count: 1 },
                    },
                  ]
                : []),
              ...(lookup_keys.includes(GUARD_26_50) ? [planPrice()] : []),
              ...(lookup_keys.includes(COMPLETE_1_25)
                ? [
                    planPrice({
                      id: 'price_complete_1_25',
                      lookup_key: COMPLETE_1_25,
                      unit_amount: 49_900,
                    }),
                  ]
                : []),
            ],
          }),
      );
    });

    // Complete contains Lead Gen. Leaving the add-on in place would bill the
    // customer twice for one product.
    it('drops the Lead Gen line when moving to Complete', async () => {
      live([
        { id: 'si_guard', lookup_key: GUARD_1_25 },
        { id: 'si_leadgen', lookup_key: PRO_KEY },
      ]);

      await service.createPlanCheckoutSession({
        tenantId: 'tenant-1',
        packageKey: 'COMPLETE',
        band: '1-25',
      });

      expect(subscriptions.update).toHaveBeenCalledWith(
        'sub_live',
        expect.objectContaining({
          items: [
            { id: 'si_guard', price: 'price_complete_1_25', quantity: 1 },
            { id: 'si_leadgen', deleted: true },
          ],
        }),
      );
    });

    it('adds Lead Gen without touching the Guard line', async () => {
      live([{ id: 'si_guard', lookup_key: GUARD_1_25 }]);

      await service.createPlanCheckoutSession({
        tenantId: 'tenant-1',
        packageKey: 'GENERATION',
        band: '1-25',
        tier: 'PRO',
      });

      expect(subscriptions.update).toHaveBeenCalledWith(
        'sub_live',
        expect.objectContaining({
          items: [{ price: 'price_leadgen_pro', quantity: 1 }],
        }),
      );
    });

    it('keeps the Lead Gen line when the guard-banded package changes', async () => {
      live([
        { id: 'si_guard', lookup_key: GUARD_1_25 },
        { id: 'si_leadgen', lookup_key: PRO_KEY },
      ]);

      await buyGuard();

      expect(subscriptions.update).toHaveBeenCalledWith(
        'sub_live',
        expect.objectContaining({
          items: [{ id: 'si_guard', price: 'price_guard_26_50', quantity: 1 }],
        }),
      );
    });

    it('replaces one Lead Gen plan with another rather than stacking them', async () => {
      live([
        { id: 'si_guard', lookup_key: GUARD_1_25 },
        { id: 'si_leadgen', lookup_key: leadGenTierLookupKey('STARTER') },
      ]);

      await service.createPlanCheckoutSession({
        tenantId: 'tenant-1',
        packageKey: 'GENERATION',
        band: '1-25',
        tier: 'PRO',
      });

      expect(subscriptions.update).toHaveBeenCalledWith(
        'sub_live',
        expect.objectContaining({
          items: [
            { id: 'si_leadgen', price: 'price_leadgen_pro', quantity: 1 },
          ],
        }),
      );
    });
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
  /**
   * trial_period_days used to be attached to every new checkout session with
   * no record of whether this tenant had already had one, so subscribe ->
   * trial -> cancel -> subscribe again handed out another free period, for as
   * long as someone was willing to re-checkout. It was harmless only because
   * STRIPE_TRIAL_DAYS happened to be unset, which is not a control.
   */
  describe('free trial', () => {
    it('gives a trial to a tenant that has never been provisioned', async () => {
      process.env.STRIPE_TRIAL_DAYS = '14';

      await buyGuard();

      const [session] = sessions.create.mock.calls[0] as [
        { subscription_data: Record<string, unknown> },
      ];
      expect(session.subscription_data.trial_period_days).toBe(14);
    });

    it('refuses a second trial to a tenant that has subscribed before', async () => {
      process.env.STRIPE_TRIAL_DAYS = '14';
      hasPriorModules = true;

      await buyGuard();

      const [session] = sessions.create.mock.calls[0] as [
        { subscription_data: Record<string, unknown> },
      ];
      expect(session.subscription_data).not.toHaveProperty('trial_period_days');
    });

    // Module rows are deactivated rather than deleted, so a cancelled
    // customer still carries the history that denies them a fresh trial.
    it('still refuses after the previous subscription was cancelled', async () => {
      process.env.STRIPE_TRIAL_DAYS = '30';
      hasPriorModules = true;
      subscriptionRecord = { providerSubscriptionId: null };

      await buyGuard();

      const [session] = sessions.create.mock.calls[0] as [
        { subscription_data: Record<string, unknown> },
      ];
      expect(session.subscription_data).not.toHaveProperty('trial_period_days');
    });

    it('sends no trial field at all when trials are switched off', async () => {
      delete process.env.STRIPE_TRIAL_DAYS;

      await buyGuard();

      const [session] = sessions.create.mock.calls[0] as [
        { subscription_data: Record<string, unknown> },
      ];
      expect(session.subscription_data).not.toHaveProperty('trial_period_days');
    });
  });
});
