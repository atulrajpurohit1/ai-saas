import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { CreditEntryType, CreditReservationStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaExceptionFilter } from '../src/prisma/prisma-exception.filter';
import { CreditsService } from '../src/billing/credits.service';

/**
 * End-to-end coverage for Prospect Search credits.
 *
 * Talks to the real database over real HTTP. Two tenants are provisioned: one
 * that bought Lead Gen and one that did not, because the most valuable thing
 * this suite proves is that a tenant WITHOUT Lead Gen cannot buy credits it
 * would then be refused permission to spend -- a completed Stripe payment we
 * would have had to refund by hand.
 *
 * Stripe itself is never called. Checkout needs STRIPE_SECRET_KEY, which is
 * deliberately absent in test, so the purchase route is asserted to fail
 * closed (503) rather than half-work. Credits are granted through
 * CreditsService directly, which is the same path the webhook uses.
 *
 * Everything is deleted in afterAll.
 */

const PASSWORD = 'Passw0rd!123';

describe('Prospect Search credits (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let credits: CreditsService;
  let http: App;

  const TAG = `credits-e2e-${Date.now()}`;
  const tenantIds: string[] = [];

  let leadGenTenantId: string;
  let leadGenToken: string;
  let noLeadGenToken: string;

  async function createTenant(suffix: string, withLeadGen: boolean) {
    const tenant = await prisma.tenant.create({
      data: { name: `${TAG} ${suffix}`, slug: `${TAG}-${suffix}` },
    });
    tenantIds.push(tenant.id);

    await prisma.tenantSubscription.create({
      data: { tenantId: tenant.id, status: 'ACTIVE' },
    });

    // The tenant without Lead Gen still buys something, so the test
    // distinguishes "has no Lead Gen" from "has no subscription at all".
    await prisma.tenantModule.create({
      data: {
        tenantId: tenant.id,
        module: withLeadGen ? 'LEAD_GEN' : 'GUARD_TOUR',
      },
    });

    await prisma.user.create({
      data: {
        email: `admin-${suffix}@${TAG}.test`,
        password: await bcrypt.hash(PASSWORD, 10),
        name: `Admin ${suffix}`,
        tenantId: tenant.id,
        // Super admin bypasses PermissionGuard, so any 403 below comes from
        // ModuleGuard -- i.e. from entitlement, not from role.
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

  const post = (path: string, token: string, body: object = {}) =>
    request(http).post(path).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    credits = app.get(CreditsService);
    http = app.getHttpServer();

    leadGenTenantId = await createTenant('lg', true);
    await createTenant('nolg', false);

    leadGenToken = await login('lg');
    noLeadGenToken = await login('nolg');
  }, 180_000);

  afterAll(async () => {
    for (const tenantId of tenantIds) {
      await prisma.creditLedgerEntry
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenantCreditBalance
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.auditLog
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.userRoleAssignment
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.rolePermission
        .deleteMany({ where: { role: { tenantId } } })
        .catch(() => undefined);
      await prisma.role
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenantModule
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenantSubscription
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenant
        .delete({ where: { id: tenantId } })
        .catch(() => undefined);
    }
    await app?.close();
  }, 120_000);

  beforeEach(async () => {
    // Each test starts from a known balance.
    await prisma.creditLedgerEntry.deleteMany({
      where: { tenantId: leadGenTenantId },
    });
    await prisma.tenantCreditBalance.deleteMany({
      where: { tenantId: leadGenTenantId },
    });
  });

  describe('entitlement gating', () => {
    it('lets a Lead Gen tenant read its balance', async () => {
      const res = await get('/billing/credits', leadGenToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        balance: 0,
        reservedPending: 0,
      });
    });

    // The gap this suite exists for: without the LEAD_GEN gate, this tenant
    // could complete a Stripe payment for credits it can never spend.
    it('refuses a tenant without Lead Gen access to the credits API', async () => {
      const res = await get('/billing/credits', noLeadGenToken);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ upgradeRequired: true });
    });

    it('refuses a tenant without Lead Gen the purchase route', async () => {
      const res = await post(
        '/billing/credits/checkout/session',
        noLeadGenToken,
        { pack: 'PRO' },
      );

      expect(res.status).toBe(403);
    });

    it('refuses an unauthenticated caller', async () => {
      await request(http).get('/billing/credits').expect(401);
    });
  });

  describe('packs and purchase', () => {
    it('reports packs with the per-unit costs', async () => {
      const res = await get('/billing/credits/packs', leadGenToken);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        costs: { playbook: 1, perProspect: 1 },
      });
      // Stripe is unconfigured in test, so nothing is sellable.
      expect(res.body.configured).toBe(false);
      expect(res.body.packs).toEqual([]);
    });

    // Fails closed rather than half-working, matching how the subscription
    // checkout behaves before the client supplies Stripe keys.
    it('answers 503 for a purchase while Stripe is unconfigured', async () => {
      const res = await post(
        '/billing/credits/checkout/session',
        leadGenToken,
        { pack: 'PRO' },
      );

      expect(res.status).toBe(503);
    });

    it('rejects an unknown pack', async () => {
      const res = await post(
        '/billing/credits/checkout/session',
        leadGenToken,
        { pack: 'NOT_A_PACK' },
      );

      expect(res.status).toBe(400);
    });
  });

  describe('manual grants', () => {
    it('grants credits, audits it, and shows them on the balance', async () => {
      const res = await post('/billing/credits/grant', leadGenToken, {
        amount: 500,
        reason: 'Goodwill top-up',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ balance: 500, granted: true });

      const balance = await get('/billing/credits', leadGenToken);
      expect(balance.body.balance).toBe(500);

      // Moving money-equivalent value without a Stripe payment behind it must
      // leave a trail.
      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: leadGenTenantId, action: 'CREDITS_ADJUSTED' },
      });
      expect(audit).not.toBeNull();
    });

    it('rejects a zero adjustment', async () => {
      const res = await post('/billing/credits/grant', leadGenToken, {
        amount: 0,
        reason: 'Nothing',
      });

      expect(res.status).toBe(400);
    });

    it('requires a reason', async () => {
      const res = await post('/billing/credits/grant', leadGenToken, {
        amount: 100,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('search enforcement', () => {
    // The whole point of the credit system: no credits, no billed BlackPearl
    // call. A 402 (not 403) so the frontend can offer a top-up.
    it('answers 402 for a playbook search with no credits', async () => {
      const res = await post('/prospect-search/search', leadGenToken, {
        companyName: 'Acme Corp',
      });

      expect(res.status).toBe(402);
      expect(res.body).toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        required: 1,
        available: 0,
      });
    });

    it('answers 402 for a discovery search the balance cannot cover', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 5,
        description: 'Not enough',
      });

      const res = await post('/prospect-search/discover', leadGenToken, {
        objective: 'Marketing agencies',
        limit: 20,
      });

      expect(res.status).toBe(402);
      expect(res.body).toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        required: 20,
        available: 5,
      });
    });

    // Nothing was submitted, so nothing may be held.
    it('holds no credits when a search is refused', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 2,
        description: 'Not enough',
      });

      await post('/prospect-search/discover', leadGenToken, {
        objective: 'Marketing agencies',
        limit: 20,
      });

      const balance = await credits.getBalance(leadGenTenantId);
      expect(balance).toMatchObject({ balance: 2, reservedPending: 0 });
    });
  });

  describe('ledger', () => {
    it('records every movement and keeps the balance equal to its sum', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 100,
        description: 'Pack',
      });

      const reservation = await credits.reserve({
        tenantId: leadGenTenantId,
        jobId: `${TAG}-job`,
        amount: 20,
        description: 'Discovery',
      });
      await credits.settle({
        reservationId: reservation.reservationId,
        actualUsed: 3,
      });

      const res = await get('/billing/credits/ledger', leadGenToken);
      expect(res.status).toBe(200);

      const types = (res.body as { type: string }[]).map((row) => row.type);
      expect(types).toContain(CreditEntryType.PURCHASE);
      expect(types).toContain(CreditEntryType.RESERVATION);
      expect(types).toContain(CreditEntryType.RELEASE);
      expect(types).toContain(CreditEntryType.CONSUMPTION);

      // The invariant the whole design rests on.
      const rows = await prisma.creditLedgerEntry.findMany({
        where: { tenantId: leadGenTenantId },
      });
      const sum = rows.reduce((total, row) => total + row.amount, 0);
      const { balance } = await credits.getBalance(leadGenTenantId);
      expect(sum).toBe(balance);
      // 100 bought, 20 held, 3 consumed, 17 returned.
      expect(balance).toBe(97);
    });

    it('returns held credits when a job settles for less than reserved', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 50,
        description: 'Pack',
      });

      const reservation = await credits.reserve({
        tenantId: leadGenTenantId,
        jobId: `${TAG}-partial`,
        amount: 20,
        description: 'Discovery',
      });

      expect((await credits.getBalance(leadGenTenantId)).balance).toBe(30);

      await credits.settle({
        reservationId: reservation.reservationId,
        actualUsed: 4,
      });

      // 16 of the 20 held go back.
      expect((await credits.getBalance(leadGenTenantId)).balance).toBe(46);
    });

    it('refuses to hold more than the balance', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 10,
        description: 'Pack',
      });

      await expect(
        credits.reserve({
          tenantId: leadGenTenantId,
          jobId: `${TAG}-overdraw`,
          amount: 11,
          description: 'Too big',
        }),
      ).rejects.toMatchObject({ status: 402 });
    });
  });

  describe('stale reservation sweep', () => {
    it('returns credits held by a job that never finished', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 100,
        description: 'Pack',
      });

      const reservation = await credits.reserve({
        tenantId: leadGenTenantId,
        jobId: `${TAG}-abandoned`,
        amount: 20,
        description: 'Abandoned search',
      });

      // Backdate the hold past the sweep's cutoff: the user closed the tab, or
      // the backend restarted, so nothing ever polled it to a terminal status.
      await prisma.creditLedgerEntry.update({
        where: { id: reservation.reservationId },
        data: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      });

      expect((await credits.getBalance(leadGenTenantId)).balance).toBe(80);

      await credits.expireStaleReservations(60);

      expect((await credits.getBalance(leadGenTenantId)).balance).toBe(100);

      const swept = await prisma.creditLedgerEntry.findUnique({
        where: { id: reservation.reservationId },
      });
      expect(swept?.reservationStatus).toBe(CreditReservationStatus.RELEASED);
    });

    it('leaves a recent hold alone', async () => {
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 100,
        description: 'Pack',
      });
      await credits.reserve({
        tenantId: leadGenTenantId,
        jobId: `${TAG}-running`,
        amount: 20,
        description: 'Still running',
      });

      await credits.expireStaleReservations(60);

      // A genuinely slow job must not have its credits refunded mid-flight.
      expect((await credits.getBalance(leadGenTenantId)).balance).toBe(80);
    });
  });

  describe('refund clawback', () => {
    it('reverses a refunded purchase even once the credits are spent', async () => {
      const sessionId = `cs_${TAG}`;
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 100,
        description: 'Pack',
        stripeSessionId: sessionId,
      });

      const reservation = await credits.reserve({
        tenantId: leadGenTenantId,
        jobId: `${TAG}-spend`,
        amount: 90,
        description: 'Big search',
      });
      await credits.settle({
        reservationId: reservation.reservationId,
        actualUsed: 90,
      });

      const result = await credits.reversePurchase({
        tenantId: leadGenTenantId,
        stripeSessionId: sessionId,
        reason: 'Refunded',
      });

      expect(result).toMatchObject({ reversed: 100 });

      // Negative on purpose: they spent 90 then took their money back, so they
      // must not be left with free usage.
      const { balance } = await credits.getBalance(leadGenTenantId);
      expect(balance).toBe(-90);

      // A negative balance blocks further searches.
      const res = await post('/prospect-search/search', leadGenToken, {
        companyName: 'Acme Corp',
      });
      expect(res.status).toBe(402);
    });

    it('is idempotent across a redelivered refund event', async () => {
      const sessionId = `cs_${TAG}-replay`;
      await credits.grant({
        tenantId: leadGenTenantId,
        amount: 100,
        description: 'Pack',
        stripeSessionId: sessionId,
      });

      await credits.reversePurchase({
        tenantId: leadGenTenantId,
        stripeSessionId: sessionId,
        reason: 'Refunded',
      });
      const second = await credits.reversePurchase({
        tenantId: leadGenTenantId,
        stripeSessionId: sessionId,
        reason: 'Refunded',
      });

      expect(second).toBeNull();
      expect((await credits.getBalance(leadGenTenantId)).balance).toBe(0);
    });
  });
});
