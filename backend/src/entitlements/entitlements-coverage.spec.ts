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

        // Declared at class level, OR on at least one route in the class.
        //
        // Per-route declaration is the right shape where a controller mixes
        // sellable and core routes: ClientPortalController gates its proposal
        // routes on LEAD_GEN while leaving documents and profile open, and
        // GuardPortalController leaves GET /guard/me open so a lapsed plan
        // surfaces as a locked feature rather than a broken login. What this
        // test is actually guarding against is ModuleGuard wired into the
        // chain with nothing declared anywhere, which makes the guard a no-op
        // and waves every request through.
        const body = segments[index + 1] ?? '';
        const declaresModule =
          block.includes('@RequireModule') || body.includes('@RequireModule');

        return declaresModule
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
        permissionModules.every(
          (module) => !!serviceForPermissionModule(module),
        )
      );
    });

    expect(ungated.map((file) => file.replace(SRC_ROOT, ''))).toEqual([]);
  });
  /**
   * Per-ROUTE gate check.
   *
   * The test above only flags a controller whose permissions are ENTIRELY
   * sellable. That blind spot was expensive: CrmConnectorsController mixed the
   * CORE `integrations` module with `leads`, so it was skipped -- while
   * `POST /crm-connectors/:provider/import-contacts` wrote Lead rows for any
   * account that had bought nothing, which is precisely the thing
   * LeadsController is gated to prevent. One core permission anywhere in the
   * file was enough to hide a sellable route.
   *
   * This checks each route on its own and allows the genuine exceptions by
   * name, so each one stays a decision somebody made rather than a gap nobody
   * noticed.
   */
  const ALTERNATIVE_ENTRY_ROUTES = new Set([
    // Core records that all three services read. The sellable keys are extra
    // ways in for Finance and Guard Tour users, not a gate -- requiring a
    // service here would lock out the other two, which is the opposite of
    // what these keys are for. All reads of core data.
    '/branches/branches.controller.ts :: @Get()',
    "/branches/branches.controller.ts :: @Get(':id')",
    '/clients/clients.controller.ts :: @Get()',
    '/sites/sites.controller.ts :: @Get()',
    // Aggregate insurance-compliance counts only, never policy detail or
    // documents; deliberately broadened so a finance-only user still sees the
    // advisory on the invoice screen.
    "/client-compliance/client-compliance.controller.ts :: @Get('summary')",
  ]);

  it('gates every route that touches a sellable module', () => {
    const moduleByKey = new Map(
      PERMISSIONS.map((permission) => [permission.key, permission.module]),
    );

    const ungated = controllerFiles(SRC_ROOT).flatMap((file) => {
      const contents = readFileSync(file, 'utf8');
      const segments = contents.split(
        /\n(?= {2}@(?:Get|Post|Put|Patch|Delete)\()/,
      );
      // Segment 0 holds the class-level decorators; a @RequireModule there
      // covers every route below it.
      const classGated = segments[0].includes('@RequireModule');

      return segments.slice(1).flatMap((segment) => {
        const route = segment.split('\n')[0].trim();
        // Decorators and signature only -- stop at the method body so a
        // permission string mentioned inside the implementation is not read
        // as a declaration.
        const head = segment.split(/\n {2}[a-zA-Z_]/)[0];

        if (classGated || head.includes('@RequireModule')) return [];

        const touchesSellable = [
          ...new Set(
            [...head.matchAll(/'([a-z0-9_]+\.[a-z0-9_]+)'/g)]
              .map(([, key]) => moduleByKey.get(key))
              .filter((value): value is string => !!value),
          ),
        ].some((module) => !!serviceForPermissionModule(module));

        const id = `${file.replace(SRC_ROOT, '').replace(/\\/g, '/')} :: ${route}`;
        return touchesSellable && !ALTERNATIVE_ENTRY_ROUTES.has(id) ? [id] : [];
      });
    });

    expect(ungated).toEqual([]);
  });
});
