import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLATFORM_LOCKOUT_MINUTES,
  PLATFORM_MAX_FAILED_ATTEMPTS,
  PLATFORM_TOKEN_SCOPE,
} from './platform-auth.constants';
import { ActivePlatformAdmin } from './interfaces/active-platform-admin.interface';

export interface PlatformTokens {
  access_token: string;
  refresh_token: string;
  admin: { id: string; email: string; name: string | null };
}

@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Password login for the platform console.
   *
   * Every failure answers with the same message and the same shape. Telling a
   * caller apart ("no such admin" vs "wrong password") would turn this into an
   * oracle for which addresses are platform admins, and there are only ever a
   * handful of those.
   */
  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<PlatformTokens> {
    const normalized = email.trim().toLowerCase();
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: normalized },
    });

    const invalid = () =>
      new UnauthorizedException('Invalid platform credentials.');

    if (!admin) {
      // Still spend the time a bcrypt compare would have taken. Returning
      // immediately makes "unknown address" measurably faster than "wrong
      // password", which is the same oracle by a side channel.
      await bcrypt.compare(password, DUMMY_HASH);
      throw invalid();
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new ForbiddenException(
        'Too many failed attempts. Try again later.',
      );
    }

    if (!admin.isActive) {
      throw invalid();
    }

    const matches = await bcrypt.compare(password, admin.password);
    if (!matches) {
      const attempts = admin.failedAttempts + 1;
      const locked = attempts >= PLATFORM_MAX_FAILED_ATTEMPTS;
      await this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          failedAttempts: locked ? 0 : attempts,
          lockedUntil: locked
            ? new Date(Date.now() + PLATFORM_LOCKOUT_MINUTES * 60_000)
            : null,
        },
      });
      this.logger.warn(
        `Failed platform login for ${normalized} from ${ip ?? 'unknown ip'} (attempt ${attempts})`,
      );
      throw invalid();
    }

    const tokens = await this.issueTokens(admin.id, admin.email, admin.name);
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? null,
        refreshTokenHash: await bcrypt.hash(tokens.refresh_token, 10),
      },
    });
    this.logger.log(
      `Platform admin ${admin.email} signed in from ${ip ?? 'unknown ip'}`,
    );
    return tokens;
  }

  /**
   * Rotates a refresh token. The presented token must match the stored hash,
   * so a token that was already used to refresh -- or one from a session that
   * logged out -- is rejected even though its signature is still valid.
   */
  async refresh(adminId: string, presentedToken: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });
    if (!admin || !admin.isActive || !admin.refreshTokenHash) {
      throw new UnauthorizedException('Session is no longer valid.');
    }
    const matches = await bcrypt.compare(
      presentedToken,
      admin.refreshTokenHash,
    );
    if (!matches) {
      // A signed-but-unrecognised refresh token means either a replay or a
      // stolen older token. Drop the stored hash so the real session has to
      // log in again too, rather than leaving a thief and the owner both live.
      await this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { refreshTokenHash: null },
      });
      this.logger.warn(
        `Rejected a stale platform refresh token for ${admin.email}; session cleared.`,
      );
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const tokens = await this.issueTokens(admin.id, admin.email, admin.name);
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { refreshTokenHash: await bcrypt.hash(tokens.refresh_token, 10) },
    });
    return tokens;
  }

  async logout(adminId: string) {
    await this.prisma.platformAdmin.updateMany({
      where: { id: adminId },
      data: { refreshTokenHash: null },
    });
    return { success: true };
  }

  me(admin: ActivePlatformAdmin) {
    return {
      id: admin.adminId,
      email: admin.email,
      name: admin.name,
      scope: admin.scope,
    };
  }

  private async issueTokens(
    id: string,
    email: string,
    name: string | null,
  ): Promise<PlatformTokens> {
    const claims = { sub: id, email, name, scope: PLATFORM_TOKEN_SCOPE };

    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(claims, {
        secret: this.config.get<string>('JWT_PLATFORM_ACCESS_SECRET'),
        // Shorter than the tenant app's. This token is the keys to every
        // tenant; a stolen one should stop working sooner. The cast matches
        // AuthService.getTokens: @nestjs/jwt types expiresIn as a narrow
        // string-literal union that a config lookup cannot satisfy.
        expiresIn: (this.config.get<string>('JWT_PLATFORM_ACCESS_EXPIRES_IN') ??
          '30m') as unknown as number,
      }),
      this.jwt.signAsync(claims, {
        secret: this.config.get<string>('JWT_PLATFORM_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>(
          'JWT_PLATFORM_REFRESH_EXPIRES_IN',
        ) ?? '8h') as unknown as number,
      }),
    ]);

    return { access_token, refresh_token, admin: { id, email, name } };
  }
}

/**
 * A real bcrypt hash of a value nothing can match, used only to burn the same
 * CPU time as a genuine comparison when the address is unknown. Must stay a
 * valid hash: bcrypt.compare returns early on a malformed one, which would
 * defeat the point.
 */
const DUMMY_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
