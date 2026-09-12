import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  EmailVerificationService,
  PASSWORD_RESET_PURPOSE,
} from '../email-verification/email-verification.service';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import { ResendOtpDto } from '../email-verification/dto/resend-otp.dto';

type AdminPortalRole = string;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private rolesService: RolesService,
    private sessionsService: SessionsService,
    private emailVerification: EmailVerificationService,
  ) {}

  private mapUserRole(role: string): AdminPortalRole {
    return role.toLowerCase() === 'finance' ? 'finance' : 'admin';
  }

  async register(
    dto: RegisterDto,
    context?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const email = await this.emailVerification.assertValidEmail(dto.email);
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const name = dto.name?.trim() || '';
    const tenantName = dto.tenantName?.trim() || '';

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      // Retrying a signup that never completed OTP verification: reuse the
      // same pending user/tenant instead of failing or creating a duplicate.
      if (existingUser) {
        if (existingUser.emailVerified) {
          throw new ConflictException(
            'An account with this email already exists.',
          );
        }

        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { password: hashedPassword, name },
        });

        await this.emailVerification.issueOtp({
          accountType: 'USER',
          accountId: existingUser.id,
          tenantId: existingUser.tenantId,
          email,
          name,
        });

        return { status: 'verification_required', email };
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const tenantSlug = await this.generateUniqueTenantSlug(tx, tenantName);
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
            emailVerified: false,
          },
        });

        return { tenant, user };
      });

      await this.rolesService.ensureTenantSystemRoles(result.tenant.id);
      await this.rolesService.ensureDefaultAssignmentForUser(result.user.id);

      await this.emailVerification.issueOtp({
        accountType: 'USER',
        accountId: result.user.id,
        tenantId: result.tenant.id,
        email,
        name,
      });

      return { status: 'verification_required', email };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const meta = (error as { meta?: { target: string[] } }).meta;
        const target = meta?.target?.join(',') || '';

        if (target.includes('email')) {
          throw new ConflictException(
            'An account with this email already exists.',
          );
        }

        // Slug collisions are avoided up front by generateUniqueTenantSlug,
        // but fall back to a generic message rather than ever surfacing the
        // raw Prisma constraint text to the user.
        throw new ConflictException(
          'Something went wrong creating your account. Please try again.',
        );
      }
      throw error;
    }
  }

  /**
   * Derives a URL-safe slug from the company name and appends a numeric
   * suffix if needed to keep it unique. The slug is no longer collected
   * from the signup form, so this is the only place it's decided.
   */
  private async generateUniqueTenantSlug(
    tx: Prisma.TransactionClient,
    tenantName: string,
  ): Promise<string> {
    const base =
      tenantName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'company';

    let candidate = base;
    let suffix = 1;

    while (await tx.tenant.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  /**
   * Verifies the OTP sent during registration, marks the user's email
   * verified, and only then issues session tokens — completing signup.
   */
  async verifyEmail(
    dto: VerifyOtpDto,
    context?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    if (!user.emailVerified) {
      await this.emailVerification.verifyOtp({
        accountType: 'USER',
        accountId: user.id,
        code: dto.code,
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });
    }

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

  /**
   * Resends a signup OTP. Uses a generic response regardless of whether the
   * email belongs to a real pending signup, to avoid confirming account
   * existence to an unauthenticated caller (enumeration protection).
   */
  async resendOtp(dto: ResendOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.emailVerified) {
      await this.emailVerification.issueOtp({
        accountType: 'USER',
        accountId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
      });
    }

    return {
      message:
        'If an unverified account exists for this email, a new verification code has been sent.',
    };
  }

  // Generic, enumeration-safe response for every forgot-password step that
  // must not reveal whether an account exists.
  private readonly forgotPasswordGenericMessage =
    'If an account exists for this email, a verification code has been sent.';

  /**
   * Starts the forgot-password flow. Always returns the same generic
   * response whether or not the email belongs to a real, verified account —
   * only a verified account actually gets an OTP (an unverified/pending
   * signup has no password worth resetting via this flow; use resend-otp to
   * finish signup instead).
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.emailVerified) {
      await this.emailVerification.issueOtp({
        accountType: 'USER',
        accountId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        purpose: PASSWORD_RESET_PURPOSE,
      });
    }

    return { message: this.forgotPasswordGenericMessage };
  }

  /**
   * Verifies the OTP issued by forgotPassword. On success, issues a
   * short-lived, single-purpose reset token (never a login/session token)
   * that resetPassword requires — the frontend never resets a password with
   * only an email address.
   */
  async verifyResetOtp(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same generic-looking failure as a wrong code, so this step doesn't
    // become a second account-enumeration oracle.
    if (!user || !user.emailVerified) {
      throw new BadRequestException('Invalid verification code.');
    }

    await this.emailVerification.verifyOtp({
      accountType: 'USER',
      accountId: user.id,
      code: dto.code,
      purpose: PASSWORD_RESET_PURPOSE,
    });

    const { token, expiresAt } =
      await this.emailVerification.issuePasswordResetToken({
        accountId: user.id,
        tenantId: user.tenantId,
        email: user.email,
      });

    return { resetToken: token, expiresAt };
  }

  /**
   * Completes the forgot-password flow: validates the single-use reset
   * token, updates the password, and invalidates every existing
   * refresh/session credential for the account so a stolen session can't
   * outlive the reset.
   */
  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const { accountId, tenantId } =
      await this.emailVerification.consumePasswordResetToken(
        dto.resetToken,
      );

    const user = await this.prisma.user.findUnique({
      where: { id: accountId },
    });

    // The token carries its own accountId/tenantId (minted server-side, not
    // client-supplied), so this also enforces tenant isolation: a token can
    // only ever resolve to the one account/tenant it was issued for.
    if (!user || user.tenantId !== tenantId) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired. Please start the reset process again.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, refreshToken: null },
    });

    // Invalidate every active session so previously authenticated devices
    // cannot continue using the old credentials.
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'revoked', refreshTokenHash: null, revokedAt: new Date() },
    });

    return { message: 'Password reset successfully.' };
  }

  async login(
    dto: LoginDto,
    context?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
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

    await this.updateRefreshTokenHash(
      user.id,
      tokens.refresh_token,
      profile.role,
    );
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

  async refreshTokens(
    userId: string,
    rt: string,
    role: string,
    sessionId?: string,
  ) {
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
      await this.sessionsService.rotateRefreshToken(
        sessionId,
        tokens.refresh_token,
      );
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
        {
          sub: userId,
          email,
          tenantId,
          role,
          branchId,
          isSuperAdmin,
          sessionId,
        },
        {
          secret: atSecret,
          expiresIn: atExpires as unknown as number,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          tenantId,
          role,
          branchId,
          isSuperAdmin,
          sessionId,
        },
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
