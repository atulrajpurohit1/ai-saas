import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';

type AdminPortalRole = string;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private rolesService: RolesService,
    private sessionsService: SessionsService,
  ) {}

  private mapUserRole(role: string): AdminPortalRole {
    return role.toLowerCase() === 'finance' ? 'finance' : 'admin';
  }

  async register(dto: RegisterDto, context?: { ipAddress?: string | null; userAgent?: string | null }) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const tenantName = dto.tenantName.trim();
    const tenantSlug = dto.tenantSlug.trim().toLowerCase();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            slug: tenantSlug,
          },
        });

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            tenantId: tenant.id,
          },
        });

        return { tenant, user };
      });

      await this.rolesService.ensureTenantSystemRoles(result.tenant.id);
      await this.rolesService.ensureDefaultAssignmentForUser(result.user.id);
      const profile = await this.rolesService.getUserAccessProfile(result.user.id);

      const sessionId = this.sessionsService.generateSessionId();
      const tokens = await this.getTokens(
        result.user.id,
        result.user.email,
        result.tenant.id,
        profile.role,
        profile.branchId,
        profile.isSuperAdmin,
        sessionId,
      );

      await this.updateRefreshTokenHash(
        result.user.id,
        tokens.refresh_token,
        profile.role,
      );
      await this.sessionsService.createSession({
        id: sessionId,
        tenantId: result.tenant.id,
        userId: result.user.id,
        refreshToken: tokens.refresh_token,
        source: 'password',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return tokens;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const meta = (error as { meta?: { target: string[] } }).meta;
        throw new ConflictException(
          `Unique constraint failed on the fields: ${meta?.target?.join(', ') || 'unknown'}`,
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto, context?: { ipAddress?: string | null; userAgent?: string | null }) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    await this.rolesService.ensureDefaultAssignmentForUser(user.id);
    const profile = await this.rolesService.getUserAccessProfile(user.id);
    const sessionId = this.sessionsService.generateSessionId();
    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.tenantId,
      profile.role,
      profile.branchId,
      profile.isSuperAdmin,
      sessionId,
    );

    await this.updateRefreshTokenHash(user.id, tokens.refresh_token, profile.role);
    await this.sessionsService.createSession({
      id: sessionId,
      tenantId: user.tenantId,
      userId: user.id,
      refreshToken: tokens.refresh_token,
      source: 'password',
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    return tokens;
  }



  async logout(userId: string, tenantId?: string, sessionId?: string) {
    if (tenantId && sessionId) {
      await this.sessionsService.revokeById(tenantId, sessionId, 'USER_LOGOUT');
    }

    // Try both models as controller doesn't specify role
    await this.prisma.user.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return true;
  }

  async refreshTokens(userId: string, rt: string, role: string, sessionId?: string) {
    if (sessionId) {
      await this.sessionsService.validateRefreshSession(sessionId, rt);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const typedUser = user as {
      id: string;
      email: string;
      tenantId: string;
      branchId: string | null;
      isSuperAdmin: boolean;
    };

    await this.rolesService.ensureDefaultAssignmentForUser(user.id);
    const profile = await this.rolesService.getUserAccessProfile(user.id);
    const tokens = await this.getTokens(
      typedUser.id,
      typedUser.email,
      typedUser.tenantId,
      profile.role,
      profile.branchId,
      profile.isSuperAdmin,
      sessionId,
    );

    await this.updateRefreshTokenHash(
      typedUser.id,
      tokens.refresh_token,
      profile.role,
    );
    if (sessionId) {
      await this.sessionsService.rotateRefreshToken(sessionId, tokens.refresh_token);
    }
    return tokens;
  }

  async updateRefreshTokenHash(userId: string, rt: string, role: string) {
    const hash = await bcrypt.hash(rt, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }

  async getTokens(
    userId: string,
    email: string,
    tenantId: string,
    role: AdminPortalRole,
    branchId: string | null = null,
    isSuperAdmin = true,
    sessionId?: string,
  ) {
    const atSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const atExpires = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    const rtSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const rtExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, tenantId, role, branchId, isSuperAdmin, sessionId },
        {
          secret: atSecret,
          expiresIn: atExpires as unknown as number,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, tenantId, role, branchId, isSuperAdmin, sessionId },
        {
          secret: rtSecret,
          expiresIn: rtExpires as unknown as number,
        },
      ),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
