import { ServiceUnavailableException } from '@nestjs/common';
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
