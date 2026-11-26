import { ALLOW_WITHOUT_PLAN_KEY } from '../auth/decorators/allow-without-plan.decorator';
import { SERVICE_MODULES_KEY } from '../auth/decorators/module.decorator';
import { CreditsController } from './credits.controller';

describe('CreditsController access', () => {
  it('shows balances without a plan while requiring Lead Gen to buy credits', () => {
    for (const route of ['getBalance', 'getPacks', 'getLedger'] as const) {
      expect(Reflect.getMetadata(ALLOW_WITHOUT_PLAN_KEY, CreditsController.prototype[route])).toBe(true);
      expect(Reflect.getMetadata(SERVICE_MODULES_KEY, CreditsController.prototype[route])).toBeUndefined();
    }
    expect(Reflect.getMetadata(ALLOW_WITHOUT_PLAN_KEY, CreditsController.prototype.purchase)).toBeUndefined();
    expect(Reflect.getMetadata(SERVICE_MODULES_KEY, CreditsController.prototype.purchase)).toEqual(['LEAD_GEN']);
  });
});
