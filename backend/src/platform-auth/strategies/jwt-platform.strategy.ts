import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_TOKEN_SCOPE } from '../platform-auth.constants';
import { ActivePlatformAdmin } from '../interfaces/active-platform-admin.interface';

interface PlatformJwtPayload {
  sub?: string;
  email?: string;
  name?: string | null;
  scope?: string;
}

/**
 * Validates a platform console token.
 *
 * Registered under the name 'jwt-platform' and keyed on
 * JWT_PLATFORM_ACCESS_SECRET, which is a DIFFERENT secret from the tenant
 * app's JWT_ACCESS_SECRET. That is the load-bearing part: a tenant's access
 * token is not "a platform token missing a claim", it is a token this strategy
 * cannot verify at all. Adding `isSuperAdmin: true` to a tenant token, or
 * hand-crafting one with the right claims, gets you nothing without the second
 * secret.
 *
 * Unlike the tenant strategy this one hits the database on every request. A
 * platform token carries authority over every tenant in the system, so the
 * cost of one indexed primary-key lookup is worth not having a revoked or
 * deleted admin keep working until their token happens to expire.
 */
@Injectable()
export class JwtPlatformStrategy extends PassportStrategy(
  Strategy,
  'jwt-platform',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_PLATFORM_ACCESS_SECRET');
    if (!secret) {
      // Refusing to boot is the only safe option. Falling back to the tenant
      // secret would re-create the exact hole this module exists to close,
      // and a random per-process secret would silently log every admin out on
      // each restart while looking like it worked.
      throw new Error(
        'JWT_PLATFORM_ACCESS_SECRET is not set. The platform console needs its ' +
          'own signing secret, separate from JWT_ACCESS_SECRET.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<ActivePlatformAdmin> {
    if (payload.scope !== PLATFORM_TOKEN_SCOPE || !payload.sub) {
      throw new UnauthorizedException('Not a platform session.');
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isActive: true },
    });

    // Covers a deleted account and a disabled one with the same message: the
    // login surface should not distinguish them for an unauthenticated caller.
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Platform account is not active.');
    }

    return {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      scope: PLATFORM_TOKEN_SCOPE,
    };
  }
}
