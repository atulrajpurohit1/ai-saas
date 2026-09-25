import { ServiceModule } from '@prisma/client';

export const SERVICE_MODULES: ServiceModule[] = [
  'LEAD_GEN',
  'GUARD_TOUR',
  'FINANCE',
];

export const SERVICE_MODULE_LABELS: Record<ServiceModule, string> = {
  LEAD_GEN: 'Lead Gen',
  GUARD_TOUR: 'Guard Tour',
  FINANCE: 'Finance',
};

/**
 * Maps the `module` field already carried by every entry in PERMISSIONS
 * (rbac.constants.ts) onto the three sellable services.
 *
 * Permission modules absent from this map are CORE: always available, whatever
 * the tenant bought. `clients` and `sites` are CORE because all three services
 * read them -- a Lead Gen customer needs clients, a Guard Tour customer needs
 * sites. Splitting them would mean duplicating the records per service.
 */
export const PERMISSION_MODULE_TO_SERVICE: Record<string, ServiceModule> = {
  leads: 'LEAD_GEN',
  deals: 'LEAD_GEN',
  proposals: 'LEAD_GEN',
  prospect_search: 'LEAD_GEN',
  rfp: 'LEAD_GEN',
  vendors: 'LEAD_GEN',

  guards: 'GUARD_TOUR',
  patrols: 'GUARD_TOUR',
  shifts: 'GUARD_TOUR',
  incidents: 'GUARD_TOUR',
  timesheets: 'GUARD_TOUR',
  reports: 'GUARD_TOUR',

  invoices: 'FINANCE',
  invoice_disputes: 'FINANCE',
  finance: 'FINANCE',
  rate_cards: 'FINANCE',
};

/** Permission modules every tenant keeps regardless of entitlement. */
export const CORE_PERMISSION_MODULES = [
  'dashboard',
  'identity',
  'settings',
  'billing',
  'audit',
  'integrations',
  'branches',
  'clients',
  'sites',
  'documents',
  'notes',
  'activities',
  'ai',
] as const;

export function serviceForPermissionModule(
  permissionModule: string,
): ServiceModule | null {
  return PERMISSION_MODULE_TO_SERVICE[permissionModule] ?? null;
}

export function isServiceModule(value: string): value is ServiceModule {
  return (SERVICE_MODULES as string[]).includes(value);
}
