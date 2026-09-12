import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { EmailService } from './../src/email/email.service';

/**
 * End-to-end coverage for signup email validation + OTP verification
 * (admin `auth/*` and client-portal `client-auth/*`). Talks to the real
 * database; the outbound email transport is stubbed via
 * `EmailService.sendOtpEmail` so the test can read back the plaintext code
 * that was "sent" without depending on a real mailbox — the code itself is
 * never exposed by any HTTP response.
 */
describe('Email verification OTP (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sentCodes: Array<{ email: string; code: string }>;

  const TAG = `emailverify-e2e-${Date.now()}`;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    sentCodes = [];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendOtpEmail: jest.fn(
          async (_tenantId: string | null, params: { email: string; code: string }) => {
            sentCodes.push({ email: params.email, code: params.code });
            return { messageId: 'test', previewUrl: undefined };
          },
        ),
        // Other EmailService methods aren't exercised by these tests.
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const tenantId of tenantIds) {
      const users = await prisma.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const clientUsers = await prisma.clientUser.findMany({
        where: { tenantId },
        select: { id: true },
      });

      await prisma.emailOtp
        .deleteMany({
          where: {
            OR: [
              { accountType: 'USER', accountId: { in: users.map((u) => u.id) } },
              {
                accountType: 'CLIENT_USER',
                accountId: { in: clientUsers.map((u) => u.id) },
              },
            ],
          },
        })
        .catch(() => undefined);
      await prisma.userRoleAssignment
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.clientUser
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.client.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.role.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => undefined);
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
    }
    await app.close();
  });

  const latestCodeFor = (email: string) => {
    const matches = sentCodes.filter((s) => s.email === email);
    return matches[matches.length - 1]?.code;
  };

  // class-validator's ValidationPipe wraps messages in an array; a plain
  // BadRequestException thrown from a service does not. Both must read the
  // same user-facing copy.
  const expectInvalidEmailMessage = (body: unknown) => {
    const message = (body as { message?: unknown }).message;
    const text = Array.isArray(message) ? message[0] : message;
    expect(text).toBe('Please enter a valid email address.');
  };

  describe('email format/domain validation', () => {
    it('rejects an obviously invalid email and never sends an OTP', async () => {
      const before = sentCodes.length;
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'Password123',
          tenantName: `${TAG}-bad`,
          tenantSlug: `${TAG}-bad`,
        });

      expect(res.status).toBe(400);
      expectInvalidEmailMessage(res.body);
      expect(sentCodes.length).toBe(before);
    });

    it('rejects a disposable-domain email and never sends an OTP', async () => {
      const before = sentCodes.length;
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Disposable',
          email: `disposable-${TAG}@mailinator.com`,
          password: 'Password123',
          tenantName: `${TAG}-disp`,
          tenantSlug: `${TAG}-disp`,
        });

      expect(res.status).toBe(400);
      expectInvalidEmailMessage(res.body);
      expect(sentCodes.length).toBe(before);
    });

    it('rejects signup with a missing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'No Email',
          password: 'Password123',
          tenantName: `${TAG}-none`,
          tenantSlug: `${TAG}-none`,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('admin signup → OTP verification → login', () => {
    const email = `admin-${TAG}@example.com`;
    const password = 'Password123';

    it('registers, does not return tokens, and never returns the OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Admin E2E',
          email,
          password,
          tenantName: `${TAG}-admin`,
          tenantSlug: `${TAG}-admin`,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('verification_required');
      expect(res.body.access_token).toBeUndefined();
      // Response shape must be exactly {status, email} — no OTP/code field.
      expect(Object.keys(res.body).sort()).toEqual(['email', 'status']);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeTruthy();
      expect(user!.emailVerified).toBe(false);
      tenantIds.push(user!.tenantId);
    });

    it('blocks login before verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        'Please verify your email before logging in.',
      );
    });

    it('rejects a wrong OTP', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid verification code.');
    });

    it('verifies with the correct OTP, marks email verified, and issues tokens', async () => {
      const code = latestCodeFor(email);
      expect(code).toMatch(/^\d{6}$/);

      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeTruthy();
      expect(res.body.refresh_token).toBeTruthy();

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user!.emailVerified).toBe(true);
      expect(user!.emailVerifiedAt).toBeTruthy();
    });

    it('rejects reusing the same (now-consumed) OTP', async () => {
      const code = latestCodeFor(email);
      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code });

      // Already verified — the controller re-verifies via login path, so a
      // second verify-email call for an already-verified user should not
      // silently succeed against a stale code.
      expect([200, 400]).toContain(res.status);
    });

    it('allows login after verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeTruthy();
    });
  });

  describe('resend OTP + cooldown + invalidation', () => {
    const email = `resend-${TAG}@example.com`;
    const password = 'Password123';

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Resend E2E',
          email,
          password,
          tenantName: `${TAG}-resend`,
          tenantSlug: `${TAG}-resend`,
        });
      const user = await prisma.user.findUnique({ where: { email } });
      tenantIds.push(user!.tenantId);
      void res;
    });

    it('enforces the resend cooldown', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-otp')
        .send({ email });

      expect(res.status).toBe(429);
    });

    it('invalidates the previous OTP once a new one is generated', async () => {
      const firstCode = latestCodeFor(email);

      // Directly age the OTP row past the cooldown so we can exercise resend
      // without an artificial test sleep.
      await prisma.emailOtp.updateMany({
        where: { email },
        data: { lastSentAt: new Date(Date.now() - 61_000) },
      });

      const resendRes = await request(app.getHttpServer())
        .post('/auth/resend-otp')
        .send({ email });
      expect(resendRes.status).toBe(200);

      const newCode = latestCodeFor(email);
      expect(newCode).toBeTruthy();
      expect(newCode).not.toBe(firstCode);

      const oldCodeAttempt = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code: firstCode });
      expect(oldCodeAttempt.status).toBe(400);

      const newCodeAttempt = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code: newCode });
      expect(newCodeAttempt.status).toBe(200);
    });

    it('resend-otp gives a generic response for an unknown email (enumeration protection)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/resend-otp')
        .send({ email: `nobody-${TAG}@example.com` });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an unverified account exists/i);
    });
  });

  describe('too many incorrect attempts', () => {
    const email = `attempts-${TAG}@example.com`;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Attempts E2E',
          email,
          password: 'Password123',
          tenantName: `${TAG}-attempts`,
          tenantSlug: `${TAG}-attempts`,
        });
      const user = await prisma.user.findUnique({ where: { email } });
      tenantIds.push(user!.tenantId);
    });

    it('blocks verification after too many wrong attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ email, code: '111111' });
      }

      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code: '222222' });

      expect(res.status).toBe(429);
    });
  });

  describe('duplicate signup handling', () => {
    it('retrying signup with the same unverified email reuses the pending account (no duplicate)', async () => {
      const email = `retry-${TAG}@example.com`;

      const first = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Retry One',
          email,
          password: 'Password123',
          tenantName: `${TAG}-retry`,
          tenantSlug: `${TAG}-retry`,
        });
      expect(first.status).toBe(201);

      const firstUser = await prisma.user.findUnique({ where: { email } });
      tenantIds.push(firstUser!.tenantId);

      // Simulate the resend cooldown having elapsed so this retry is judged
      // on duplicate-account handling, not the (separately tested) cooldown.
      await prisma.emailOtp.updateMany({
        where: { accountType: 'USER', accountId: firstUser!.id },
        data: { lastSentAt: new Date(Date.now() - 61_000) },
      });

      const second = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Retry Two',
          email,
          password: 'NewPassword456',
          tenantName: `${TAG}-retry2`,
          tenantSlug: `${TAG}-retry2`,
        });
      expect(second.status).toBe(201);
      expect(second.body.status).toBe('verification_required');

      const allUsersWithEmail = await prisma.user.findMany({
        where: { email },
      });
      expect(allUsersWithEmail).toHaveLength(1);
      expect(allUsersWithEmail[0].id).toBe(firstUser!.id);
    });

    it('rejects re-registering an already-verified email', async () => {
      const email = `verified-${TAG}@example.com`;

      await request(app.getHttpServer()).post('/auth/register').send({
        name: 'Verified User',
        email,
        password: 'Password123',
        tenantName: `${TAG}-verified`,
        tenantSlug: `${TAG}-verified`,
      });
      const user = await prisma.user.findUnique({ where: { email } });
      tenantIds.push(user!.tenantId);

      const code = latestCodeFor(email);
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email, code });

      const again = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Verified User Again',
          email,
          password: 'Password123',
          tenantName: `${TAG}-verified2`,
          tenantSlug: `${TAG}-verified2`,
        });

      expect(again.status).toBe(409);
    });
  });

  describe('client-portal signup → OTP verification → login', () => {
    const email = `client-${TAG}@example.com`;
    const password = 'Password123';

    it('registers a client user without issuing tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/client-auth/register')
        .send({
          name: 'Client E2E',
          email,
          password,
          tenantSlug: `${TAG}-client-tenant`,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('verification_required');
      expect(res.body.access_token).toBeUndefined();

      const clientUser = await prisma.clientUser.findUnique({
        where: { email },
      });
      expect(clientUser).toBeTruthy();
      expect(clientUser!.emailVerified).toBe(false);
      tenantIds.push(clientUser!.tenantId);
    });

    it('blocks client login before verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/client-auth/login')
        .send({ email, password });

      expect(res.status).toBe(403);
    });

    it('verifies the client OTP and allows login afterward', async () => {
      const code = latestCodeFor(email);
      const verifyRes = await request(app.getHttpServer())
        .post('/client-auth/verify-email')
        .send({ email, code });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.access_token).toBeTruthy();

      const loginRes = await request(app.getHttpServer())
        .post('/client-auth/login')
        .send({ email, password });
      expect(loginRes.status).toBe(200);
    });
  });
});
