import { NavLink } from './nav-links';

export type ServiceModuleKey = 'LEAD_GEN' | 'GUARD_TOUR' | 'FINANCE';

export interface EntitlementModule {
  key: ServiceModuleKey;
  name: string;
  active: boolean;
}

export interface Entitlements {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  modules: EntitlementModule[];
}

export const SERVICE_MODULE_KEYS: ServiceModuleKey[] = [
  'LEAD_GEN',
  'GUARD_TOUR',
  'FINANCE',
];

export const SERVICE_MODULE_LABELS: Record<ServiceModuleKey, string> = {
  LEAD_GEN: 'AegisLead Generation',
  GUARD_TOUR: 'AegisLead Guard',
  FINANCE: 'AegisLead Operations',
};

/** The bundle of all three. Not a module -- a package name. */
export const COMPLETE_PACKAGE_LABEL = 'AegisLead Complete';

export const SERVICE_MODULE_TAGLINES: Record<ServiceModuleKey, string> = {
  LEAD_GEN: 'Find the opportunity. Know the buyer. Execute the sale.',
  GUARD_TOUR: 'Manage field operations, guard tours and accountability.',
  FINANCE: 'Scheduling, workforce management, finance and profitability.',
};

export const COMPLETE_PACKAGE_TAGLINE =
  'One platform. From opportunity to operation to revenue.';

export const SERVICE_MODULE_BLURBS: Record<ServiceModuleKey, string> = {
  LEAD_GEN:
    'Find and qualify prospects, run deals through the pipeline, and generate proposals and RFPs.',
  GUARD_TOUR:
    'Run patrol routes with checkpoint photo evidence, track incidents live, and hold the field accountable.',
  FINANCE:
    'Scheduling, workforce management, rate cards, invoicing and profitability reporting.',
};

/**
 * Mirrors backend `PERMISSION_MODULE_TO_SERVICE` in
 * `backend/src/entitlements/entitlements.constants.ts`.
 *
 * Permission prefixes absent here are CORE: available whatever the tenant
 * bought. `clients` and `sites` are CORE because all three services read them.
 *
 * This is presentation only -- ModuleGuard on the API is the real boundary, and
 * the session payload already omits unentitled keys. This map exists so the UI
 * can explain WHICH service a locked page belongs to, rather than just hiding
 * it.
 */
const PERMISSION_PREFIX_TO_SERVICE: Record<string, ServiceModuleKey> = {
  leads: 'LEAD_GEN',
  deals: 'LEAD_GEN',
  proposals: 'LEAD_GEN',
  prospect_search: 'LEAD_GEN',
  rfp: 'LEAD_GEN',
  vendors: 'LEAD_GEN',

  guards: 'GUARD_TOUR',
  patrols: 'GUARD_TOUR',
  incidents: 'GUARD_TOUR',
  reports: 'GUARD_TOUR',

  shifts: 'FINANCE',
  timesheets: 'FINANCE',
  invoices: 'FINANCE',
  invoice_disputes: 'FINANCE',
  finance: 'FINANCE',
  rate_cards: 'FINANCE',
};

export function serviceForPermission(
  permission: string,
): ServiceModuleKey | null {
  const prefix = permission.split('.')[0];
  return PERMISSION_PREFIX_TO_SERVICE[prefix] ?? null;
}

export function activeModules(
  entitlements?: Entitlements | null,
): Set<ServiceModuleKey> {
  // No entitlement payload: a session from before this shipped, or an older
  // backend. Assume everything rather than blanking a working customer's nav.
  if (!entitlements?.modules?.length) return new Set(SERVICE_MODULE_KEYS);

  return new Set(
    entitlements.modules
      .filter((module) => module.active)
      .map((module) => module.key),
  );
}

export function hasModule(
  entitlements: Entitlements | null | undefined,
  module: ServiceModuleKey,
) {
  return activeModules(entitlements).has(module);
}

/**
 * The single service a nav link belongs to, or null when it is core or spans
 * several. A link is only "locked" when every permission that opens it belongs
 * to the same unentitled service -- `/sites` lists `sites.view` alongside
 * sellable keys, and must stay available to everyone.
 */
export function serviceForLink(link: NavLink): ServiceModuleKey | null {
  const services = link.permissions.map(serviceForPermission);
  if (services.some((service) => service === null)) return null;

  const unique = [...new Set(services)] as ServiceModuleKey[];
  return unique.length === 1 ? unique[0] : null;
}

export function isLinkLocked(
  link: NavLink,
  entitlements?: Entitlements | null,
) {
  const service = serviceForLink(link);
  return service !== null && !activeModules(entitlements).has(service);
}

export function moduleSummary(entitlements?: Entitlements | null) {
  const active = activeModules(entitlements);

  return SERVICE_MODULE_KEYS.map((key) => ({
    key,
    name: SERVICE_MODULE_LABELS[key],
    tagline: SERVICE_MODULE_TAGLINES[key],
    blurb: SERVICE_MODULE_BLURBS[key],
    active: active.has(key),
  }));
}
