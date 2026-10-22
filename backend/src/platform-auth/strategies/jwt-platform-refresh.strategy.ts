import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PLATFORM_TOKEN_SCOPE } from '../platform-auth.constants';

interface PlatformJwtPayload {
  sub?: string;
  email?: string;
  scope?: string;
}

export interface PlatformRefreshPayload {
  adminId: string;
  email: string;
  refreshToken: string;
}

/**
 * Validates a platform REFRESH token and hands the raw token back to the
 * service, which compares it against the stored hash. Verifying the signature
 * is not enough on its own: a refresh token that was already rotated or logged
 * out is still correctly signed, so only the stored-hash comparison can tell
 * it apart from the live one.
 */
@Injectable()
export class JwtPlatformRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-platform-refresh',
) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_PLATFORM_REFRESH_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_PLATFORM_REFRESH_SECRET is not set. The platform console needs its ' +
          'own refresh secret, separate from JWT_REFRESH_SECRET.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: PlatformJwtPayload): PlatformRefreshPayload {
    if (payload.scope !== PLATFORM_TOKEN_SCOPE || !payload.sub) {
      throw new UnauthorizedException('Not a platform session.');
    }
    const header = req.get('authorization') ?? '';
    const refreshToken = header.replace(/^Bearer\s+/i, '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing.');
    }
    return {
      adminId: payload.sub,
      email: payload.email ?? '',
      refreshToken,
    };
  }
}
