import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAuthService } from './platform-auth.service';
import { PLATFORM_MAX_FAILED_ATTEMPTS } from './platform-auth.constants';

/**
 * The platform console's credential store.
 *
 * It exists because platform access used to be a boolean column on a TENANT
 * user -- one that signup set to true for every founding user -- so every
 * customer who signed up held a working platform-admin token. These cover the
 * replacement: a separate account type, separately signed tokens, and a login
 * that does not leak which addresses are platform admins.
 */
/** The shape of a `prisma.platformAdmin.update()` argument. */
type AdminUpdateArg = {
  where: { id: string };
  data: Record<string, unknown>;
};

/** The shape of a `jwtService.signAsync()` call: claims, then options. */
type SignArgs = [Record<string, unknown>, { secret: string }];

describe('PlatformAuthService', () => {
  const PASSWORD = 'a-strong-platform-password';
  let service: PlatformAuthService;
  // The mocks carry their argument types so that reading `.mock.calls` back is
  // typed rather than `any` -- these assertions are checking exact payloads
  // (what got hashed, which secret was used), so losing the types here would
  // lose most of their value.
  let prisma: {
    platformAdmin: {
      findUnique: jest.Mock;
      update: jest.Mock<Promise<unknown>, [AdminUpdateArg]>;
      updateMany: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock<Promise<string>, SignArgs> };
  let configService: { get: jest.Mock };

  /** Cheap rounds: bcrypt.compare reads the cost from the hash itself. */
  const hashOf = (plain: string) => bcrypt.hash(plain, 4);

  const adminRow = async (overrides: Record<string, unknown> = {}) => ({
    id: 'admin-1',
    email: 'ops@example.com',
    password: await hashOf(PASSWORD),
    name: 'Ops',
    isActive: true,
    refreshTokenHash: null,
    failedAttempts: 0,
    lockedUntil: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      platformAdmin: {
        findUnique: jest.fn(),
        update: jest
          .fn<Promise<unknown>, [AdminUpdateArg]>()
          .mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwtService = {
      signAsync: jest
        .fn<Promise<string>, SignArgs>()
        .mockImplementation((_claims, options) =>
          Promise.resolve(`signed-with:${options.secret}`),
        ),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_PLATFORM_ACCESS_SECRET'
          ? 'platform-access-secret'
          : key === 'JWT_PLATFORM_REFRESH_SECRET'
            ? 'platform-refresh-secret'
            : undefined,
      ),
    };

    service = new PlatformAuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('login', () => {
    it('issues tokens for a valid platform admin', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(await adminRow());

      const result = await service.login(
        'ops@example.com',
        PASSWORD,
        '1.2.3.4',
      );

      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();
      expect(result.admin).toEqual({
        id: 'admin-1',
        email: 'ops@example.com',
        name: 'Ops',
      });
    });

    /**
     * The whole point of the split. If these two ever signed with the same key,
     * a tenant's own access token would verify against the platform strategy
     * and the original vulnerability would be back.
     */
    it('signs access and refresh with the two platform secrets, not the tenant ones', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(await adminRow());

      await service.login('ops@example.com', PASSWORD);

      const secretsUsed = jwtService.signAsync.mock.calls.map(
        (call) => call[1].secret,
      );
      expect(secretsUsed).toEqual([
        'platform-access-secret',
        'platform-refresh-secret',
      ]);
      // Never reads the tenant app's keys.
      expect(configService.get).not.toHaveBeenCalledWith('JWT_ACCESS_SECRET');
      expect(configService.get).not.toHaveBeenCalledWith('JWT_REFRESH_SECRET');
    });

    it('stores the refresh token hashed, never in the clear', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(await adminRow());

      const result = await service.login('ops@example.com', PASSWORD);

      const stored = prisma.platformAdmin.update.mock.calls[0][0].data
        .refreshTokenHash as string;
      expect(stored).not.toBe(result.refresh_token);
      await expect(bcrypt.compare(result.refresh_token, stored)).resolves.toBe(
        true,
      );
    });

    it('normalises the email before looking the account up', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(null);

      await expect(
        service.login('  OPS@Example.COM ', PASSWORD),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.platformAdmin.findUnique).toHaveBeenCalledWith({
        where: { email: 'ops@example.com' },
      });
    });

    it('rejects a wrong password', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(await adminRow());

      await expect(
        service.login('ops@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    /**
     * There are only ever a handful of platform admins, so a login that
     * distinguished "no such account" from "wrong password" would be a cheap
     * oracle for which addresses they are.
     */
    it('answers an unknown email the same way as a wrong password', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(null);
      const unknown = await service
        .login('nobody@example.com', PASSWORD)
        .catch((e: Error) => e);

      prisma.platformAdmin.findUnique.mockResolvedValue(await adminRow());
      const wrongPassword = await service
        .login('ops@example.com', 'wrong-password')
        .catch((e: Error) => e);

      expect((unknown as Error).message).toBe((wrongPassword as Error).message);
    });

    it('refuses a deactivated account', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({ isActive: false }),
      );

      await expect(
        service.login('ops@example.com', PASSWORD),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('locks the account after the configured number of failures', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({ failedAttempts: PLATFORM_MAX_FAILED_ATTEMPTS - 1 }),
      );

      await expect(
        service.login('ops@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const data = prisma.platformAdmin.update.mock.calls[0][0].data;
      expect(data.failedAttempts).toBe(0);
      expect(data.lockedUntil).toBeInstanceOf(Date);
      expect((data.lockedUntil as Date).getTime()).toBeGreaterThan(Date.now());
    });

    it('refuses while locked out, even with the right password', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({ lockedUntil: new Date(Date.now() + 60_000) }),
      );

      await expect(
        service.login('ops@example.com', PASSWORD),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('clears the lockout once it has expired', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({
          lockedUntil: new Date(Date.now() - 60_000),
          failedAttempts: 3,
        }),
      );

      await expect(
        service.login('ops@example.com', PASSWORD),
      ).resolves.toMatchObject({ admin: { id: 'admin-1' } });

      const data = prisma.platformAdmin.update.mock.calls[0][0].data;
      expect(data.failedAttempts).toBe(0);
      expect(data.lockedUntil).toBeNull();
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token', async () => {
      const presented = 'live-refresh-token';
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({ refreshTokenHash: await hashOf(presented) }),
      );

      const result = await service.refresh('admin-1', presented);

      expect(result.access_token).toBeTruthy();
      const stored = prisma.platformAdmin.update.mock.calls[0][0].data
        .refreshTokenHash as string;
      await expect(bcrypt.compare(result.refresh_token, stored)).resolves.toBe(
        true,
      );
    });

    /**
     * A rotated or logged-out refresh token is still correctly signed, so only
     * the stored-hash comparison can tell it from the live one. Presenting one
     * also kills the session, because it means either a replay or a theft.
     */
    it('rejects a signed-but-stale refresh token and clears the session', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({ refreshTokenHash: await hashOf('the-live-token') }),
      );

      await expect(
        service.refresh('admin-1', 'an-older-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.platformAdmin.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { refreshTokenHash: null },
      });
    });

    it('refuses when there is no stored session', async () => {
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({ refreshTokenHash: null }),
      );

      await expect(
        service.refresh('admin-1', 'any-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses for an account deactivated since the token was issued', async () => {
      const presented = 'live-refresh-token';
      prisma.platformAdmin.findUnique.mockResolvedValue(
        await adminRow({
          isActive: false,
          refreshTokenHash: await hashOf(presented),
        }),
      );

      await expect(
        service.refresh('admin-1', presented),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('drops the stored refresh hash so the token cannot be replayed', async () => {
      await service.logout('admin-1');

      expect(prisma.platformAdmin.updateMany).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { refreshTokenHash: null },
      });
    });
  });
});
