import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { AuthService } from './auth.service';

describe('AuthService.verifyEmail', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let emailVerification: { verifyOtp: jest.Mock };
  let sessionsService: {
    generateSessionId: jest.Mock;
    createSession: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    emailVerification = { verifyOtp: jest.fn().mockResolvedValue(true) };
    sessionsService = {
      generateSessionId: jest.fn().mockReturnValue('session-1'),
      createSession: jest.fn().mockResolvedValue({}),
    };

    const rolesService = {
      ensureDefaultAssignmentForUser: jest.fn().mockResolvedValue(undefined),
      getUserAccessProfile: jest.fn().mockResolvedValue({
        role: 'admin',
        branchId: null,
        isSuperAdmin: false,
      }),
    };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('token') };
    const configService = { get: jest.fn().mockReturnValue('secret') };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      rolesService as unknown as RolesService,
      sessionsService as unknown as SessionsService,
      emailVerification as unknown as EmailVerificationService,
    );
  });

  /**
   * Regression: verifyEmail used to check the OTP only when the account was
   * NOT already verified, then issue tokens either way. That made
   * POST /auth/verify-email an unauthenticated login -- a known email address
   * and any arbitrary code returned a full session for that account.
   */
  it('refuses to issue tokens for an already-verified account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'victim@example.com',
      tenantId: 'tenant-1',
      emailVerified: true,
    });

    await expect(
      service.verifyEmail({ email: 'victim@example.com', code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionsService.createSession).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown email without issuing tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyEmail({ email: 'nobody@example.com', code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionsService.createSession).not.toHaveBeenCalled();
  });

  it('propagates an OTP failure instead of issuing tokens', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'pending@example.com',
      tenantId: 'tenant-1',
      emailVerified: false,
    });
    emailVerification.verifyOtp.mockRejectedValue(new Error('bad code'));

    await expect(
      service.verifyEmail({ email: 'pending@example.com', code: '111111' }),
    ).rejects.toThrow('bad code');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sessionsService.createSession).not.toHaveBeenCalled();
  });

  it('verifies the OTP and issues tokens for a pending signup', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'pending@example.com',
      tenantId: 'tenant-1',
      emailVerified: false,
    });

    const tokens = await service.verifyEmail({
      email: 'pending@example.com',
      code: '123456',
    });

    expect(emailVerification.verifyOtp).toHaveBeenCalledWith({
      accountType: 'USER',
      accountId: 'user-1',
      code: '123456',
    });
    expect(tokens).toEqual({
      access_token: 'token',
      refresh_token: 'token',
    });
    expect(sessionsService.createSession).toHaveBeenCalled();
  });
});

describe('AuthService.register welcome credits', () => {
  let service: AuthService;
  let tx: {
    tenant: { findUnique: jest.Mock; create: jest.Mock };
    tenantSubscription: { create: jest.Mock };
    tenantCreditBalance: { create: jest.Mock };
    creditLedgerEntry: { create: jest.Mock };
    user: { create: jest.Mock };
  };
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  const dto = {
    email: 'owner@newco.com',
    password: 'Str0ng!Passw0rd',
    name: 'Owner',
    tenantName: 'NewCo',
  };

  beforeEach(() => {
    tx = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tenant-1' }),
      },
      tenantSubscription: { create: jest.fn().mockResolvedValue({}) },
      tenantCreditBalance: { create: jest.fn().mockResolvedValue({}) },
      creditLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const rolesService = {
      ensureTenantSystemRoles: jest.fn().mockResolvedValue(undefined),
      ensureDefaultAssignmentForUser: jest.fn().mockResolvedValue(undefined),
    };
    const emailVerification = {
      assertValidEmail: jest.fn((email: string) => Promise.resolve(email)),
      issueOtp: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      { get: jest.fn() } as unknown as ConfigService,
      rolesService as unknown as RolesService,
      {} as SessionsService,
      emailVerification as unknown as EmailVerificationService,
    );
  });

  it('starts a new tenant with 50 credits and a matching ledger entry', async () => {
    await service.register(dto);

    expect(tx.tenantCreditBalance.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', balance: 50, lifetimePurchased: 50 },
    });
    expect(tx.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        amount: 50,
        balanceAfter: 50,
      }) as unknown,
    });
  });

  it('does not grant again when a pending signup is retried', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      emailVerified: false,
    });

    await service.register(dto);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.tenantCreditBalance.create).not.toHaveBeenCalled();
  });
});
