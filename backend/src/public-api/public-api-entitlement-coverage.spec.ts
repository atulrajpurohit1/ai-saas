import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PUBLIC_API_PERMISSIONS,
  serviceForPublicApiPermission,
} from '../api-keys/public-api-permissions';
import {
  CORE_PERMISSION_MODULES,
  PERMISSION_MODULE_TO_SERVICE,
} from '../entitlements/entitlements.constants';

const CONTROLLER = join(__dirname, 'public-api.controller.ts');

/**
 * The structural half of the public API gate. The guard enforces entitlements
 * per request, but it can only enforce what it can classify, and it only runs
 * the check when a route declares a scope. These tests pin both preconditions,
 * because a miss in either direction serves a paid service for free -- the
 * exact failure mode that went unnoticed here for as long as the module
 * existed.
 */
describe('public API entitlement coverage', () => {
  const source = readFileSync(CONTROLLER, 'utf8');

  // Every scope prefix must be a deliberate decision: either it names a
  // permission module tied to a sellable service, or that module is CORE. An
  // unclassified prefix resolves to null, which the guard reads as "core" and
  // waves through.
  it('classifies every public API scope as either core or sellable', () => {
    const core = new Set<string>(CORE_PERMISSION_MODULES);

    const unclassified = PUBLIC_API_PERMISSIONS.map(({ key }) => key).filter(
      (key) => {
        const permissionModule = key.split('.')[0];
        return (
          !core.has(permissionModule) &&
          !PERMISSION_MODULE_TO_SERVICE[permissionModule]
        );
      },
    );

    expect(unclassified).toEqual([]);
  });

  it('maps the sellable scopes to the service that actually sells them', () => {
    expect(serviceForPublicApiPermission('guards.write')).toBe('GUARD_TOUR');
    expect(serviceForPublicApiPermission('incidents.read')).toBe('GUARD_TOUR');
    expect(serviceForPublicApiPermission('reports.read')).toBe('GUARD_TOUR');
    expect(serviceForPublicApiPermission('shifts.write')).toBe('FINANCE');
    expect(serviceForPublicApiPermission('invoices.read')).toBe('FINANCE');
    expect(serviceForPublicApiPermission('clients.read')).toBeNull();
    expect(serviceForPublicApiPermission('sites.write')).toBeNull();
  });

  // A route with no @RequirePublicApiPermission is served to any valid key,
  // and the guard has no scope to derive a service from, so it is ungated
  // twice over.
  it('declares a scope on every route in the controller', () => {
    const undeclared = source
      .split(/\n(?= {2}@(?:Get|Post|Put|Patch|Delete)\()/)
      .slice(1)
      .filter((block) => !block.includes('@RequirePublicApiPermission('))
      .map((block) => block.split('\n')[0].trim());

    expect(undeclared).toEqual([]);
  });

  // Guards on the controller are declared once, at class level. If
  // PublicApiKeyGuard is ever dropped or replaced, every route below it loses
  // both authentication and the entitlement check in one edit.
  it('still wires PublicApiKeyGuard on the controller', () => {
    expect(source).toContain('@UseGuards(PublicApiKeyGuard)');
  });

  // Every scope the controller asks for must be one the key-management UI can
  // actually grant, or the endpoint is unreachable by any key.
  it('only requires scopes that exist in the permission registry', () => {
    const known = new Set(PUBLIC_API_PERMISSIONS.map(({ key }) => key));
    const required = [
      ...source.matchAll(/@RequirePublicApiPermission\('([^']+)'\)/g),
    ].map(([, scope]) => scope);

    expect(required.length).toBeGreaterThan(0);
    expect(required.filter((scope) => !known.has(scope))).toEqual([]);
  });
});
