import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return full.endsWith('.controller.ts') ? [full] : [];
  });
}

function relative(file: string) {
  return file.replace(SRC_ROOT, '').replace(/\\/g, '/');
}

/**
 * Controllers a tenant may reach WITHOUT a plan.
 *
 * This list is the whole policy. Everything not on it must carry PlanGuard, so
 * adding a controller here is a decision somebody makes, not a gap nobody
 * noticed -- the same shape as ALTERNATIVE_ENTRY_ROUTES in
 * entitlements-coverage.spec.ts.
 *
 * The rule for being on it: the route must be needed to SIGN IN, to SEE that a
 * plan is required, or to BUY one -- or it must not be tenant-scoped at all.
 * No route here may serve tenant business data.
 */
const ALLOWED_WITHOUT_PLAN: Record<string, string> = {
  // Sign in, sign out, register, verify email, refresh, reset password.
  // Without these a tenant whose plan lapsed could not log in to renew.
  '/auth/auth.controller.ts': 'authentication',
  '/client-auth/client-auth.controller.ts': 'authentication',
  '/guard-auth/guard-auth.controller.ts': 'authentication',

  // GET /users/me. The session bootstrap every screen waits on, and what
  // carries entitlements.hasPlan to the frontend -- gating it would leave the
  // client unable to find out that it needs a plan.
  '/users/users.controller.ts': 'session bootstrap',

  // The plan page, pricing, Stripe checkout and the billing portal. This is
  // where a no-plan tenant goes to stop being one.
  '/billing/billing.controller.ts': 'buying a plan',
  '/billing/stripe-webhook.controller.ts': 'unauthenticated Stripe callback',

  // Account security: password change, MFA, and listing/revoking your own
  // sessions. Kept open deliberately -- a customer must be able to revoke a
  // stolen session or rotate a leaked password whether or not they are paying.
  '/account-security/account-security.controller.ts': 'account security',
  '/sessions/sessions.controller.ts': 'account security',

  // Platform staff, authenticated as their own entity against their own JWT
  // secret. They must reach a no-plan tenant in order to comp it.
  '/platform/platform-monitoring.controller.ts': 'platform admin',
  '/platform/tenant-admin.controller.ts': 'platform admin',
  '/platform-auth/platform-auth.controller.ts': 'platform admin',
  '/billing/comp.controller.ts': 'platform admin',

  // Not tenant-scoped: infrastructure and static docs.
  '/health/health.controller.ts': 'infrastructure',
  '/app.controller.ts': 'infrastructure',
  '/api-docs/api-docs.controller.ts': 'infrastructure',

  // Tenant-scoped, but authenticated by API key and invitation token rather
  // than a JWT, so PlanGuard cannot read a tenant off the request. Each
  // enforces hasAnyPlan itself: PublicApiKeyGuard.assertEntitled and
  // VendorPortalService.findByTokenOrThrow. The last two tests hold them to it.
  '/public-api/public-api.controller.ts': 'enforced in PublicApiKeyGuard',
  '/vendor-portal/vendor-portal.controller.ts':
    'enforced in VendorPortalService',
};

describe('plan coverage', () => {
  /**
   * The core rule: using the product requires a plan.
   *
   * ModuleGuard cannot express this. It gates a controller on ONE service, and
   * waves through the CORE modules (clients, sites, documents, notes,
   * activities, branches, integrations, users, roles, dashboard, audit) that
   * all three services share. A tenant that had bought nothing therefore still
   * got a working CRM out of those core modules. PlanGuard closes that, and
   * this test keeps it closed.
   */
  it('puts PlanGuard on every tenant-facing controller', () => {
    const unguarded = controllerFiles(SRC_ROOT).filter((file) => {
      const name = relative(file);
      if (ALLOWED_WITHOUT_PLAN[name]) return false;

      const contents = readFileSync(file, 'utf8');
      // Tenant-facing means authenticated as a tenant user. A controller with
      // no JwtAuthGuard is either unauthenticated or uses another mechanism,
      // and must be listed above with its reason.
      if (!contents.includes('JwtAuthGuard')) return false;

      return !contents.includes('PlanGuard');
    });

    expect(unguarded.map(relative)).toEqual([]);
  });

  /**
   * PlanGuard must run AFTER JwtAuthGuard, because it reads the tenant off
   * request.user, which JwtAuthGuard populates. Listed first it would see no
   * user, find no tenant, and allow everything -- a silent no-op that looks
   * exactly like a working gate.
   */
  it('orders PlanGuard after JwtAuthGuard in every guard chain', () => {
    const misordered = controllerFiles(SRC_ROOT).flatMap((file) => {
      const contents = readFileSync(file, 'utf8');

      return [...contents.matchAll(/@UseGuards\(([^)]*)\)/g)]
        .filter(([, args]) => args.includes('PlanGuard'))
        .filter(([, args]) => {
          const guards = args.split(',').map((guard) => guard.trim());
          const jwt = guards.indexOf('JwtAuthGuard');
          return jwt === -1 || guards.indexOf('PlanGuard') < jwt;
        })
        .map(([match]) => `${relative(file)} :: ${match}`);
    });

    expect(misordered).toEqual([]);
  });

  /**
   * Every @UseGuards chain in a tenant-facing controller needs PlanGuard, not
   * just one of them. BrandingController declares its guards per route with no
   * class-level chain, so a file-level check would pass while a single route
   * sat open.
   */
  it('covers every guard chain in a guarded controller, not just the first', () => {
    const partial = controllerFiles(SRC_ROOT).flatMap((file) => {
      // An exempt controller is exempt wholesale, so skip it here as the
      // first test does. Without this, merely NAMING PlanGuard in a comment --
      // which the exempt controllers do, to say why they are exempt -- opts
      // the file into a check it is not subject to.
      if (ALLOWED_WITHOUT_PLAN[relative(file)]) return [];

      const contents = readFileSync(file, 'utf8');
      if (!contents.includes('PlanGuard')) return [];
      // A class-level chain covers every route in the class.
      const classLevel = /\n@UseGuards\([^)]*PlanGuard[^)]*\)/.test(contents);
      if (classLevel) return [];

      return [...contents.matchAll(/@UseGuards\(([^)]*)\)/g)]
        .filter(([, args]) => args.includes('JwtAuthGuard'))
        .filter(([, args]) => !args.includes('PlanGuard'))
        .map(([match]) => `${relative(file)} :: ${match}`);
    });

    expect(partial).toEqual([]);
  });

  // The two token/key-authenticated surfaces PlanGuard cannot reach. They are
  // exempt above only because they enforce the same rule themselves; if either
  // call is removed, the exemption becomes a hole and these fail.
  it('enforces hasAnyPlan on the public API', () => {
    const source = readFileSync(
      join(SRC_ROOT, 'public-api', 'public-api-key.guard.ts'),
      'utf8',
    );
    expect(source).toMatch(/hasAnyPlan/);
  });

  it('enforces hasAnyPlan on the vendor portal', () => {
    const source = readFileSync(
      join(SRC_ROOT, 'vendor-portal', 'vendor-portal.service.ts'),
      'utf8',
    );
    expect(source).toMatch(/hasAnyPlan/);
  });
});
