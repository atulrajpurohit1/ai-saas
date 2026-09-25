import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { ServiceModule } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaExceptionFilter } from '../src/prisma/prisma-exception.filter';
import { EntitlementsService } from '../src/entitlements/entitlements.service';

/**
 * End-to-end coverage for standalone service entitlements.
 *
 * Talks to the real database over real HTTP. Provisions one tenant per
 * purchasable combination (all 7 of them), then asserts that each tenant can
 * reach exactly the services it bought -- no more, no less -- and that core
 * routes stay reachable for everyone.
 *
 * The admin user in every fixture is `isSuperAdmin: true` ON PURPOSE.
 * isSuperAdmin bypasses PermissionGuard, so if entitlement were merely a
 * permission filter these tests would all pass vacuously. They only pass
 * because ModuleGuard treats buying as a tenant fact that no role overrides.
 *
 * Everything is deleted in afterAll.
 */

const PASSWORD = 'Passw0rd!123';

// One representative GET per service, plus core routes everyone keeps.
const LEAD_GEN_ROUTES = ['/leads', '/deals', '/proposals'];
const GUARD_TOUR_ROUTES = ['/guards', '/v2/guards', '/checkpoints'];
// Scheduling lives with Operations, not Guard: rostering the workforce is
// planning, and timesheets are what invoicing is built on. A Guard-only
// tenant is therefore refused /v2/shifts and /timesheets.
const FINANCE_ROUTES = [
  '/invoices',
  '/rate-cards',
  '/v2/shifts',
  '/timesheets',
];
const CORE_ROUTES = ['/sites', '/dashboard/summary', '/billing'];

const ROUTES_BY_MODULE: Record<ServiceModule, string[]> = {
  LEAD_GEN: LEAD_GEN_ROUTES,
  GUARD_TOUR: GUARD_TOUR_ROUTES,
  FINANCE: FINANCE_ROUTES,
};

const ALL_MODULES: ServiceModule[] = ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'];

// Every combination a customer could actually buy: 3 standalone, 3 pairs, 1 bundle.
const COMBINATIONS: ServiceModule[][] = [
  ['LEAD_GEN'],
  ['GUARD_TOUR'],
  ['FINANCE'],
  ['LEAD_GEN', 'GUARD_TOUR'],
  ['LEAD_GEN', 'FINANCE'],
  ['GUARD_TOUR', 'FINANCE'],
  ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'],
];

const label = (modules: ServiceModule[]) => modules.join('+');

describe('Standalone service entitlements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let entitlements: EntitlementsService;
  let http: App;

  const TAG = `ent-e2e-${Date.now()}`;
  const tenantIds: string[] = [];
  const tokenByCombination = new Map<string, string>();

  async function createTenant(modules: ServiceModule[], suffix: string) {
    const tenant = await prisma.tenant.create({
      data: { name: `${TAG} ${suffix}`, slug: `${TAG}-${suffix}` },
    });
    tenantIds.push(tenant.id);

    await prisma.tenantSubscription.create({
      data: { tenantId: tenant.id, status: 'ACTIVE' },
    });
    if (modules.length) {
      await prisma.tenantModule.createMany({
        data: modules.map((module) => ({ tenantId: tenant.id, module })),
      });
    }

    await prisma.user.create({
      data: {
        email: `admin-${suffix}@${TAG}.test`,
        password: await bcrypt.hash(PASSWORD, 10),
        name: `Admin ${suffix}`,
        tenantId: tenant.id,
        isSuperAdmin: true,
        role: 'ADMIN',
        emailVerified: true,
      },
    });

    return tenant.id;
  }

  async function login(suffix: string) {
    const res = await request(http)
      .post('/auth/login')
      .send({ email: `admin-${suffix}@${TAG}.test`, password: PASSWORD });
    expect(res.status).toBe(200);
    return (res.body as { access_token: string }).access_token;
  }

  const get = (path: string, token: string) =>
    request(http).get(path).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    entitlements = app.get(EntitlementsService);
    http = app.getHttpServer();

    for (const modules of COMBINATIONS) {
      const suffix = modules.map((m) => m[0]).join('').toLowerCase();
      await createTenant(modules, suffix);
      tokenByCombination.set(label(modules), await login(suffix));
    }
  }, 180_000);

  afterAll(async () => {
    for (const tenantId of tenantIds) {
      await prisma.userRoleAssignment
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.rolePermission
        .deleteMany({ where: { role: { tenantId } } })
        .catch(() => undefined);
      await prisma.role.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.tenantModule
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenantSubscription
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    }
    await app?.close();
  }, 120_000);

  describe.each(COMBINATIONS.map((modules) => [label(modules), modules] as const))(
    'tenant owning %s',
    (name, modules) => {
      const owned = new Set(modules);
      const missing = ALL_MODULES.filter((module) => !owned.has(module));

      it('reaches every route of every service it bought', async () => {
        const token = tokenByCombination.get(name)!;

        for (const module of modules) {
          for (const route of ROUTES_BY_MODULE[module]) {
            const res = await get(route, token);
            expect([res.status, route]).toEqual([200, route]);
          }
        }
      });

      it('is refused every route of every service it did not buy', async () => {
        const token = tokenByCombination.get(name)!;

        for (const module of missing) {
          for (const route of ROUTES_BY_MODULE[module]) {
            const res = await get(route, token);
            expect([res.status, route]).toEqual([403, route]);
          }
        }
      });

      it('keeps core routes regardless of what it bought', async () => {
        const token = tokenByCombination.get(name)!;

        for (const route of CORE_ROUTES) {
          const res = await get(route, token);
          expect([res.status, route]).toEqual([200, route]);
        }
      });

      it('advertises exactly the modules it bought in the session payload', async () => {
        const token = tokenByCombination.get(name)!;
        const res = await get('/users/me', token);

        expect(res.status).toBe(200);
        const active = (
          res.body as { entitlements: { modules: { key: string; active: boolean }[] } }
        ).entitlements.modules
          .filter((module) => module.active)
          .map((module) => module.key)
          .sort();

        expect(active).toEqual([...modules].sort());
      });

      if (missing.length) {
        it('strips unentitled permission keys from the session payload', async () => {
          const token = tokenByCombination.get(name)!;
          const res = await get('/users/me', token);
          const permissions = new Set(
            (res.body as { permissions: string[] }).permissions,
          );

          // Representative key per service, checked in both directions.
          const probe: Record<ServiceModule, string> = {
            LEAD_GEN: 'leads.view',
            GUARD_TOUR: 'patrols.view',
            FINANCE: 'invoices.view',
          };

          for (const module of modules) {
            expect([module, permissions.has(probe[module])]).toEqual([module, true]);
          }
          for (const module of missing) {
            expect([module, permissions.has(probe[module])]).toEqual([module, false]);
          }

          // Core keys survive whatever happens.
          expect(permissions.has('sites.view')).toBe(true);
          expect(permissions.has('dashboard.view')).toBe(true);
        });
      }
    },
  );

  describe('denial shape', () => {
    it('answers an unentitled route with an actionable upgrade prompt', async () => {
      const token = tokenByCombination.get('LEAD_GEN')!;
      const res = await get('/checkpoints', token);

      expect(res.status).toBe(403);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 403,
          upgradeRequired: true,
          modules: ['GUARD_TOUR'],
          message: expect.stringContaining('AegisLead Guard') as unknown as string,
        }),
      );
    });

    // isSuperAdmin short-circuits PermissionGuard. If it also short-circuited
    // ModuleGuard, every "is refused" case above would silently pass through.
    it('refuses a Super Admin, proving role does not override entitlement', async () => {
      const token = tokenByCombination.get('LEAD_GEN')!;

      const me = await get('/users/me', token);
      expect((me.body as { isSuperAdmin: boolean }).isSuperAdmin).toBe(true);

      const res = await get('/invoices', token);
      expect(res.status).toBe(403);
      expect((res.body as { upgradeRequired: boolean }).upgradeRequired).toBe(true);
    });
  });

  describe('subscription status', () => {
    let statusTenantId: string;
    let statusToken: string;

    beforeAll(async () => {
      statusTenantId = await createTenant(['LEAD_GEN'], 'status');
      statusToken = await login('status');
    }, 60_000);

    const setStatus = async (
      status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED',
    ) => {
      await prisma.tenantSubscription.update({
        where: { tenantId: statusTenantId },
        data: { status },
      });
      // The service caches per tenant; drop it so the next call re-reads.
      entitlements.invalidate(statusTenantId);
    };

    it('grants access while TRIALING', async () => {
      await setStatus('TRIALING');
      await expect(
        get('/leads', statusToken).then((res) => res.status),
      ).resolves.toBe(200);
    });

    // Dunning is a billing conversation, not a reason to strand a paying
    // customer mid-shift.
    it('keeps access while PAST_DUE', async () => {
      await setStatus('PAST_DUE');
      await expect(
        get('/leads', statusToken).then((res) => res.status),
      ).resolves.toBe(200);
    });

    it('revokes purchased services once CANCELED', async () => {
      await setStatus('CANCELED');
      await expect(
        get('/leads', statusToken).then((res) => res.status),
      ).resolves.toBe(403);
    });

    it('still serves core routes once CANCELED', async () => {
      await setStatus('CANCELED');
      await expect(
        get('/dashboard/summary', statusToken).then((res) => res.status),
      ).resolves.toBe(200);
    });

    it('restores access when the subscription becomes ACTIVE again', async () => {
      await setStatus('ACTIVE');
      await expect(
        get('/leads', statusToken).then((res) => res.status),
      ).resolves.toBe(200);
    });
  });

  describe('deactivating a single module', () => {
    let tenantId: string;
    let token: string;

    beforeAll(async () => {
      tenantId = await createTenant(['LEAD_GEN', 'GUARD_TOUR'], 'toggle');
      token = await login('toggle');
    }, 60_000);

    it('revokes only the module turned off, leaving the rest intact', async () => {
      await expect(get('/leads', token).then((r) => r.status)).resolves.toBe(200);
      await expect(get('/guards', token).then((r) => r.status)).resolves.toBe(200);

      await prisma.tenantModule.updateMany({
        where: { tenantId, module: 'GUARD_TOUR' },
        data: { isActive: false },
      });
      entitlements.invalidate(tenantId);

      await expect(get('/guards', token).then((r) => r.status)).resolves.toBe(403);
      await expect(get('/leads', token).then((r) => r.status)).resolves.toBe(200);
    });

    // Adding a service must be a single row flip, not a role migration --
    // that is the whole reason entitlement and permission are separate layers.
    it('restores access immediately when the module is turned back on', async () => {
      await prisma.tenantModule.updateMany({
        where: { tenantId, module: 'GUARD_TOUR' },
        data: { isActive: true },
      });
      entitlements.invalidate(tenantId);

      await expect(get('/guards', token).then((r) => r.status)).resolves.toBe(200);
    });
  });

  describe('tenant with no subscription row', () => {
    // A tenant created before this system existed that somehow missed the
    // backfill must not be locked out of a product it already pays for.
    it('fails open rather than stranding the customer', async () => {
      const tenant = await prisma.tenant.create({
        data: { name: `${TAG} legacy`, slug: `${TAG}-legacy` },
      });
      tenantIds.push(tenant.id);
      await prisma.user.create({
        data: {
          email: `admin-legacy@${TAG}.test`,
          password: await bcrypt.hash(PASSWORD, 10),
          name: 'Legacy Admin',
          tenantId: tenant.id,
          isSuperAdmin: true,
          role: 'ADMIN',
          emailVerified: true,
        },
      });

      const token = await login('legacy');

      for (const route of [...LEAD_GEN_ROUTES, ...GUARD_TOUR_ROUTES, ...FINANCE_ROUTES]) {
        const res = await get(route, token);
        expect([res.status, route]).toEqual([200, route]);
      }
    }, 60_000);
  });
});
