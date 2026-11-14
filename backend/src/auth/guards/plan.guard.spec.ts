import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanGuard } from './plan.guard';
import { ALLOW_WITHOUT_PLAN_KEY } from '../decorators/allow-without-plan.decorator';

type Request = Record<string, unknown>;

function contextFor(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('PlanGuard', () => {
  let entitlements: { hasAnyPlan: jest.Mock };
  let reflector: Reflector;
  let guard: PlanGuard;

  beforeEach(() => {
    entitlements = { hasAnyPlan: jest.fn().mockResolvedValue(false) };
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    guard = new PlanGuard(reflector, entitlements as never);
  });

  it('refuses a tenant with no plan', async () => {
    const context = contextFor({ user: { tenantId: 'tenant-1' } });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(entitlements.hasAnyPlan).toHaveBeenCalledWith('tenant-1');
  });

  // The frontend routes on these flags rather than parsing the message:
  // `planRequired` picks the "choose a plan" screen, and `upgradeRequired` is
  // kept so clients that only know ModuleGuard's shape still land on the plan
  // page instead of showing a raw permission error.
  it('answers with the flags the client routes on', async () => {
    const context = contextFor({ user: { tenantId: 'tenant-1' } });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { planRequired: true, upgradeRequired: true, statusCode: 403 },
    });
  });

  it('admits a tenant that owns at least one service', async () => {
    entitlements.hasAnyPlan.mockResolvedValue(true);
    const context = contextFor({ user: { tenantId: 'tenant-1' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('admits an explicitly exempt route without consulting entitlements', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = contextFor({ user: { tenantId: 'tenant-1' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.hasAnyPlan).not.toHaveBeenCalled();
    // Guards against the exemption being read off the wrong metadata key,
    // which would silently exempt nothing.
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ALLOW_WITHOUT_PLAN_KEY,
      expect.anything(),
    );
  });

  it('reads the tenant off an API key when there is no user', async () => {
    entitlements.hasAnyPlan.mockResolvedValue(true);
    const context = contextFor({ publicApiKey: { tenantId: 'tenant-2' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.hasAnyPlan).toHaveBeenCalledWith('tenant-2');
  });

  // No tenant in context means an unauthenticated route. The guard is only
  // ever wired behind an authentication guard, so there is nothing to gate --
  // and it must not throw, or it would break the login routes it sits near.
  it('passes through a request carrying no tenant', async () => {
    const context = contextFor({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.hasAnyPlan).not.toHaveBeenCalled();
  });
});
