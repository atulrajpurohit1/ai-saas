import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientChangePasswordDto } from './dto/change-password.dto';
import { ClientSetInitialPasswordDto } from './dto/set-initial-password.dto';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import { VerifyOtpDto } from '../email-verification/dto/verify-otp.dto';
import {
  EmailVerificationService,
  PASSWORD_RESET_PURPOSE,
} from '../email-verification/email-verification.service';
import {
  BCRYPT_PASSWORD_ROUNDS,
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
    private emailVerification: EmailVerificationService,
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
    // mustChangePassword tells the portal to send the client straight to the
    // set-a-new-password screen before anything else. They are still issued
    // real tokens so they can authenticate the set-initial-password call.
    return { ...tokens, mustChangePassword: user.mustChangePassword };
  }

  /**
   * First-login password set. Only honoured while the account is still on its
   * agency-generated temporary password (mustChangePassword). Clears the flag,
   * invalidates any other session, and hands back a fresh token pair for the
   * current device so the client lands in the portal already signed in.
   */
  async setInitialPassword(userId: string, dto: ClientSetInitialPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const user = await this.prisma.clientUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Access denied');

    // Not in the temporary-password state (e.g. already changed in another
    // tab): nothing to do here. Point them at the normal change-password flow
    // rather than letting this no-current-password path set a new secret.
    if (!user.mustChangePassword) {
      throw new BadRequestException(
        'Your password has already been set. Use change password instead.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_PASSWORD_ROUNDS,
    );

    await this.prisma.clientUser.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        // Drop any existing refresh token first; the fresh pair below replaces
        // it, so a session that held the temporary-password login elsewhere
        // cannot keep refreshing.
        refreshToken: null,
      },
    });

    return this.issueFreshSession(user);
  }

  /**
   * Changes the password from inside the portal. Requires the current password
   * so an already-open session cannot silently reset the credential, then
   * invalidates other sessions and returns a fresh token pair for this device.
   */
  async changePassword(userId: string, dto: ClientChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const user = await this.prisma.clientUser.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Access denied');

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!currentMatches) {
      throw new BadRequestException('Your current password is incorrect.');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'Your new password must be different from your current password.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_PASSWORD_ROUNDS,
    );

    await this.prisma.clientUser.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // A deliberate change also clears the first-login flag, so a client who
        // changes their own password before the forced prompt is never asked
        // to change it again.
        mustChangePassword: false,
        refreshToken: null,
      },
    });

    return this.issueFreshSession(user);
  }

  // Generic, enumeration-safe response for every forgot-password step that
  // must not reveal whether a client account exists. Mirrors AuthService.
  private readonly forgotPasswordGenericMessage =
    'If an account exists for this email, a verification code has been sent.';

  /**
   * Starts the client-portal forgot-password flow. Always returns the same
   * generic response; only a real, verified client account is actually emailed
   * an OTP. The code is sent with the serving agency's branding (not AegisLead's)
   * — the client is the agency's customer and has never heard of the platform.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.clientUser.findUnique({
      where: { email },
      include: { client: true },
    });

    if (user && user.emailVerified) {
      await this.emailVerification.issueOtp({
        accountType: 'CLIENT_USER',
        accountId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.client?.name,
        purpose: PASSWORD_RESET_PURPOSE,
      });
    }

    return { message: this.forgotPasswordGenericMessage };
  }

  /**
   * Verifies the forgot-password OTP and, on success, mints a short-lived,
   * single-use reset token that resetPassword requires.
   */
  async verifyResetOtp(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.clientUser.findUnique({
      where: { email },
    });

    // Same generic failure as a wrong code, so this step is not a second
    // account-enumeration oracle.
    if (!user || !user.emailVerified) {
      throw new BadRequestException('Invalid verification code.');
    }

    await this.emailVerification.verifyOtp({
      accountType: 'CLIENT_USER',
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
   * Completes the forgot-password flow: validates the single-use reset token,
   * updates the password, and invalidates the account's refresh credential so a
   * session that outlived the reset cannot keep refreshing.
   */
  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const { accountId, tenantId } =
      await this.emailVerification.consumePasswordResetToken(dto.resetToken);

    const user = await this.prisma.clientUser.findUnique({
      where: { id: accountId },
    });

    // The token carries its own accountId/tenantId (minted server-side), so
    // this also enforces tenant isolation and, because we look up a clientUser
    // here, that the token was issued for a client account rather than a staff
    // one that happens to share the reset-token table.
    if (!user || user.tenantId !== tenantId) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired. Please start the reset process again.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_PASSWORD_ROUNDS,
    );

    await this.prisma.clientUser.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        refreshToken: null,
      },
    });

    return { message: 'Password reset successfully.' };
  }

  /** Issues a fresh token pair for the current device and persists its hash. */
  private async issueFreshSession(user: {
    id: string;
    email: string;
    tenantId: string;
    clientId: string;
  }) {
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
