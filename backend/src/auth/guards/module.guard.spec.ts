import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServiceModule } from '@prisma/client';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { ModuleGuard } from './module.guard';

describe('ModuleGuard', () => {
  let guard: ModuleGuard;
  let reflector: { getAllAndMerge: jest.Mock };
  let entitlements: { hasAnyModule: jest.Mock };

  const contextFor = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getClass: () => class {},
      getHandler: () => () => undefined,
    }) as unknown as ExecutionContext;

  const requiring = (modules: ServiceModule[]) => {
    reflector.getAllAndMerge.mockReturnValue(modules);
  };

  beforeEach(() => {
    reflector = { getAllAndMerge: jest.fn() };
    entitlements = { hasAnyModule: jest.fn().mockResolvedValue(true) };
    guard = new ModuleGuard(
      reflector as unknown as Reflector,
      entitlements as unknown as EntitlementsService,
    );
  });

  it('allows a route that declares no module', async () => {
    requiring([]);

    await expect(guard.canActivate(contextFor({ tenantId: 't1' }))).resolves.toBe(
      true,
    );
    expect(entitlements.hasAnyModule).not.toHaveBeenCalled();
  });

  it('allows when the tenant owns the module', async () => {
    requiring(['LEAD_GEN']);

    await expect(guard.canActivate(contextFor({ tenantId: 't1' }))).resolves.toBe(
      true,
    );
    expect(entitlements.hasAnyModule).toHaveBeenCalledWith('t1', ['LEAD_GEN']);
  });

  it('denies an unauthenticated request', async () => {
    requiring(['LEAD_GEN']);

    await expect(guard.canActivate(contextFor(undefined))).resolves.toBe(false);
    expect(entitlements.hasAnyModule).not.toHaveBeenCalled();
  });

  it('denies a user carrying no tenant', async () => {
    requiring(['LEAD_GEN']);

    await expect(guard.canActivate(contextFor({ sub: 'u1' }))).resolves.toBe(
      false,
    );
  });

  describe('when the tenant lacks the module', () => {
    beforeEach(() => {
      requiring(['GUARD_TOUR']);
      entitlements.hasAnyModule.mockResolvedValue(false);
    });

    it('throws Forbidden rather than returning false', async () => {
      await expect(
        guard.canActivate(contextFor({ tenantId: 't1' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // The frontend routes to the upgrade page off `upgradeRequired`, so this
    // must stay distinguishable from an ordinary permission denial.
    it('marks the response as an upgrade prompt, not a permission error', async () => {
      const error = await guard
        .canActivate(contextFor({ tenantId: 't1' }))
        .catch((caught: ForbiddenException) => caught);

      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({
          statusCode: 403,
          upgradeRequired: true,
          modules: ['GUARD_TOUR'],
          message: expect.stringContaining('Guard Tour'),
        }),
      );
    });
  });

  it('denies a Super Admin at a tenant that never bought the module', async () => {
    requiring(['FINANCE']);
    entitlements.hasAnyModule.mockResolvedValue(false);

    // Entitlement is deliberately not overridable by role: buying is a tenant
    // fact, and isSuperAdmin bypasses PermissionGuard but must not bypass this.
    await expect(
      guard.canActivate(contextFor({ tenantId: 't1', isSuperAdmin: true })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
