import { ALLOW_WITHOUT_PLAN_KEY } from '../auth/decorators/allow-without-plan.decorator';
import { SERVICE_MODULES_KEY } from '../auth/decorators/module.decorator';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('CreditsController access', () => {
  it('shows balances without a plan while requiring Lead Gen to buy credits', () => {
    for (const route of ['getBalance', 'getPacks', 'getLedger'] as const) {
      expect(Reflect.getMetadata(ALLOW_WITHOUT_PLAN_KEY, CreditsController.prototype[route])).toBe(true);
      expect(Reflect.getMetadata(SERVICE_MODULES_KEY, CreditsController.prototype[route])).toBeUndefined();
    }
    expect(Reflect.getMetadata(ALLOW_WITHOUT_PLAN_KEY, CreditsController.prototype.purchase)).toBe(true);
    expect(Reflect.getMetadata(SERVICE_MODULES_KEY, CreditsController.prototype.purchase)).toBeUndefined();
    expect(Reflect.getMetadata(SERVICE_MODULES_KEY, CreditsController.prototype.grant)).toEqual(['LEAD_GEN']);
  });

  it('requires active Lead Gen for the first paid credit purchase, then allows top-ups', async () => {
    const credits = { hasPaidCreditPurchase: jest.fn().mockResolvedValue(false) };
    const stripe = { createCreditPackCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://checkout.example' }) };
    const entitlements = { hasAnyModule: jest.fn().mockResolvedValue(false) };
    const controller = new CreditsController(
      credits as unknown as CreditsService,
      stripe as unknown as StripeService,
      {} as AuditService,
      entitlements as unknown as EntitlementsService,
    );
    const user = { tenantId: 'tenant-1', email: 'owner@example.com' } as ActiveUser;
    const pack = { pack: 'STARTER' } as Parameters<CreditsController['purchase']>[1];

    await expect(controller.purchase(user, pack)).rejects.toThrow('first paid credits');
    expect(stripe.createCreditPackCheckoutSession).not.toHaveBeenCalled();

    entitlements.hasAnyModule.mockResolvedValue(true);
    await controller.purchase(user, pack);
    expect(stripe.createCreditPackCheckoutSession).toHaveBeenCalledTimes(1);

    entitlements.hasAnyModule.mockResolvedValue(false);
    credits.hasPaidCreditPurchase.mockResolvedValue(true);
    await controller.purchase(user, pack);
    expect(stripe.createCreditPackCheckoutSession).toHaveBeenCalledTimes(2);
    expect((await controller.getPacks(user)).canBuyCredits).toBe(true);
  });
});
