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
