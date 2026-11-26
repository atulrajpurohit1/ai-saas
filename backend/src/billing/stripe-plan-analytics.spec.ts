import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

describe('Stripe plan invoice analytics', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;

  afterAll(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it('counts only paid USD subscription invoices for known tenant customers', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_analytics';
    const prisma = {
      tenantSubscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ providerCustomerId: 'cus_ours' }]),
      },
    } as unknown as PrismaService;
    const service = new StripeService(prisma);
    const paidAt = Math.floor(Date.parse('2026-11-15T00:00:00.000Z') / 1000);
    const invoice = (id: string, overrides: Record<string, unknown> = {}) => ({
      id,
      customer: 'cus_ours',
      billing_reason: 'subscription_cycle',
      status_transitions: { paid_at: paidAt },
      created: paidAt,
      amount_paid: 14900,
      currency: 'usd',
      ...overrides,
    });
    const list = jest
      .fn()
      .mockReturnValue([
        invoice('in_valid'),
        invoice('in_other_customer', { customer: 'cus_other' }),
        invoice('in_one_off', { billing_reason: 'manual' }),
        invoice('in_zero', { amount_paid: 0 }),
        invoice('in_eur', { currency: 'eur' }),
      ]);
    (service as unknown as { client: unknown }).client = { invoices: { list } };

    await expect(
      service.paidPlanInvoices(new Date('2026-11-01T00:00:00.000Z')),
    ).resolves.toEqual([
      {
        id: 'in_valid',
        paidAt: new Date(paidAt * 1000),
        amountUsd: 149,
        reason: 'subscription_cycle',
      },
    ]);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid' }),
    );
  });
});
