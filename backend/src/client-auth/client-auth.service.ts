import { Injectable, UnauthorizedException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ClientLoginDto } from './dto/client-login.dto';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ClientRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  tenantSlug: string;
}

@Injectable()
export class ClientAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: ClientLoginDto) {
    const user = await this.prisma.clientUser.findUnique({
      where: { email: dto.email },
      include: { client: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.tenantId,
      user.clientId,
    );

    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return tokens;
  }

  async register(dto: ClientRegisterDto) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: dto.tenantSlug },
      });

      if (!tenant) {
        throw new ForbiddenException('Company not found. Please check the slug.');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const result = await this.prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            name: dto.name,
            email: dto.email,
            tenantId: tenant.id,
          },
        });

        const user = await tx.clientUser.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            clientId: client.id,
            tenantId: tenant.id,
          },
        });

        const tokens = await this.getTokens(
          user.id,
          user.email,
          user.tenantId,
          user.clientId,
        );

        return { user, tokens };
      });

      await this.updateRefreshTokenHash(result.user.id, result.tokens.refresh_token);
      return result.tokens;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'A client or client portal account already exists for this email.',
        );
      }

      throw error;
    }
  }

  async logout(userId: string) {
    await this.prisma.clientUser.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });
    return true;
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.prisma.clientUser.findUnique({ where: { id: userId } });

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
    const hash = await bcrypt.hash(rt, 10);
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
