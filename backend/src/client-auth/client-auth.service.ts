import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ClientLoginDto } from './dto/client-login.dto';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';

// Consistent with AuthService.register's email-validation error message.
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';

export class ClientRegisterDto {
  @IsEmail({}, { message: INVALID_EMAIL_MESSAGE })
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
    private emailVerification: EmailVerificationService,
  ) {}

  async login(dto: ClientLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.clientUser.findUnique({
      where: { email },
      include: { client: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email before logging in.',
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

  async register(dto: ClientRegisterDto) {
    const email = await this.emailVerification.assertValidEmail(dto.email);

    try {
      const name = dto.name.trim();
      const companySlug = this.normalizeSlug(dto.tenantSlug);
      const companyName = this.companyNameFromSlug(companySlug);

      if (!name) {
        throw new BadRequestException('Full name is required.');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const existingUser = await this.prisma.clientUser.findUnique({
        where: { email },
      });

      // Retrying a signup that never completed OTP verification: reuse the
      // same pending client/user instead of failing or creating a duplicate.
      if (existingUser) {
        if (existingUser.emailVerified) {
          throw this.uniqueConflict(undefined, 'email');
        }

        await this.prisma.clientUser.update({
          where: { id: existingUser.id },
          data: { password: hashedPassword },
        });

        await this.emailVerification.issueOtp({
          accountType: 'CLIENT_USER',
          accountId: existingUser.id,
          tenantId: existingUser.tenantId,
          email,
          name,
        });

        return { status: 'verification_required', email };
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await this.resolveSignupTenant(tx);

        const client = await tx.client.create({
          data: {
            name,
            companyName,
            email,
            tenantId: tenant.id,
          },
        });

        const user = await tx.clientUser.create({
          data: {
            email,
            password: hashedPassword,
            clientId: client.id,
            tenantId: tenant.id,
            emailVerified: false,
          },
        });

        return { user };
      });

      await this.emailVerification.issueOtp({
        accountType: 'CLIENT_USER',
        accountId: result.user.id,
        tenantId: result.user.tenantId,
        email,
        name,
      });

      return { status: 'verification_required', email };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.uniqueConflict(error);
      }

      throw error;
    }
  }

  /**
   * Verifies the OTP sent during client-portal registration, marks the
   * email verified, and only then issues session tokens.
   */
  async verifyEmail(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.clientUser.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    if (!user.emailVerified) {
      await this.emailVerification.verifyOtp({
        accountType: 'CLIENT_USER',
        accountId: user.id,
        code: dto.code,
      });

      await this.prisma.clientUser.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });
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

  /**
   * Resends a signup OTP. Always returns a generic response regardless of
   * whether the email belongs to a real pending signup (enumeration
   * protection).
   */
  async resendOtp(dto: ResendOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.clientUser.findUnique({ where: { email } });

    if (user && !user.emailVerified) {
      await this.emailVerification.issueOtp({
        accountType: 'CLIENT_USER',
        accountId: user.id,
        tenantId: user.tenantId,
        email: user.email,
      });
    }

    return {
      message:
        'If an unverified account exists for this email, a new verification code has been sent.',
    };
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

  private normalizeSlug(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!slug) {
      throw new BadRequestException(
        'Company name must include letters or numbers.',
      );
    }

    return slug;
  }

  private companyNameFromSlug(slug: string) {
    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async resolveSignupTenant(tx: Prisma.TransactionClient) {
    const configuredTenantId = this.configService
      .get<string>('CLIENT_SIGNUP_TENANT_ID')
      ?.trim();
    const configuredTenantSlug = this.configService
      .get<string>('CLIENT_SIGNUP_TENANT_SLUG')
      ?.trim()
      .toLowerCase();

    const select = {
      id: true,
      name: true,
      slug: true,
    };

    if (configuredTenantId) {
      const tenant = await tx.tenant.findUnique({
        where: { id: configuredTenantId },
        select,
      });

      if (!tenant) {
        throw new InternalServerErrorException(
          'Client signup tenant ID does not match an existing workspace.',
        );
      }

      return tenant;
    }

    if (configuredTenantSlug) {
      const tenant = await tx.tenant.findUnique({
        where: { slug: configuredTenantSlug },
        select,
      });

      if (!tenant) {
        throw new InternalServerErrorException(
          'Client signup tenant slug does not match an existing workspace.',
        );
      }

      return tenant;
    }

    const latestAdminTenant = await tx.tenant.findFirst({
      where: {
        users: {
          some: { isSuperAdmin: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      select,
    });

    if (latestAdminTenant) {
      return latestAdminTenant;
    }

    const defaultTenant = await tx.tenant.findUnique({
      where: { slug: 'admin-tenant' },
      select,
    });

    if (defaultTenant) {
      return defaultTenant;
    }

    throw new InternalServerErrorException(
      'Client signup workspace is not configured.',
    );
  }

  private uniqueConflict(
    error?: Prisma.PrismaClientKnownRequestError,
    knownTarget?: string,
  ) {
    const target =
      knownTarget ||
      (Array.isArray(error?.meta?.target)
        ? error.meta.target.join(',')
        : String(error?.meta?.target || ''));

    if (target.includes('slug')) {
      return new ConflictException('A company with this slug already exists.');
    }

    if (target.includes('email')) {
      return new ConflictException(
        'A client portal account already exists for this email.',
      );
    }

    return new ConflictException(
      'A client account with these details already exists.',
    );
  }
}
