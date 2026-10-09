import { BadRequestException } from '@nestjs/common';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { GuardMeteringService } from './guard-metering.service';
import { StripeService } from './stripe.service';

/**
 * The plan page lets a customer pick their guard band, so the server has to
 * be the one that refuses a band below the guards they actually run --
 * otherwise picking a lower row of the table is choosing your own discount.
 */
describe('BillingController plan checkout', () => {
  const user = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    email: 'owner@example.com',
  } as ActiveUser;

  let controller: BillingController;
  let stripe: { createPlanCheckoutSession: jest.Mock };
  let metering: { billableGuardCount: jest.Mock };

  beforeEach(() => {
    stripe = {
      createPlanCheckoutSession: jest
        .fn()
        .mockResolvedValue({ url: 'https://checkout.test', changed: false }),
    };
    metering = { billableGuardCount: jest.fn().mockResolvedValue(40) };

    controller = new BillingController(
      {} as BillingService,
      stripe as unknown as StripeService,
      metering as unknown as GuardMeteringService,
    );
  });

  it('refuses a band below the active guard count', async () => {
    // 40 active guards sits in 26-50, so 1-25 is below it.
    await expect(
      controller.createCheckoutSession(user, {
        package: 'GUARD',
        band: '1-25',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stripe.createPlanCheckoutSession).not.toHaveBeenCalled();
  });

  it('accepts the band the guards fall in', async () => {
    await controller.createCheckoutSession(user, {
      package: 'GUARD',
      band: '26-50',
    });
    expect(stripe.createPlanCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ packageKey: 'GUARD', band: '26-50' }),
    );
  });

  it('accepts a higher band than the guards require', async () => {
    await controller.createCheckoutSession(user, {
      package: 'COMPLETE',
      band: '101-250',
    });
    expect(stripe.createPlanCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ packageKey: 'COMPLETE', band: '101-250' }),
    );
  });

  // Generation on its own is a flat price whatever the headcount.
  it('always charges Generation at the base band', async () => {
    await controller.createCheckoutSession(user, {
      package: 'GENERATION',
      band: '251-500',
    });
    expect(stripe.createPlanCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ packageKey: 'GENERATION', band: '1-25' }),
    );
    expect(metering.billableGuardCount).not.toHaveBeenCalled();
  });
});
