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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenantName,
            slug: dto.tenantSlug,
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            name: dto.name,
            tenantId: tenant.id,
          },
        });

        return { tenant, user };
      });

      const tokens = await this.getTokens(
        result.user.id,
        result.user.email,
        result.tenant.id,
        'admin',
      );

      await this.updateRefreshTokenHash(
        result.user.id,
        tokens.refresh_token,
        'admin',
      );

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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.tenantId,
      'admin',
    );

    await this.updateRefreshTokenHash(user.id, tokens.refresh_token, 'admin');
    return tokens;
  }



  async logout(userId: string) {
    // Try both models as controller doesn't specify role
    await this.prisma.user.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return true;
  }

  async refreshTokens(userId: string, rt: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    const typedUser = user as { id: string; email: string; tenantId: string };

    const tokens = await this.getTokens(
      typedUser.id,
      typedUser.email,
      typedUser.tenantId,
      'admin',
    );

    await this.updateRefreshTokenHash(
      typedUser.id,
      tokens.refresh_token,
      'admin',
    );
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
    role: 'admin',
  ) {
    const atSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const atExpires = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    const rtSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const rtExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, tenantId, role },
        {
          secret: atSecret,
          expiresIn: atExpires as unknown as number,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, tenantId, role },
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
