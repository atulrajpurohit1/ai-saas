import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ClientLoginDto } from './dto/client-login.dto';
import {
  BCRYPT_TOKEN_ROUNDS,
  DUMMY_PASSWORD_HASH,
} from '../auth/password-policy';

/**
 * Sessions for the client portal.
 *
 * There is no self-signup here, and there deliberately cannot be one. A client
 * account exists inside exactly one agency's workspace, and a stranger filling
 * in a form has no way to tell us which agency they belong to -- the old
 * endpoint asked for a company name, used it as the *client's* own name, and
 * then attached the account to whichever tenant happened to be created most
 * recently. That put uninvited accounts inside paying customers' workspaces and
 * moved the target every time a new agency signed up.
 *
 * Accounts are created by the agency instead, via
 * ClientsService.createClientUser, which scopes the row to the admin's own
 * tenant and returns a temporary password for them to pass on.
 */
@Injectable()
export class ClientAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: ClientLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.clientUser.findUnique({
      where: { email },
      include: { client: true, tenant: true },
    });

    // Same constant-time treatment as AuthService.login -- see the note there.
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    // A suspended tenant takes its client portal down with it. After the
    // password check, for the same reason as the agency login.
    if (!user.tenant.isActive) {
      throw new ForbiddenException(
        'This account has been suspended. Please contact your account manager.',
      );
    }

    /**
     * Agency-created accounts are verified at creation, so this now only
     * catches rows left behind by the removed self-signup: accounts that were
     * never confirmed and whose tenant was never really chosen. They stay
     * locked, and there is no longer any endpoint that can unlock them.
     */
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'This account is not active. Please contact your account manager.',
      );
    }

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.tenantId,
      user.clientId,
    );

    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.clientUser.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return true;
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.prisma.clientUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.tenantId,
      user.clientId,
    );

    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return tokens;
  }

  private async updateRefreshTokenHash(userId: string, rt: string) {
    const hash = await bcrypt.hash(rt, BCRYPT_TOKEN_ROUNDS);
    await this.prisma.clientUser.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }

  private async getTokens(
    userId: string,
    email: string,
    tenantId: string,
    clientId: string,
  ) {
    const payload = { sub: userId, email, tenantId, clientId, role: 'client' };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
