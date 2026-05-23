import { Injectable, UnauthorizedException } from '@nestjs/common';
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
        OR: [
          { email: identifier.toLowerCase() },
          { phone: identifier },
        ],
      },
      include: { tenant: true },
    });

    for (const guard of candidates) {
      if (!guard.passwordHash) continue;

      const passwordMatches = await bcrypt.compare(dto.password, guard.passwordHash);
      if (!passwordMatches) continue;

      const accessToken = await this.jwtService.signAsync(
        {
          sub: guard.id,
          guard_id: guard.id,
          guardId: guard.id,
          tenant_id: guard.tenantId,
          tenantId: guard.tenantId,
          role: 'guard',
          email: guard.email,
          phone: guard.phone,
        },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') as unknown as number,
        },
      );

      await this.auditService.log({
        tenantId: guard.tenantId,
        userId: guard.id,
        action: 'GUARD_LOGIN',
        entityType: 'Guard',
        entityId: guard.id,
        details: `Guard "${guard.name}" logged in`,
      });

      return {
        access_token: accessToken,
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
}
