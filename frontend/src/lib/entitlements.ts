import { NavLink } from './nav-links';

export type ServiceModuleKey = 'LEAD_GEN' | 'GUARD_TOUR' | 'FINANCE';

export interface EntitlementModule {
  key: ServiceModuleKey;
  name: string;
  active: boolean;
}

export interface Entitlements {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  /**
   * Whether AI (Gemini) features are available. False on the AegisLead Trial
   * plan. Optional because an older session/backend will not send it -- treat
   * absent as enabled so a working customer is never blanked (see `aiEnabled`).
   */
  aiEnabled?: boolean;
  /**
   * Whether this account has any plan at all.
   *
   * A plan is required to use the product: with none, the API refuses every
   * screen except the plan page, so the app shows "choose a plan" rather than
   * nav that only leads to 403s.
   *
   * Optional because an older backend does not send it. Absent is treated as
   * HAVING a plan (see `hasPlan`), so a working customer on a stale session is
   * never blanked -- the API is the real gate either way.
   */
  hasPlan?: boolean;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  /**
   * A complimentary plan the platform owner has queued behind this account's
   * paid one. It grants nothing today -- `modules` is still the paid plan --
   * and takes over when the paid plan ends.
   *
   * Optional: absent on an older session or backend, which is the same as
   * "nothing queued" for display purposes.
   */
  /**
   * The plan this account is on, named by the server.
   *
   * Trust this over working it out from `modules`: the modules cannot tell the
   * Trial plan from the Complete package, because both unlock all three
   * services, so deriving the name showed Trial customers a plan called
   * "AegisLead Complete".
   *
   * Optional: absent on an older backend, and null when there is no single
   * name to show (no services, or a mix that is not a package).
   */
  plan?: { key: string; name: string } | null;
  pendingPlan?: {
    key: string;
    name: string;
    /** Null when the start date is not known in advance. */
    startsAt?: string | null;
    /** How long it runs once it starts. Null is open-ended. */
    days?: number | null;
  } | null;
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
  calls: 'LEAD_GEN',
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

/**
 * Whether this account has any plan at all. A plan is required to use the
 * product, so `false` means every screen but the plan page is refused.
 *
 * Absent (older backend, or a session issued before `hasPlan` shipped) reads
 * as TRUE, matching how `aiEnabled` treats an absent flag: the API is the real
 * gate, and guessing "no plan" from a stale payload would blank a paying
 * customer's app over a missing field.
 */
export function hasPlan(entitlements?: Entitlements | null): boolean {
  return entitlements?.hasPlan !== false;
}

/**
 * The routes that still work with no plan at all.
 *
 * Mirrors the controllers deliberately left without PlanGuard on the API:
 * `billing` (the plan and billing screens, where they go to fix this),
 * `account-security` and the session/auth endpoints. Everything else answers
 * 403 for a tenant that has bought nothing.
 *
 * Kept as prefixes so query strings and sub-paths come along -- the Stripe
 * return URLs land on `/settings/plan?status=...` and must not bounce.
 *
 * Note `/settings/credits` is NOT here: credits.controller does carry
 * PlanGuard, so that screen is gated like the rest.
 */
const PLAN_EXEMPT_PREFIXES = [
  '/settings/plan',
  '/settings/billing',
  '/settings/security',
];

export function isRouteAllowedWithoutPlan(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return PLAN_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Query flag that tells the plan page to open the "choose a plan" dialog. */
export const PLAN_UPGRADE_PARAM = 'upgrade';

/**
 * Where a locked screen sends someone who has no plan.
 *
 * The nav keeps showing every feature to an account that has bought nothing --
 * hiding the product from a prospective customer helps nobody -- so each
 * locked entry simply POINTS here instead of at the screen it names. Swapping
 * the href rather than cancelling the click in JS keeps middle-click,
 * open-in-new-tab and prefetch all behaving honestly.
 *
 * `feature` and `service` are carried so the dialog can name what they were
 * reaching for ("Leads is part of AegisLead Generation") rather than showing
 * the same anonymous upsell every time.
 */
export function planUpgradeHref(options?: {
  feature?: string;
  service?: ServiceModuleKey | null;
}): string {
  const params = new URLSearchParams({ [PLAN_UPGRADE_PARAM]: '1' });
  if (options?.feature) params.set('feature', options.feature);
  if (options?.service) params.set('service', options.service);
  return `/settings/plan?${params.toString()}`;
}

export function activeModules(
  entitlements?: Entitlements | null,
): Set<ServiceModuleKey> {
  // An account with no plan owns nothing. Checked before the fallback below,
  // which would otherwise read "no active modules" as "stale payload" and hand
  // a no-plan tenant the whole nav.
  if (entitlements?.hasPlan === false) return new Set();

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
 * Whether AI (Gemini) features are available to this tenant. False only on the
 * Trial plan. Absent (older session/backend) is treated as enabled, so an
 * existing customer is never blanked -- the API enforces the real rule and
 * returns 403 AI_NOT_ON_PLAN regardless. Use this to hide or disable AI actions
 * for a Trial tenant rather than letting them click into a refusal.
 */
export function aiEnabled(entitlements?: Entitlements | null): boolean {
  return entitlements?.aiEnabled !== false;
}

/**
 * Which service a top-level route belongs to, for the one-time module welcome.
 *
 * An explicit route list rather than a reuse of serviceForPermission, because
 * routes and permission prefixes do not line up: /sales-calls is the `calls`
 * module, /patrol is `patrols`, and /settings spans everything. Routes that
 * are core, shared or unlisted answer null and show no welcome.
 *
 * Longest-prefix wins, so /invoice-disputes is not swallowed by /invoices.
 */
const ROUTE_SERVICE: Record<string, ServiceModuleKey> = {
  '/leads': 'LEAD_GEN',
  '/deals': 'LEAD_GEN',
  '/proposals': 'LEAD_GEN',
  '/prospect-search': 'LEAD_GEN',
  '/rfp': 'LEAD_GEN',
  '/vendors': 'LEAD_GEN',
  '/sales-calls': 'LEAD_GEN',
  '/sales-accelerator': 'LEAD_GEN',

  '/guards': 'GUARD_TOUR',
  '/patrol': 'GUARD_TOUR',
  '/incidents': 'GUARD_TOUR',
  '/reports': 'GUARD_TOUR',
  '/emergency-alerts': 'GUARD_TOUR',

  '/shifts': 'FINANCE',
  '/timesheets': 'FINANCE',
  '/invoices': 'FINANCE',
  '/invoice-disputes': 'FINANCE',
  '/finance': 'FINANCE',
  '/rate-cards': 'FINANCE',
};

export function serviceForPath(
  pathname: string | null | undefined,
): ServiceModuleKey | null {
  if (!pathname) return null;

  const match = Object.keys(ROUTE_SERVICE)
    .filter(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
    .sort((a, b) => b.length - a.length)[0];

  return match ? ROUTE_SERVICE[match] : null;
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

/** Comp-only plan that grants every module but withholds the AI features. */
export const TRIAL_PLAN_LABEL = 'AegisLead Trial Plan';

/**
 * The plan a tenant is on, for naming it.
 *
 * Prefers the name the server sends, which is the only thing that actually
 * knows. The fallback below -- all three services means Complete -- cannot
 * tell Complete from the Trial plan, which also unlocks all three; that is
 * exactly how Trial customers came to see "AegisLead Complete" as their plan.
 * The fallback is kept only for an older backend that sends no `plan`.
 *
 * Returns null for no services and for a mix that matches no package (two of
 * three, which is not sold), because there is no one name to show. Callers
 * fall back to listing the active services individually.
 */
export function subscribedPackage(
  entitlements?: Entitlements | null,
): 'GENERATION' | 'GUARD' | 'OPERATIONS' | 'COMPLETE' | 'TRIAL' | null {
  const named = entitlements?.plan?.key;
  if (
    named === 'GENERATION' ||
    named === 'GUARD' ||
    named === 'OPERATIONS' ||
    named === 'COMPLETE' ||
    named === 'TRIAL'
  ) {
    return named;
  }

  const active = activeModules(entitlements);
  if (active.size === SERVICE_MODULE_KEYS.length) return 'COMPLETE';
  if (active.size !== 1) return null;

  const [only] = [...active];
  return only === 'LEAD_GEN'
    ? 'GENERATION'
    : only === 'GUARD_TOUR'
      ? 'GUARD'
      : 'OPERATIONS';
}
