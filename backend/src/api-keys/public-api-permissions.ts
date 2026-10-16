import { ServiceModule } from '@prisma/client';
import { serviceForPermissionModule } from '../entitlements/entitlements.constants';

export type PublicApiPermissionDefinition = {
  key: string;
  name: string;
  description: string;
  group: string;
};

export const PUBLIC_API_PERMISSIONS: PublicApiPermissionDefinition[] = [
  {
    key: 'clients.read',
    name: 'Read clients',
    description: 'List and read client records.',
    group: 'Clients',
  },
  {
    key: 'clients.write',
    name: 'Write clients',
    description: 'Create client records.',
    group: 'Clients',
  },
  {
    key: 'sites.read',
    name: 'Read sites',
    description: 'List and read site records.',
    group: 'Sites',
  },
  {
    key: 'sites.write',
    name: 'Write sites',
    description: 'Create site records.',
    group: 'Sites',
  },
  {
    key: 'guards.read',
    name: 'Read guards',
    description: 'List and read guard records.',
    group: 'Guards',
  },
  {
    key: 'guards.write',
    name: 'Write guards',
    description: 'Create guard records.',
    group: 'Guards',
  },
  {
    key: 'shifts.read',
    name: 'Read shifts',
    description: 'List and read shift records.',
    group: 'Shifts',
  },
  {
    key: 'shifts.write',
    name: 'Write shifts',
    description: 'Create shifts and assign guards.',
    group: 'Shifts',
  },
  {
    key: 'incidents.read',
    name: 'Read incidents',
    description: 'List and read incident records.',
    group: 'Incidents',
  },
  {
    key: 'incidents.write',
    name: 'Write incidents',
    description: 'Submit incident records.',
    group: 'Incidents',
  },
  {
    key: 'invoices.read',
    name: 'Read invoices',
    description: 'List and read invoices.',
    group: 'Invoices',
  },
  {
    key: 'reports.read',
    name: 'Read reports',
    description: 'List and read daily service reports.',
    group: 'Reports',
  },
];

export const PUBLIC_API_PERMISSION_KEYS = PUBLIC_API_PERMISSIONS.map(
  (permission) => permission.key,
);

/**
 * The sellable service a public API scope belongs to, or null when the scope
 * only reads core data every tenant keeps whatever they bought.
 *
 * Derived from the scope's own prefix rather than a second hand-written map.
 * Every scope is named `<permission module>.<read|write>`, and
 * PERMISSION_MODULE_TO_SERVICE already classifies those same modules for the
 * JWT-authenticated controllers. A separate map here would be a second source
 * of truth that drifts the first time a service moves -- and a drift in this
 * direction is a revenue hole, not a cosmetic bug.
 */
export function serviceForPublicApiPermission(
  key: string,
): ServiceModule | null {
  return serviceForPermissionModule(key.split('.')[0]);
}
