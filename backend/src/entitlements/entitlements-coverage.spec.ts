import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { PERMISSIONS } from '../roles/rbac.constants';
import {
  CORE_PERMISSION_MODULES,
  PERMISSION_MODULE_TO_SERVICE,
  SERVICE_MODULES,
  serviceForPermissionModule,
} from './entitlements.constants';

const SRC_ROOT = join(__dirname, '..');

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return full.endsWith('.controller.ts') ? [full] : [];
  });
}

describe('entitlement coverage', () => {
  // Every permission module must be a deliberate decision: either it belongs
  // to a sellable service, or it is CORE. An unmapped module would silently
  // stay visible to tenants that never bought it.
  it('classifies every permission module as either a service or core', () => {
    const core = new Set<string>(CORE_PERMISSION_MODULES);
    const unmapped = [
      ...new Set(PERMISSIONS.map((permission) => permission.module)),
    ].filter(
      (module) => !core.has(module) && !PERMISSION_MODULE_TO_SERVICE[module],
    );

    expect(unmapped).toEqual([]);
  });

  it('never classifies a module as both core and sellable', () => {
    const overlap = CORE_PERMISSION_MODULES.filter(
      (module) => PERMISSION_MODULE_TO_SERVICE[module],
    );

    expect(overlap).toEqual([]);
  });

  it('maps only to real service modules', () => {
    const valid = new Set<string>(SERVICE_MODULES);
    const invalid = Object.entries(PERMISSION_MODULE_TO_SERVICE).filter(
      ([, service]) => !valid.has(service),
    );

    expect(invalid).toEqual([]);
  });

  it('returns null for a core module', () => {
    expect(serviceForPermissionModule('dashboard')).toBeNull();
    expect(serviceForPermissionModule('leads')).toBe('LEAD_GEN');
  });

  // A controller whose permissions are ENTIRELY sellable, yet carries no
  // @RequireModule, would serve that service to a tenant that never bought it.
  //
  // Controllers mixing core and sellable keys are excluded deliberately:
  // SitesController guards @RequireAnyPermission('sites.view',
  // 'shifts.create', 'invoices.generate'), where the sellable keys are
  // alternative ways in for Guard Tour and Finance users, not a gate. Sites
  // and clients are core data all three services read, so gating them on one
  // service would lock out the other two.
  // A file can hold several controllers. `GuardsAliasController` sat below
  // `GuardsController` in guards.controller.ts with ModuleGuard in its chain
  // but no @RequireModule of its own, so the guard waved every request
  // through and /guards served guard data to tenants without Guard Tour.
  // A per-file check cannot see that; this counts per class.
  it('declares a module on every controller class that wires ModuleGuard', () => {
    const undeclared = controllerFiles(SRC_ROOT).flatMap((file) => {
      const contents = readFileSync(file, 'utf8');
      if (!contents.includes('ModuleGuard')) return [];

      // Split on class declarations so each controller carries only its own
      // decorators, which sit immediately above it.
      const segments = contents.split(/^export class /m);
      const decoratorBlocks = segments.slice(0, -1);
      const classNames = segments
        .slice(1)
        .map((segment) => segment.match(/^\w+/)?.[0] ?? '(anonymous)');

      return classNames.flatMap((className, index) => {
        const block = decoratorBlocks[index + 1] ?? decoratorBlocks[index];
        if (!block?.includes('ModuleGuard')) return [];
        return block.includes('@RequireModule')
          ? []
          : [`${file.replace(SRC_ROOT, '')} :: ${className}`];
      });
    });

    expect(undeclared).toEqual([]);
  });

  it('gates every controller whose permissions are all sellable', () => {
    const moduleByKey = new Map(
      PERMISSIONS.map((permission) => [permission.key, permission.module]),
    );

    const ungated = controllerFiles(SRC_ROOT).filter((file) => {
      const contents = readFileSync(file, 'utf8');
      if (contents.includes('RequireModule')) return false;

      const permissionModules = [
        ...new Set(
          [...contents.matchAll(/'([a-z0-9_]+\.[a-z0-9_]+)'/g)]
            .map(([, key]) => moduleByKey.get(key))
            .filter((value): value is string => !!value),
        ),
      ];

      return (
        permissionModules.length > 0 &&
        permissionModules.every((module) => !!serviceForPermissionModule(module))
      );
    });

    expect(ungated.map((file) => file.replace(SRC_ROOT, ''))).toEqual([]);
  });
});
