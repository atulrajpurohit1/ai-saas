import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuardLoginDto } from './dto/guard-login.dto';

@Injectable()
export class GuardAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async login(dto: GuardLoginDto) {
    const identifier = (dto.identifier || dto.email || dto.phone || '').trim();

    if (!identifier) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const candidates = await this.prisma.guard.findMany({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      },
      include: { tenant: true },
    });

    for (const guard of candidates) {
      if (!guard.passwordHash) continue;

      const passwordMatches = await bcrypt.compare(
        dto.password,
        guard.passwordHash,
      );
      if (!passwordMatches) continue;

      const tokens = await this.getTokens(guard.id, guard.tenantId, {
        email: guard.email,
        phone: guard.phone,
      });
      await this.updateRefreshTokenHash(guard.id, tokens.refresh_token);

      await this.auditService.log({
        tenantId: guard.tenantId,
        userId: guard.id,
        action: 'GUARD_LOGIN',
        entityType: 'Guard',
        entityId: guard.id,
        details: `Guard "${guard.name}" logged in`,
      });

      return {
        ...tokens,
        guard: {
          id: guard.id,
          name: guard.name,
          phone: guard.phone,
          email: guard.email,
          tenantId: guard.tenantId,
          tenantName: guard.tenant.name,
        },
      };
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  async refreshTokens(guardId: string, rt: string) {
    const guard = await this.prisma.guard.findUnique({ where: { id: guardId } });

    if (!guard || !guard.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const rtMatches = await bcrypt.compare(rt, guard.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.getTokens(guard.id, guard.tenantId, {
      email: guard.email,
      phone: guard.phone,
    });
    await this.updateRefreshTokenHash(guard.id, tokens.refresh_token);
    return tokens;
  }

  async logout(guardId: string) {
    await this.prisma.guard.updateMany({
      where: { id: guardId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return true;
  }

  private async updateRefreshTokenHash(guardId: string, rt: string) {
    const hash = await bcrypt.hash(rt, 10);
    await this.prisma.guard.update({
      where: { id: guardId },
      data: { refreshToken: hash },
    });
  }

  private async getTokens(
    guardId: string,
    tenantId: string,
    extra: { email: string | null; phone: string | null },
  ) {
    const payload = {
      sub: guardId,
      guard_id: guardId,
      guardId,
      tenant_id: tenantId,
      tenantId,
      role: 'guard',
      email: extra.email,
      phone: extra.phone,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as unknown as number,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as unknown as number,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
