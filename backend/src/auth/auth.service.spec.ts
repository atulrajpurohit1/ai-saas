import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  EmailVerificationService,
  PASSWORD_CHANGE_PURPOSE,
  TWO_FACTOR_LOGIN_PURPOSE,
} from '../email-verification/email-verification.service';
import { EmailService } from '../email/email.service';
import { AuthService } from './auth.service';

// bcrypt's native exports are non-configurable, so jest.spyOn can't wrap them;
// auto-mock the module and set compare/hash per test instead.
jest.mock('bcrypt');

const emailServiceStub = () =>
  ({
    sendNewSignupNotification: jest.fn().mockResolvedValue({ sent: true }),
    sendSecurityAlertEmail: jest.fn().mockResolvedValue({ sent: true }),
  }) as unknown as EmailService;

const rolesServiceStub = () =>
  ({
    ensureDefaultAssignmentForUser: jest.fn().mockResolvedValue(undefined),
    getUserAccessProfile: jest.fn().mockResolvedValue({
      role: 'admin',
      branchId: null,
      isSuperAdmin: false,
    }),
  }) as unknown as RolesService;

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
      emailServiceStub(),
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
      name: 'Pending Owner',
      tenantId: 'tenant-1',
      tenant: { id: 'tenant-1', name: 'Pending Co' },
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
    tenant: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
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
        update: jest.fn().mockResolvedValue({}),
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
      emailServiceStub(),
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

describe('AuthService two-step verification at login', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let emailVerification: { issueOtp: jest.Mock; verifyOtp: jest.Mock };
  let sessionsService: {
    generateSessionId: jest.Mock;
    createSession: jest.Mock;
  };

  const twoFactorUser = {
    id: 'user-1',
    email: 'owner@example.com',
    name: 'Owner',
    password: 'hashed',
    tenantId: 'tenant-1',
    tenant: { id: 'tenant-1', isActive: true },
    emailVerified: true,
    twoFactorEnabled: true,
    recoveryEmail: null,
    recoveryEmailVerified: false,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(twoFactorUser),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    emailVerification = {
      issueOtp: jest.fn().mockResolvedValue(undefined),
      verifyOtp: jest.fn().mockResolvedValue(true),
    };
    sessionsService = {
      generateSessionId: jest.fn().mockReturnValue('session-1'),
      createSession: jest.fn().mockResolvedValue({}),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      { signAsync: jest.fn().mockResolvedValue('token') } as unknown as JwtService,
      { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService,
      rolesServiceStub(),
      sessionsService as unknown as SessionsService,
      emailVerification as unknown as EmailVerificationService,
      emailServiceStub(),
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  it('emails a code and withholds tokens when 2FA is on', async () => {
    const result = await service.login({
      email: 'owner@example.com',
      password: 'correct',
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'two_factor_required', email: 'owner@example.com' }),
    );
    expect(emailVerification.issueOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: TWO_FACTOR_LOGIN_PURPOSE,
        // No verified recovery email -> code goes to the primary address.
        email: 'owner@example.com',
      }),
    );
    expect(sessionsService.createSession).not.toHaveBeenCalled();
  });

  it('sends the code to the verified recovery email when one exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...twoFactorUser,
      recoveryEmail: 'backup@example.com',
      recoveryEmailVerified: true,
    });

    await service.login({ email: 'owner@example.com', password: 'correct' });

    expect(emailVerification.issueOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'backup@example.com' }),
    );
  });

  it('issues tokens only after the login code is verified', async () => {
    const tokens = await service.verifyLoginTwoFactor({
      email: 'owner@example.com',
      code: '123456',
    });

    expect(emailVerification.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: TWO_FACTOR_LOGIN_PURPOSE, code: '123456' }),
    );
    expect(tokens).toEqual({ access_token: 'token', refresh_token: 'token' });
    expect(sessionsService.createSession).toHaveBeenCalled();
  });
});

describe('AuthService.changePassword', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    userSession: { updateMany: jest.Mock };
  };
  let emailVerification: { issueOtp: jest.Mock; verifyOtp: jest.Mock };
  let emailService: EmailService;

  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'owner@example.com',
    name: 'Owner',
    password: 'current-hash',
    tenantId: 'tenant-1',
    twoFactorEnabled: false,
    recoveryEmail: null,
    recoveryEmailVerified: false,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(makeUser()),
        update: jest.fn().mockResolvedValue({}),
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    emailVerification = {
      issueOtp: jest.fn().mockResolvedValue(undefined),
      verifyOtp: jest.fn().mockResolvedValue(true),
    };
    emailService = emailServiceStub();

    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      { get: jest.fn() } as unknown as ConfigService,
      rolesServiceStub(),
      {} as SessionsService,
      emailVerification as unknown as EmailVerificationService,
      emailService,
    );
    // current password matches, new password differs from the old hash.
    (bcrypt.compare as jest.Mock).mockImplementation((plain: string) =>
      Promise.resolve(plain === 'current-pass'),
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
  });

  const dto = {
    currentPassword: 'current-pass',
    newPassword: 'brand-new-pass',
    confirmPassword: 'brand-new-pass',
  };

  it('rejects a wrong current password', async () => {
    await expect(
      service.changePassword('user-1', 'session-1', {
        ...dto,
        currentPassword: 'wrong',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('changes the password directly when 2FA is off, keeping the current session', async () => {
    const result = await service.changePassword('user-1', 'session-1', dto);

    expect(result).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ password: 'new-hash' }) }),
    );
    // Other sessions revoked, current one spared.
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'session-1' } }),
      }),
    );
    expect(emailService.sendSecurityAlertEmail).toHaveBeenCalled();
  });

  it('requires a code first when 2FA is on, without touching the password', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorEnabled: true }));

    const result = await service.changePassword('user-1', 'session-1', dto);

    expect(result).toEqual(expect.objectContaining({ status: 'otp_required' }));
    expect(emailVerification.issueOtp).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: PASSWORD_CHANGE_PURPOSE }),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('changes the password when 2FA is on and a valid code is supplied', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorEnabled: true }));

    const result = await service.changePassword('user-1', 'session-1', {
      ...dto,
      code: '123456',
    });

    expect(emailVerification.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: PASSWORD_CHANGE_PURPOSE, code: '123456' }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
