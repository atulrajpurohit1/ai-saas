import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  SYSTEM_ROLES,
  systemRolePermissionKeys,
} from './rbac.constants';

const SRC_ROOT = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!full.endsWith('.ts')) return [];
    if (full.endsWith('.spec.ts')) return [];
    return [full];
  });
}

// Permission keys referenced by @RequirePermission / @RequireAnyPermission.
function decoratorPermissionKeys(): Map<string, string[]> {
  const usage = new Map<string, string[]>();

  for (const file of sourceFiles(SRC_ROOT)) {
    const contents = readFileSync(file, 'utf8');
    const decorators = contents.matchAll(
      /@Require(?:Any)?Permissions?\(([^)]*)\)/g,
    );

    for (const decorator of decorators) {
      for (const [, key] of decorator[1].matchAll(/'([a-z0-9_]+\.[a-z0-9_]+)'/g)) {
        usage.set(key, [...(usage.get(key) ?? []), file]);
      }
    }
  }

  return usage;
}

describe('RBAC catalog', () => {
  // Regression guard: patrols.* guarded 13 routes while absent from the
  // catalog, so ALL_PERMISSION_KEYS never contained them and no role -- not
  // even Super Admin, whose '*' expands to ALL_PERMISSION_KEYS -- could pass
  // the check. Every guarded route was unreachable.
  it('catalogs every permission referenced by a route decorator', () => {
    const catalogued = new Set(ALL_PERMISSION_KEYS);
    const missing = [...decoratorPermissionKeys().entries()]
      .filter(([key]) => !catalogued.has(key))
      .map(([key, files]) => `${key} (used in ${files.length} file(s))`);

    expect(missing).toEqual([]);
  });

  it('grants every catalogued permission to at least one system role', () => {
    const granted = new Set(
      SYSTEM_ROLES.flatMap((role) => systemRolePermissionKeys(role.name)),
    );

    expect(ALL_PERMISSION_KEYS.filter((key) => !granted.has(key))).toEqual([]);
  });

  it('references only catalogued permissions from system roles', () => {
    const catalogued = new Set(ALL_PERMISSION_KEYS);
    const unknown = SYSTEM_ROLES.flatMap((role) =>
      systemRolePermissionKeys(role.name).filter((key) => !catalogued.has(key)),
    );

    expect([...new Set(unknown)]).toEqual([]);
  });

  it('has no duplicate permission keys', () => {
    const seen = new Set<string>();
    const duplicates = ALL_PERMISSION_KEYS.filter((key) => {
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });

    expect(duplicates).toEqual([]);
  });

  it('gives every permission a module', () => {
    expect(
      PERMISSIONS.filter((permission) => !permission.module?.trim()).map(
        (permission) => permission.key,
      ),
    ).toEqual([]);
  });
});
