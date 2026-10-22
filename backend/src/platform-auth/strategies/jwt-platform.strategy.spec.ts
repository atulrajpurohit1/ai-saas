import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPlatformStrategy } from './jwt-platform.strategy';

/**
 * The gate the whole fix rests on.
 *
 * Platform access used to be the `isSuperAdmin` claim on a TENANT token, which
 * signup set for every founding user -- so every customer could open the
 * platform console. This strategy is keyed on JWT_PLATFORM_ACCESS_SECRET, a
 * different secret from the tenant app's, which is why a tenant token cannot
 * reach a platform route at all: passport rejects it on signature before any
 * claim is read. These cover the checks that run *after* a signature verifies.
 */
describe('JwtPlatformStrategy', () => {
  let prisma: { platformAdmin: { findUnique: jest.Mock } };

  /** `null` means the variable is unset; omitting it supplies a valid one. */
  const build = (secret: string | null = 'platform-access-secret') => {
    prisma = { platformAdmin: { findUnique: jest.fn() } };
    const config = {
      get: jest.fn((key: string) =>
        key === 'JWT_PLATFORM_ACCESS_SECRET'
          ? (secret ?? undefined)
          : undefined,
      ),
    };
    return new JwtPlatformStrategy(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  };

  /**
   * Falling back to the tenant secret would silently re-open the hole, and a
   * random per-process secret would log every admin out on each restart while
   * appearing to work. Refusing to construct is the only safe answer.
   */
  it('refuses to construct without its own signing secret', () => {
    expect(() => build(null)).toThrow(/JWT_PLATFORM_ACCESS_SECRET/);
  });

  it('accepts a platform-scoped token for an active admin', async () => {
    const strategy = build();
    prisma.platformAdmin.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'ops@example.com',
      name: 'Ops',
      isActive: true,
    });

    await expect(
      strategy.validate({ sub: 'admin-1', scope: 'platform' }),
    ).resolves.toEqual({
      adminId: 'admin-1',
      email: 'ops@example.com',
      name: 'Ops',
      scope: 'platform',
    });
  });

  /**
   * Belt-and-braces against a future mistake: if someone ever configured the
   * platform and tenant secrets to the same value, a tenant token would verify
   * here -- and would still be refused, because it does not carry this scope.
   */
  it('rejects a token without the platform scope', async () => {
    const strategy = build();

    await expect(
      strategy.validate({ sub: 'user-1', scope: 'tenant' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.platformAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a token with no scope claim at all', async () => {
    const strategy = build();

    await expect(strategy.validate({ sub: 'user-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.platformAdmin.findUnique).not.toHaveBeenCalled();
  });

  /**
   * A tenant token shaped to look like a platform one -- right scope, a tenant
   * user's id in `sub` -- still finds no PlatformAdmin row. Platform identity
   * is a row in a table with no tenant relation, not a claim.
   */
  it('rejects a platform-scoped token whose subject is not a platform admin', async () => {
    const strategy = build();
    prisma.platformAdmin.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'tenant-user-1', scope: 'platform' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /**
   * Checked on every request rather than only at login: a platform token has
   * authority over every tenant, so revoking an account must take effect now,
   * not whenever that token happens to expire.
   */
  it('rejects a deactivated admin even with a still-valid token', async () => {
    const strategy = build();
    prisma.platformAdmin.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'ops@example.com',
      name: 'Ops',
      isActive: false,
    });

    await expect(
      strategy.validate({ sub: 'admin-1', scope: 'platform' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token with no subject', async () => {
    const strategy = build();

    await expect(
      strategy.validate({ scope: 'platform' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
