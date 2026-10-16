import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PublicApiKeyGuard } from './public-api-key.guard';

/**
 * The public API authenticates with an API key instead of a JWT, so it never
 * passes through ModuleGuard. That made it a complete bypass of entitlements:
 * `api_keys.manage` lives on the CORE `integrations` module, so any account --
 * including one that has bought nothing -- can mint a key carrying
 * `guards.write` or `invoices.read` and run Guard Tour and Operations through
 * /public/* for free. These tests pin the gate that closes it.
 */
describe('PublicApiKeyGuard entitlements', () => {
  const apiKey = {
    id: 'key-1',
    tenantId: 'tenant-1',
    name: 'Integration key',
    permissions: [
      'guards.read',
      'guards.write',
      'invoices.read',
      'clients.read',
    ],
    rateLimitPerMinute: 120,
  };

  let guard: PublicApiKeyGuard;
  let apiKeys: {
    authenticate: jest.Mock;
    touch: jest.Mock;
    logRequest: jest.Mock;
  };
  let entitlements: { hasModule: jest.Mock };
  let rateLimit: { check: jest.Mock };
  let requiredPermission: string | undefined;

  const context = () => {
    const request = {
      headers: { 'x-api-key': 'plain-key' },
      method: 'GET',
      originalUrl: '/public/guards',
    };

    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as never;
  };

  beforeEach(() => {
    requiredPermission = undefined;
    apiKeys = {
      authenticate: jest.fn().mockResolvedValue(apiKey),
      touch: jest.fn().mockResolvedValue(undefined),
      logRequest: jest.fn().mockResolvedValue(undefined),
    };
    entitlements = { hasModule: jest.fn().mockResolvedValue(false) };
    rateLimit = { check: jest.fn() };

    const reflector = {
      getAllAndOverride: jest.fn(() => requiredPermission),
    } as unknown as Reflector;

    guard = new PublicApiKeyGuard(
      reflector,
      apiKeys as never,
      rateLimit as never,
      entitlements as never,
    );
  });

  it('refuses a sellable scope the tenant has not bought', async () => {
    requiredPermission = 'guards.read';

    await expect(guard.canActivate(context())).rejects.toThrow(
      ForbiddenException,
    );
    expect(entitlements.hasModule).toHaveBeenCalledWith(
      'tenant-1',
      'GUARD_TOUR',
    );
  });

  it('answers an unentitled request as an upgrade, not a permission error', async () => {
    requiredPermission = 'invoices.read';

    await expect(guard.canActivate(context())).rejects.toMatchObject({
      response: {
        upgradeRequired: true,
        modules: ['FINANCE'],
      },
    });
  });

  it('logs the denial so the refusal shows up in the key audit trail', async () => {
    requiredPermission = 'guards.write';

    await expect(guard.canActivate(context())).rejects.toThrow();
    expect(apiKeys.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('allows a sellable scope once the module is owned', async () => {
    requiredPermission = 'guards.read';
    entitlements.hasModule.mockResolvedValue(true);

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  // Core records are read by all three services, so gating them on any one of
  // them would lock out the other two.
  it('allows a core scope with no modules at all', async () => {
    requiredPermission = 'clients.read';

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(entitlements.hasModule).not.toHaveBeenCalled();
  });

  // Order matters: an unentitled request must not consume rate-limit budget or
  // refresh the key's last-used timestamp, both of which would make a refused
  // call look like a served one.
  it('checks entitlement before the rate limit and the key touch', async () => {
    requiredPermission = 'guards.read';

    await expect(guard.canActivate(context())).rejects.toThrow();
    expect(rateLimit.check).not.toHaveBeenCalled();
    expect(apiKeys.touch).not.toHaveBeenCalled();
  });
});
