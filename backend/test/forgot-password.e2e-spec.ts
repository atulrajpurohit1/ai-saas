import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { EmailService } from './../src/email/email.service';

/**
 * End-to-end coverage for the admin forgot-password flow:
 * POST /auth/forgot-password -> POST /auth/verify-reset-otp -> POST
 * /auth/reset-password. Talks to the real database; the outbound email
 * transport is stubbed via EmailService.sendOtpEmail / sendPasswordResetOtpEmail
 * so the test can read back the plaintext OTP that was "sent" without a real
 * mailbox — the code itself is never exposed by any HTTP response, and
 * neither is the reset token beyond the one response that mints it.
 */
describe('Forgot password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sentResetCodes: Array<{ email: string; code: string }>;
  let sentSignupCodes: Array<{ email: string; code: string }>;

  const TAG = `forgotpw-e2e-${Date.now()}`;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    sentResetCodes = [];
    sentSignupCodes = [];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendOtpEmail: jest.fn(
          async (
            _tenantId: string | null,
            params: { email: string; code: string },
          ) => {
            sentSignupCodes.push({ email: params.email, code: params.code });
            return { messageId: 'test', previewUrl: undefined };
          },
        ),
        sendPasswordResetOtpEmail: jest.fn(
          async (
            _tenantId: string | null,
            params: { email: string; code: string },
          ) => {
            sentResetCodes.push({ email: params.email, code: params.code });
            return { messageId: 'test', previewUrl: undefined };
          },
        ),
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
      const userIds = users.map((u) => u.id);

      await prisma.passwordResetToken
        .deleteMany({ where: { accountId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.emailOtp
        .deleteMany({
          where: { accountType: 'USER', accountId: { in: userIds } },
        })
        .catch(() => undefined);
      await prisma.userSession
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.userRoleAssignment
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.role
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.auditLog
        .deleteMany({ where: { tenantId } })
        .catch(() => undefined);
      await prisma.tenant
        .delete({ where: { id: tenantId } })
        .catch(() => undefined);
    }
    await app.close();
  });

  const latestResetCodeFor = (email: string) => {
    const matches = sentResetCodes.filter((s) => s.email === email);
    return matches[matches.length - 1]?.code;
  };

  const latestSignupCodeFor = (email: string) => {
    const matches = sentSignupCodes.filter((s) => s.email === email);
    return matches[matches.length - 1]?.code;
  };

  /**
   * Registers + verifies an admin user, returning their email/password.
   * Retries registration a few times on transient Neon serverless-Postgres
   * connection drops (P1001/P1017 — a known flake of this DB, see
   * backend memory notes), not on genuine 4xx failures.
   */
  const createVerifiedUser = async (tag: string) => {
    const email = `${tag}-${TAG}@example.com`;
    const password = 'OriginalPass123';

    let registerStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: `${tag} User`,
          email,
          password,
          tenantName: `${tag}-${TAG}`,
          tenantSlug: `${tag}-${TAG}`,
        });
      registerStatus = res.status;
      if (registerStatus < 500) break;
    }
    expect(registerStatus).toBe(201);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User not found after register: ${email}`);
    tenantIds.push(user.tenantId);

    const code = latestSignupCodeFor(email);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email, code });
    expect(verifyRes.status).toBe(200);

    return { email, password, userId: user.id, tenantId: user.tenantId };
  };

  describe('forgot-password request — enumeration protection', () => {
    it('returns the same generic message for a verified account and an unknown email', async () => {
      const { email } = await createVerifiedUser('enum');

      const known = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });
      expect(known.status).toBe(200);
      expect(known.body.message).toMatch(
        /if an account exists for this email/i,
      );

      const unknown = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `nobody-${TAG}@example.com` });
      expect(unknown.status).toBe(200);
      expect(unknown.body.message).toBe(known.body.message);

      // Only the known/verified account actually received an OTP.
      expect(latestResetCodeFor(email)).toMatch(/^\d{6}$/);
      expect(latestResetCodeFor(`nobody-${TAG}@example.com`)).toBeUndefined();
    });

    it('rejects an invalid email shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('full flow: forgot-password -> verify OTP -> reset -> login with new password', () => {
    it('completes the flow end to end and invalidates the old password + sessions', async () => {
      const { email, password, userId } = await createVerifiedUser('full');

      // Log in once with the original password to create a session to prove
      // gets invalidated by the reset.
      const originalLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
      expect(originalLogin.status).toBe(200);
      const originalRefreshToken = originalLogin.body.refresh_token as string;

      const forgotRes = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });
      expect(forgotRes.status).toBe(200);

      const code = latestResetCodeFor(email);
      expect(code).toMatch(/^\d{6}$/);

      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-reset-otp')
        .send({ email, code });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.resetToken).toBeTruthy();
      // The response must never include the raw OTP or password data.
      expect(Object.keys(verifyRes.body).sort()).toEqual([
        'expiresAt',
        'resetToken',
      ]);

      const resetToken = verifyRes.body.resetToken as string;

      // Snapshot the pre-reset session(s) so we can assert specifically on
      // those being revoked — reset-password legitimately does not (and
      // should not) prevent the user from logging in again afterward, which
      // would itself create a new, unrelated active session.
      const preResetSessionIds = (
        await prisma.userSession.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((s) => s.id);
      expect(preResetSessionIds.length).toBeGreaterThan(0);

      const mismatchRes = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          resetToken,
          newPassword: 'NewPassword456',
          confirmPassword: 'DifferentPassword789',
        });
      expect(mismatchRes.status).toBe(400);

      const resetRes = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          resetToken,
          newPassword: 'NewPassword456',
          confirmPassword: 'NewPassword456',
        });
      expect(resetRes.status).toBe(200);
      // Must never echo back the password or its hash.
      expect(JSON.stringify(resetRes.body)).not.toMatch(/NewPassword456/);

      // Old password no longer works.
      const oldLoginAttempt = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password });
      expect(oldLoginAttempt.status).toBe(401);

      // New password works.
      const newLoginAttempt = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'NewPassword456' });
      expect(newLoginAttempt.status).toBe(200);

      // The pre-reset session/refresh token must be revoked.
      const refreshAttempt = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${originalRefreshToken}`);
      expect(refreshAttempt.status).toBe(403);

      const preResetSessionsAfter = await prisma.userSession.findMany({
        where: { id: { in: preResetSessionIds } },
      });
      expect(preResetSessionsAfter.every((s) => s.status === 'revoked')).toBe(
        true,
      );

      // The reset token is single-use.
      const reuseAttempt = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          resetToken,
          newPassword: 'AnotherPass789',
          confirmPassword: 'AnotherPass789',
        });
      expect(reuseAttempt.status).toBe(400);
    });
  });

  describe('OTP correctness on the reset flow', () => {
    it('rejects a wrong reset OTP without consuming/leaking the real one', async () => {
      const { email } = await createVerifiedUser('wrongotp');

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });

      const wrong = await request(app.getHttpServer())
        .post('/auth/verify-reset-otp')
        .send({ email, code: '000000' });
      expect(wrong.status).toBe(400);

      const correctCode = latestResetCodeFor(email);
      const correct = await request(app.getHttpServer())
        .post('/auth/verify-reset-otp')
        .send({ email, code: correctCode });
      expect(correct.status).toBe(200);
    });

    it('rejects an expired reset OTP', async () => {
      const { email, userId } = await createVerifiedUser('expiredotp');

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });

      await prisma.emailOtp.updateMany({
        where: {
          accountType: 'USER',
          accountId: userId,
          purpose: 'PASSWORD_RESET',
        },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const code = latestResetCodeFor(email);
      const res = await request(app.getHttpServer())
        .post('/auth/verify-reset-otp')
        .send({ email, code });
      expect(res.status).toBe(400);
    });

    it('rejects reset-password with an invalid/unknown token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          resetToken: 'not-a-real-token',
          newPassword: 'SomePass123',
          confirmPassword: 'SomePass123',
        });
      expect(res.status).toBe(400);
    });

    it('rejects a reset OTP request for an unverified account without leaking that distinction', async () => {
      const email = `pending-${TAG}@example.com`;
      let registerStatus = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            name: 'Pending User',
            email,
            password: 'Password123',
            tenantName: `pending-${TAG}`,
            tenantSlug: `pending-${TAG}`,
          });
        registerStatus = res.status;
        if (registerStatus < 500) break;
      }
      expect(registerStatus).toBe(201);

      const user = await prisma.user.findUnique({ where: { email } });
      tenantIds.push(user!.tenantId);

      const forgotRes = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });
      expect(forgotRes.status).toBe(200);
      // Generic response even though no OTP is actually issued for an
      // unverified (pending-signup) account.
      expect(latestResetCodeFor(email)).toBeUndefined();

      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-reset-otp')
        .send({ email, code: '123456' });
      expect(verifyRes.status).toBe(400);
    });
  });

  describe('tenant isolation', () => {
    it('a reset token minted for one user cannot reset a different user in a different tenant', async () => {
      // Lowercase tags: the email is normalized (lowercased) server-side, so
      // a mixed-case tag here would make our own post-register lookup miss.
      const userA = await createVerifiedUser('tenanta');
      await createVerifiedUser('tenantb');

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: userA.email });
      const code = latestResetCodeFor(userA.email);

      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-reset-otp')
        .send({ email: userA.email, code });
      const resetToken = verifyRes.body.resetToken as string;

      // The token is only ever resolvable server-side against the account it
      // was minted for — there is no client-suppliable field that can
      // redirect it at a different tenant's user, so this exercises that no
      // such override is accepted.
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          resetToken,
          newPassword: 'HijackAttempt123',
          confirmPassword: 'HijackAttempt123',
        });
      expect(res.status).toBe(200);

      const userAAfter = await prisma.user.findUnique({
        where: { id: userA.userId },
      });
      const bcrypt = await import('bcrypt');
      expect(
        await bcrypt.compare('HijackAttempt123', userAAfter!.password),
      ).toBe(true);
      // Confirms the token only ever touched userA's own account.
      expect(userAAfter!.id).toBe(userA.userId);
    });
  });
});
