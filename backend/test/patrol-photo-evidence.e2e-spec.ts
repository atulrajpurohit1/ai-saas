import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { PrismaExceptionFilter } from '../src/prisma/prisma-exception.filter';
import request from 'supertest';
import { App } from 'supertest/types';
import { existsSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PATROL_EVIDENCE_UPLOAD_DIR } from '../src/common/file-storage.util';

/**
 * End-to-end coverage for the Guard Tour "checkpoint photo evidence" feature.
 *
 * Talks to the real database and the real local-disk file store. Provisions a
 * fully isolated two-tenant fixture directly via Prisma (bypassing the flaky
 * cold-start `/auth/register` transaction), drives the workflow over HTTP,
 * then verifies persistence, file storage, retrieval, authorization and
 * tenant/guard isolation. Everything is cascade-deleted in afterAll.
 *
 * Endpoints under test:
 *   POST   guard/patrol-runs/:id/events/:eventId/evidence
 *   GET    guard/patrol-runs/:id/events/:eventId/evidence
 *   GET    guard/patrol-runs/:id/events/:eventId/evidence/:evidenceId/file
 *   GET    patrol-runs/:id/events/:eventId/evidence            (admin)
 *   GET    patrol-runs/:id/events/:eventId/evidence/:id/file   (admin)
 *   GET    patrol-runs/:id                                     (admin, evidence metadata inline)
 */

// 1x1 PNG / JPEG / GIF / WEBP-ish payloads (content doesn't matter, only the
// declared MIME + extension are validated).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF', 'utf8');

describe('Guard Tour — checkpoint photo evidence (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;

  const TAG = `pe-e2e-${Date.now()}`;
  const PW_GUARD = 'GuardPass123';

  // fixture ids
  const f: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  async function guardToken(identifier: string): Promise<string> {
    const res = await request(http)
      .post('/guard-auth/login')
      .send({ identifier, password: PW_GUARD });
    expect(res.status).toBe(200);
    return (res.body as { access_token: string }).access_token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();

    const hash = await bcrypt.hash(PW_GUARD, 10);

    // --- Tenant A -----------------------------------------------------------
    const tA = await prisma.tenant.create({
      data: { name: `${TAG} A`, slug: `${TAG}-a` },
    });
    f.tenantA = tA.id;
    const adminA = await prisma.user.create({
      data: {
        email: `admin-a@${TAG}.test`,
        password: await bcrypt.hash('Passw0rd!123', 10),
        name: 'PE Admin A',
        tenantId: tA.id,
        isSuperAdmin: true,
        role: 'ADMIN',
      },
    });
    f.adminAId = adminA.id;
    const clientA = await prisma.client.create({
      data: { name: `${TAG} client`, email: `c@${TAG}.test`, tenantId: tA.id },
    });
    const siteA = await prisma.site.create({
      data: { name: `${TAG} site`, address: '1 QA Way', tenantId: tA.id, clientId: clientA.id },
    });
    f.siteA = siteA.id;
    const guardA1 = await prisma.guard.create({
      data: {
        name: 'PE Guard A1',
        email: `guard-a1@${TAG}.test`,
        phone: `700${Date.now().toString().slice(-7)}`,
        passwordHash: hash,
        tenantId: tA.id,
      },
    });
    f.guardA1 = guardA1.id;
    const guardA2 = await prisma.guard.create({
      data: {
        name: 'PE Guard A2',
        email: `guard-a2@${TAG}.test`,
        phone: `701${Date.now().toString().slice(-7)}`,
        passwordHash: hash,
        tenantId: tA.id,
      },
    });
    f.guardA2 = guardA2.id;

    const shiftA = await prisma.shift.create({
      data: {
        siteId: siteA.id,
        startTime: new Date(Date.now() - 3600_000),
        endTime: new Date(Date.now() + 3600_000),
        requiredGuards: 1,
        status: 'in_progress',
        tenantId: tA.id,
      },
    });
    f.shiftA = shiftA.id;
    await prisma.assignment.create({
      data: { shiftId: shiftA.id, guardId: guardA1.id, status: 'confirmed' },
    });

    const cpA = await prisma.checkpoint.create({
      data: { tenantId: tA.id, siteId: siteA.id, name: `${TAG} CP-A`, status: 'active' },
    });
    const routeA = await prisma.patrolRoute.create({
      data: { tenantId: tA.id, siteId: siteA.id, name: `${TAG} route`, status: 'active' },
    });
    await prisma.patrolRouteCheckpoint.create({
      data: { patrolRouteId: routeA.id, checkpointId: cpA.id, sequenceOrder: 0 },
    });
    f.routeA = routeA.id;
    f.cpA = cpA.id;

    // --- Tenant B (isolation target) -------------------------------------
    const tB = await prisma.tenant.create({
      data: { name: `${TAG} B`, slug: `${TAG}-b` },
    });
    f.tenantB = tB.id;
    await prisma.user.create({
      data: {
        email: `admin-b@${TAG}.test`,
        password: await bcrypt.hash('Passw0rd!123', 10),
        name: 'PE Admin B',
        tenantId: tB.id,
        isSuperAdmin: true,
        role: 'ADMIN',
      },
    });
    const guardB = await prisma.guard.create({
      data: {
        name: 'PE Guard B',
        email: `guard-b@${TAG}.test`,
        phone: `702${Date.now().toString().slice(-7)}`,
        passwordHash: hash,
        tenantId: tB.id,
      },
    });
    f.guardB = guardB.id;

    // tokens
    tokens.guardA1 = await guardToken(`guard-a1@${TAG}.test`);
    tokens.guardA2 = await guardToken(`guard-a2@${TAG}.test`);
    tokens.guardB = await guardToken(`guard-b@${TAG}.test`);
    const la = await request(http)
      .post('/auth/login')
      .send({ email: `admin-a@${TAG}.test`, password: 'Passw0rd!123' });
    tokens.adminA = (la.body as { access_token: string }).access_token;
    const lb = await request(http)
      .post('/auth/login')
      .send({ email: `admin-b@${TAG}.test`, password: 'Passw0rd!123' });
    tokens.adminB = (lb.body as { access_token: string }).access_token;

    // --- Start a patrol run and scan the checkpoint (as guard A1) --------
    const startRes = await request(http)
      .post(`/guard/shifts/${f.shiftA}/patrol-runs/start`)
      .set('Authorization', `Bearer ${tokens.guardA1}`)
      .send({ patrol_route_id: f.routeA });
    expect(startRes.status).toBe(201);
    f.runA = (startRes.body as { id: string }).id;

    const scanRes = await request(http)
      .post(`/guard/patrol-runs/${f.runA}/checkpoints/${f.cpA}/scan`)
      .set('Authorization', `Bearer ${tokens.guardA1}`)
      .send({ status: 'completed', notes: 'evidence test' });
    expect(scanRes.status).toBe(201);
    f.eventA = (scanRes.body as { id: string }).id;
  }, 240_000);

  afterAll(async () => {
    for (const tid of [f.tenantA, f.tenantB]) {
      if (!tid) continue;
      await prisma.patrolEvidence.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.patrolEvent.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.patrolRun.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.patrolRouteCheckpoint
        .deleteMany({ where: { patrolRoute: { tenantId: tid } } })
        .catch(() => undefined);
      await prisma.patrolRoute.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.checkpoint.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.assignment
        .deleteMany({ where: { shift: { tenantId: tid } } })
        .catch(() => undefined);
      await prisma.shift.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.site.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.guard.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.userRoleAssignment.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.userSession.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { tenantId: tid } }).catch(() => undefined);
      await prisma.tenant.delete({ where: { id: tid } }).catch(() => undefined);
    }
    await app.close();
  }, 120_000);

  // ---------------------------------------------------------------------------
  // HAPPY PATH — upload / persist / metadata / retrieve
  // ---------------------------------------------------------------------------
  // Regression: the guard patrol page loads and refreshes the in-progress
  // run via GET /guard/patrol-runs/:id after every scan. That route was
  // missing from GuardPatrolsController, so the post-scan refresh 404'd,
  // the scan modal never closed and progress stayed at 0/N even though the
  // scan itself had persisted.
  describe('guard patrol-run detail (GET /guard/patrol-runs/:id)', () => {
    it('returns the run with route checkpoints + events + evidence inline for the owning guard', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect(res.status).toBe(200);
      const run = res.body as {
        id: string;
        guardId: string;
        status: string;
        patrolRoute: { checkpoints: Array<{ checkpointId: string }> };
        events: Array<{ id: string; checkpointId: string; storedFileName?: string }>;
      };
      expect(run.id).toBe(f.runA);
      expect(run.guardId).toBe(f.guardA1);
      expect(run.status).toBe('in_progress');
      expect(run.patrolRoute.checkpoints.some((c) => c.checkpointId === f.cpA)).toBe(true);
      const evt = run.events.find((e) => e.id === f.eventA);
      expect(evt).toBeTruthy();
      expect(evt!.checkpointId).toBe(f.cpA);
    });

    it("another guard in the same tenant cannot read this guard's run => 404", async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}`)
        .set('Authorization', `Bearer ${tokens.guardA2}`);
      expect(res.status).toBe(404);
    });

    it('a guard from another tenant cannot read the run => 404', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}`)
        .set('Authorization', `Bearer ${tokens.guardB}`);
      expect(res.status).toBe(404);
    });

    it('an admin token is rejected on the guard route => 401/403', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}`)
        .set('Authorization', `Bearer ${tokens.adminA}`);
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('happy path', () => {
    it('authenticated guard uploads a valid PNG photo => 201, response omits storedFileName', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .attach('file', PNG, { filename: 'lobby.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      const body = res.body as Record<string, unknown>;
      expect(body.id).toBeTruthy();
      expect(body.mediaType).toBe('image');
      expect(body.mimeType).toBe('image/png');
      expect(body.fileName).toBe('lobby.png');
      expect(body.patrolEventId).toBe(f.eventA);
      expect(body.patrolRunId).toBe(f.runA);
      expect(body.guardId).toBe(f.guardA1);
      expect(body.uploadedById).toBe(f.guardA1);
      expect(body.fileSizeBytes).toBe(PNG.length);
      expect('storedFileName').not.toBe(Object.keys(body).find((k) => k === 'storedFileName'));
      expect(body.storedFileName).toBeUndefined();
      f.evidenceA = body.id as string;
    });

    it('DB: evidence row persisted with correct tenant / guard / event / run / mime / size', async () => {
      const row = await prisma.patrolEvidence.findUnique({ where: { id: f.evidenceA } });
      expect(row).toBeTruthy();
      expect(row!.tenantId).toBe(f.tenantA);
      expect(row!.guardId).toBe(f.guardA1);
      expect(row!.uploadedById).toBe(f.guardA1);
      expect(row!.patrolEventId).toBe(f.eventA);
      expect(row!.patrolRunId).toBe(f.runA);
      expect(row!.mediaType).toBe('image');
      expect(row!.mimeType).toBe('image/png');
      expect(row!.fileName).toBe('lobby.png');
      expect(row!.fileSizeBytes).toBe(PNG.length);
      expect(row!.storedFileName).toMatch(/^\d+-[0-9a-f]+-.*lobby\.png$/i);
      // timestamp is recent
      expect(Date.now() - new Date(row!.createdAt).getTime()).toBeLessThan(60_000);
    });

    it('FILE: the uploaded image is actually written to the patrol-evidence dir', async () => {
      const row = await prisma.patrolEvidence.findUnique({ where: { id: f.evidenceA } });
      const onDisk = join(PATROL_EVIDENCE_UPLOAD_DIR, row!.storedFileName);
      expect(existsSync(onDisk)).toBe(true);
    });

    it('the checkpoint scan event links back to exactly one PatrolEvidence (no orphans/dupes)', async () => {
      const count = await prisma.patrolEvidence.count({ where: { patrolEventId: f.eventA } });
      expect(count).toBe(1);
    });

    it('guard can list evidence for their own event', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect(res.status).toBe(200);
      const list = res.body as Array<{ id: string; storedFileName?: string }>;
      expect(list.some((e) => e.id === f.evidenceA)).toBe(true);
      expect(list.every((e) => e.storedFileName === undefined)).toBe(true);
    });

    it('guard can download the evidence file (image content-type, correct length, no-store)', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^image\//);
      expect(Number(res.headers['content-length'])).toBe(PNG.length);
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('admin can list the evidence for the same event', async () => {
      const res = await request(http)
        .get(`/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.adminA}`);
      expect(res.status).toBe(200);
      const list = res.body as Array<{ id: string; storedFileName?: string }>;
      expect(list.some((e) => e.id === f.evidenceA)).toBe(true);
      expect(list.every((e) => e.storedFileName === undefined)).toBe(true);
    });

    it('admin can download the evidence file', async () => {
      const res = await request(http)
        .get(`/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.adminA}`)
        .buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^image\//);
    });

    it('admin patrol-run detail includes evidence metadata inline (id-only, no storedFileName)', async () => {
      const res = await request(http)
        .get(`/patrol-runs/${f.runA}`)
        .set('Authorization', `Bearer ${tokens.adminA}`);
      expect(res.status).toBe(200);
      const run = res.body as {
        events: Array<{ id: string; evidence: Array<Record<string, unknown>> }>;
      };
      const evt = run.events.find((e) => e.id === f.eventA);
      expect(evt).toBeTruthy();
      expect(evt!.evidence.length).toBe(1);
      expect(evt!.evidence[0].id).toBe(f.evidenceA);
      expect(evt!.evidence[0].storedFileName).toBeUndefined();
    });

    it('accepts a second photo on the same event (multi-photo) and both persist', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .attach('file', PNG, { filename: 'door.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(201);
      f.evidenceA2 = (res.body as { id: string }).id;
      const count = await prisma.patrolEvidence.count({ where: { patrolEventId: f.eventA } });
      expect(count).toBe(2);
    });

    it('accepts each allowed image type (jpeg / webp / gif / heic)', async () => {
      for (const [ext, mime] of [
        ['a.jpeg', 'image/jpeg'],
        ['b.webp', 'image/webp'],
        ['c.gif', 'image/gif'],
        ['d.heic', 'image/heic'],
      ] as const) {
        const res = await request(http)
          .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
          .set('Authorization', `Bearer ${tokens.guardA1}`)
          .attach('file', PNG, { filename: ext, contentType: mime });
        expect(res.status).toBe(201);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // VALIDATION — file type / extension / size / missing field
  // ---------------------------------------------------------------------------
  describe('upload validation', () => {
    const post = () =>
      request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);

    it('rejects a disallowed extension (.exe) => 400', async () => {
      const res = await post().attach('file', Buffer.from('MZ'), {
        filename: 'evil.exe',
        contentType: 'application/octet-stream',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a spoofed MIME (image extension, non-image content-type) => 400', async () => {
      const res = await post().attach('file', Buffer.from('MZ'), {
        filename: 'shell.png',
        contentType: 'application/octet-stream',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a real PDF (photos only) => 400', async () => {
      const res = await post().attach('file', PDF, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a video (patrol evidence is image-only) => 400', async () => {
      const res = await post().attach('file', Buffer.from('\x00\x00\x00\x18ftyp'), {
        filename: 'clip.mp4',
        contentType: 'video/mp4',
      });
      expect(res.status).toBe(400);
    });

    it('rejects an SVG even with an image MIME (extension not on allow-list) => 400', async () => {
      const res = await post().attach('file', Buffer.from('<svg/>'), {
        filename: 'x.svg',
        contentType: 'image/jpeg',
      });
      expect(res.status).toBe(400);
    });

    it('rejects an oversized file (> 15 MB cap) => 400/413', async () => {
      const big = Buffer.alloc(16 * 1024 * 1024, 1);
      const res = await post().attach('file', big, {
        filename: 'huge.png',
        contentType: 'image/png',
      });
      expect([400, 413]).toContain(res.status);
    });

    it('rejects a request with no file part => 400', async () => {
      const res = await post().field('note', 'no file here');
      expect(res.status).toBe(400);
    });

    it('rejects a wrong multipart field name (not "file") => 400', async () => {
      const res = await post().attach('photo', PNG, {
        filename: 'lobby.png',
        contentType: 'image/png',
      });
      expect(res.status).toBe(400);
    });

    it('DB: no evidence row was created for any rejected upload', async () => {
      // exactly the rows added by the happy-path block (1 + 1 + 4 allowed types)
      const count = await prisma.patrolEvidence.count({ where: { patrolEventId: f.eventA } });
      expect(count).toBe(6);
    });
  });

  // ---------------------------------------------------------------------------
  // AUTH / IDENTITY — unauthenticated, wrong role, manipulated ids
  // ---------------------------------------------------------------------------
  describe('authentication & identity', () => {
    it('unauthenticated upload => 401', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(401);
    });

    it('unauthenticated list => 401', async () => {
      const res = await request(http).get(
        `/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`,
      );
      expect(res.status).toBe(401);
    });

    it('unauthenticated file download => 401', async () => {
      const res = await request(http).get(
        `/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`,
      );
      expect(res.status).toBe(401);
    });

    it('admin JWT cannot use the GUARD upload endpoint (role gate) => 401/403', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.adminA}`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect([401, 403]).toContain(res.status);
    });

    it('guard JWT cannot use the ADMIN evidence list endpoint => 401/403', async () => {
      const res = await request(http)
        .get(`/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect([401, 403]).toContain(res.status);
    });

    it('garbage / malformed bearer token => 401', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', 'Bearer not.a.real.token');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // ID MANIPULATION — invalid / mismatched run / event / evidence ids
  // ---------------------------------------------------------------------------
  describe('id manipulation & not-found handling', () => {
    const NIL = '00000000-0000-0000-0000-000000000000';

    it('upload to a non-existent run id => 404', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${NIL}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(404);
    });

    it('upload to a non-existent event id => 404', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${NIL}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(404);
    });

    it('upload with an event id that belongs to a DIFFERENT run => 404', async () => {
      // start a second run + scan to get a foreign event id
      const start2 = await request(http)
        .post(`/guard/shifts/${f.shiftA}/patrol-runs/start`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .send({ patrol_route_id: f.routeA });
      const run2 = (start2.body as { id: string }).id;
      const scan2 = await request(http)
        .post(`/guard/patrol-runs/${run2}/checkpoints/${f.cpA}/scan`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .send({ status: 'completed' });
      const event2 = (scan2.body as { id: string }).id;

      // now try to attach event2 under the ORIGINAL run
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${event2}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(404);

      await request(http)
        .post(`/guard/patrol-runs/${run2}/complete`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
    });

    it('download a non-existent evidence id (event in scope) => 404', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${NIL}/file`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect(res.status).toBe(404);
    });

    it('download an evidence id that exists but is NOT on the given event => 404', async () => {
      // f.evidenceA is on f.eventA; ask for it under a bogus event id
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${NIL}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect(res.status).toBe(404);
    });

    it('path-traversal style evidence id is not resolvable => 404 (never 200/500)', async () => {
      const res = await request(http)
        .get(
          `/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${encodeURIComponent('../../etc/passwd')}/file`,
        )
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect([400, 404]).toContain(res.status);
    });
  });

  // ---------------------------------------------------------------------------
  // TENANT / GUARD ISOLATION
  // ---------------------------------------------------------------------------
  describe('tenant & guard isolation', () => {
    it('another guard in the SAME tenant cannot upload to this event => 404', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA2}`)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(404);
    });

    it('another guard in the same tenant cannot LIST this event\'s evidence => 404', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA2}`);
      expect(res.status).toBe(404);
    });

    it('another guard in the same tenant cannot DOWNLOAD this evidence file => 404', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.guardA2}`);
      expect(res.status).toBe(404);
    });

    it('a guard from ANOTHER tenant cannot download this evidence file => 404', async () => {
      const res = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.guardB}`);
      expect(res.status).toBe(404);
    });

    it('an ADMIN from ANOTHER tenant cannot list this event\'s evidence => 404', async () => {
      const res = await request(http)
        .get(`/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.adminB}`);
      expect(res.status).toBe(404);
    });

    it('an ADMIN from ANOTHER tenant cannot download this evidence file => 404', async () => {
      const res = await request(http)
        .get(`/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.adminB}`);
      expect(res.status).toBe(404);
    });

    it('authorization is identity-based: forging the guardId in the body does not help', async () => {
      // guard A2 tries to pass guardId=A1 in the request body
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA2}`)
        .field('guardId', f.guardA1)
        .field('tenantId', f.tenantA)
        .attach('file', PNG, { filename: 'x.png', contentType: 'image/png' });
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // LIFECYCLE — evidence stays readable after the run completes; upload after
  // completion is refused (run no longer in_progress).
  // ---------------------------------------------------------------------------
  describe('run lifecycle', () => {
    it('evidence remains listable & downloadable after the run is completed', async () => {
      const done = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/complete`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect(done.status).toBe(201);

      const list = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`);
      expect(list.status).toBe(200);
      expect((list.body as unknown[]).length).toBe(6);

      const file = await request(http)
        .get(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence/${f.evidenceA}/file`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .buffer(true);
      expect(file.status).toBe(200);
    });

    it('uploading a NEW photo after the run is completed => 404 (run not in_progress)', async () => {
      const res = await request(http)
        .post(`/guard/patrol-runs/${f.runA}/events/${f.eventA}/evidence`)
        .set('Authorization', `Bearer ${tokens.guardA1}`)
        .attach('file', PNG, { filename: 'late.png', contentType: 'image/png' });
      expect(res.status).toBe(404);
    });

    it('DB: still exactly 6 evidence rows on the event (nothing leaked in after completion)', async () => {
      const count = await prisma.patrolEvidence.count({ where: { patrolEventId: f.eventA } });
      expect(count).toBe(6);
    });
  });

  // ---------------------------------------------------------------------------
  // CASCADE — deleting the event removes its evidence rows (no orphans)
  // ---------------------------------------------------------------------------
  describe('cascade / cleanup', () => {
    it('deleting the PatrolEvent cascade-deletes its PatrolEvidence rows', async () => {
      // use a throwaway event so we do not disturb the assertions above
      const cp = await prisma.checkpoint.create({
        data: { tenantId: f.tenantA, siteId: f.siteA, name: `${TAG} cascade cp`, status: 'active' },
      });
      const evt = await prisma.patrolEvent.create({
        data: {
          tenantId: f.tenantA,
          patrolRunId: f.runA,
          checkpointId: cp.id,
          guardId: f.guardA1,
          status: 'completed',
        },
      });
      const ev = await prisma.patrolEvidence.create({
        data: {
          tenantId: f.tenantA,
          patrolEventId: evt.id,
          patrolRunId: f.runA,
          guardId: f.guardA1,
          mediaType: 'image',
          mimeType: 'image/png',
          fileName: 'c.png',
          storedFileName: 'zzz-c.png',
          fileSizeBytes: 10,
          uploadedById: f.guardA1,
        },
      });
      await prisma.patrolEvent.delete({ where: { id: evt.id } });
      const stillThere = await prisma.patrolEvidence.findUnique({ where: { id: ev.id } });
      expect(stillThere).toBeNull();
      await prisma.checkpoint.delete({ where: { id: cp.id } }).catch(() => undefined);
    });
  });
});
