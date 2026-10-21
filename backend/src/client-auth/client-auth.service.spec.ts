import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ClientAuthService } from './client-auth.service';
import { ClientAuthController } from './client-auth.controller';

/**
 * This module had no tests, which is how three defects in one flow survived:
 * a public signup that attached the account to an arbitrary tenant, a portal
 * page that dead-ended on the response it returned, and an invite path whose
 * accounts could never clear the verification gate. These cover what the flow
 * is now.
 */
describe('ClientAuthService', () => {
  const PASSWORD = 'Password123';
  let service: ClientAuthService;
  let prisma: {
    clientUser: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  /** Cheap rounds: bcrypt.compare reads the cost from the hash itself. */
  const hashOf = (plain: string) => bcrypt.hash(plain, 4);

  beforeEach(() => {
    prisma = {
      clientUser: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const jwtService = { signAsync: jest.fn().mockResolvedValue('token') };
    const configService = { get: jest.fn().mockReturnValue('secret') };

    service = new ClientAuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('login', () => {
    it('issues tokens for a verified client user', async () => {
      prisma.clientUser.findUnique.mockResolvedValue({
        id: 'client-user-1',
        email: 'client@example.com',
        password: await hashOf(PASSWORD),
        tenantId: 'tenant-1',
        clientId: 'client-1',
        emailVerified: true,
      });

      const tokens = await service.login({
        email: 'client@example.com',
        password: PASSWORD,
      });

      expect(tokens.access_token).toBeTruthy();
      expect(tokens.refresh_token).toBeTruthy();
      // The refresh token is stored hashed, never in the clear.
      expect(prisma.clientUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'client-user-1' },
          data: { refreshToken: expect.not.stringContaining('token') },
        }),
      );
    });

    /**
     * ClientsService.createClientUser left emailVerified at its false default
     * and nothing ever issued a client an OTP, so every account an agency
     * created for a client hit this gate and could not get past it. Accounts
     * are now active on creation; this proves the gate is what rejected them.
     */
    it('refuses an account that was never activated', async () => {
      prisma.clientUser.findUnique.mockResolvedValue({
        id: 'client-user-1',
        email: 'client@example.com',
        password: await hashOf(PASSWORD),
        tenantId: 'tenant-1',
        clientId: 'client-1',
        emailVerified: false,
      });

      await expect(
        service.login({ email: 'client@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a wrong password', async () => {
      prisma.clientUser.findUnique.mockResolvedValue({
        id: 'client-user-1',
        email: 'client@example.com',
        password: await hashOf(PASSWORD),
        tenantId: 'tenant-1',
        clientId: 'client-1',
        emailVerified: true,
      });

      await expect(
        service.login({ email: 'client@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('answers an unknown email the same way as a wrong password', async () => {
      prisma.clientUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('normalises the email before looking the account up', async () => {
      prisma.clientUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: '  Client@Example.COM ', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.clientUser.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'client@example.com' } }),
      );
    });
  });

  /**
   * Regression guard for the reason self-signup was removed rather than
   * patched: POST /client-auth/register took a company name, used it as the
   * client's own name, and resolved the agency to whichever tenant was created
   * most recently -- so uninvited accounts landed inside paying customers'
   * workspaces, and which workspace changed every time an agency signed up.
   * Nothing a visitor can type identifies their agency, so there is no form
   * that fixes this. Accounts come from ClientsService.createClientUser.
   */
  describe('self-signup surface', () => {
    const forbidden = ['register', 'verifyEmail', 'resendOtp'] as const;

    it.each(forbidden)('exposes no %s method', (method) => {
      expect(
        (service as unknown as Record<string, unknown>)[method],
      ).toBeUndefined();
    });

    it.each(['register', 'verifyEmail', 'resendOtp'] as const)(
      'exposes no %s route',
      (route) => {
        expect(
          (ClientAuthController.prototype as unknown as Record<
            string,
            unknown
          >)[route],
        ).toBeUndefined();
      },
    );
  });
});
