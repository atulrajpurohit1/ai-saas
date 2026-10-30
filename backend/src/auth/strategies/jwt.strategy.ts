import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  tenantId?: string;
  tenant_id?: string;
  role: string;
  branchId?: string | null;
  branch_id?: string | null;
  isSuperAdmin?: boolean;
  is_super_admin?: boolean;
  clientId?: string;
  client_id?: string;
  guardId?: string;
  guard_id?: string;
  sessionId?: string;
  session_id?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    const tenantId = payload.tenantId ?? payload.tenant_id;
    const branchId = payload.branchId ?? payload.branch_id ?? null;
    const clientId = payload.clientId ?? payload.client_id;
    const guardId = payload.guardId ?? payload.guard_id;
    const sessionId = payload.sessionId ?? payload.session_id;
    const isSuperAdmin =
      payload.isSuperAdmin ?? payload.is_super_admin ?? false;

    // A guard's access token stays valid until it expires, so deactivating a
    // guard would otherwise leave an already-signed-in guard working until
    // then. Reject the token the moment the guard is deactivated (or deleted),
    // with a code the client recognises to log them out with a clear message.
    // Only guards hit the database here, so admin/other requests are unaffected.
    if (guardId && payload.role === 'guard') {
      const guard = await this.prisma.guard.findUnique({
        where: { id: guardId },
        select: { deactivatedAt: true },
      });
      if (!guard || guard.deactivatedAt) {
        throw new UnauthorizedException({
          code: 'GUARD_DEACTIVATED',
          message:
            'Your guard account has been deactivated by an administrator.',
        });
      }
    }

    // One active session per user: when the same user signs in elsewhere, this
    // session is revoked (see SessionsService.createSession). Reject the token
    // the moment that happens, rather than letting the old device keep working
    // until the access token expires. Only user logins carry a sessionId --
    // client-portal and guard tokens do not, so they skip this entirely.
    if (sessionId) {
      const session = await this.prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });
      if (!session || session.status !== 'active') {
        throw new UnauthorizedException({
          code: 'SESSION_REVOKED',
          message:
            'You have been signed out because this account was used to sign in on another device.',
        });
      }
    }

    return {
      sub: payload.sub,
      email: payload.email,
      phone: payload.phone,
      tenantId,
      role: payload.role,
      branchId,
      isSuperAdmin,
      clientId,
      guardId,
      sessionId,
    };
  }
}
