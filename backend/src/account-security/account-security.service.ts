import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  EmailVerificationService,
  RECOVERY_EMAIL_PURPOSE,
  TWO_FACTOR_SETUP_PURPOSE,
} from '../email-verification/email-verification.service';
import {
  codeTargetEmail,
  maskEmail,
  securityNotifyTargets,
} from '../common/account-security.util';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { StartRecoveryEmailDto } from './dto/start-recovery-email.dto';
import { SecurityCodeDto } from './dto/security-code.dto';

@Injectable()
export class AccountSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Account not found.');
    }
    return user;
  }

  private async assertPassword(
    user: { password: string },
    password: string,
  ): Promise<void> {
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new BadRequestException('Your password is incorrect.');
    }
  }

  /** Current security posture, for rendering Settings -> Security. */
  async getStatus(userId: string) {
    const user = await this.requireUser(userId);
    return {
      email: user.email,
      recoveryEmail: user.recoveryEmail ? maskEmail(user.recoveryEmail) : null,
      hasRecoveryEmail: Boolean(user.recoveryEmail),
      recoveryEmailVerified: user.recoveryEmailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  /**
   * Starts adding/replacing the recovery email: re-auth with the password,
   * validate the address, then email a verification code TO THAT ADDRESS so we
   * only ever store one the user demonstrably controls. The pending address
   * lives on the OTP row, not on the user, until it is verified.
   */
  async startRecoveryEmail(userId: string, dto: StartRecoveryEmailDto) {
    const user = await this.requireUser(userId);
    await this.assertPassword(user, dto.password);

    const email = await this.emailVerification.assertValidEmail(dto.email);
    if (email === user.email.toLowerCase()) {
      throw new BadRequestException(
        'Your recovery email must be different from your main email.',
      );
    }

    await this.emailVerification.issueOtp({
      accountType: 'USER',
      accountId: user.id,
      tenantId: user.tenantId,
      email,
      name: user.name,
      purpose: RECOVERY_EMAIL_PURPOSE,
    });

    return { status: 'otp_sent' as const, target: maskEmail(email) };
  }

  /** Confirms the code sent by startRecoveryEmail and saves the address. */
  async verifyRecoveryEmail(userId: string, dto: SecurityCodeDto) {
    const user = await this.requireUser(userId);

    const pendingEmail = await this.emailVerification.getPendingOtpEmail({
      accountType: 'USER',
      accountId: user.id,
      purpose: RECOVERY_EMAIL_PURPOSE,
    });
    if (!pendingEmail) {
      throw new BadRequestException(
        'No recovery email verification is in progress. Please start again.',
      );
    }

    await this.emailVerification.verifyOtp({
      accountType: 'USER',
      accountId: user.id,
      code: dto.code,
      purpose: RECOVERY_EMAIL_PURPOSE,
    });

    const previousRecovery = user.recoveryEmail;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { recoveryEmail: pendingEmail, recoveryEmailVerified: true },
    });

    // Notify the primary email, the new recovery email, and (if this replaced
    // an existing one) the old recovery email, so a sneaky swap is visible to
    // whoever controlled the old address.
    const recipients = new Set<string>([user.email, pendingEmail]);
    if (previousRecovery) recipients.add(previousRecovery);
    for (const recipient of recipients) {
      void this.emailService.sendSecurityAlertEmail(recipient, {
        name: user.name,
        event: previousRecovery
          ? 'Your recovery email was changed'
          : 'A recovery email was added',
        detail: `Recovery email: ${maskEmail(pendingEmail)}`,
      });
    }

    return { status: 'ok' as const, recoveryEmail: maskEmail(pendingEmail) };
  }

  /** Removes the recovery email after re-auth. */
  async removeRecoveryEmail(userId: string, dto: ConfirmPasswordDto) {
    const user = await this.requireUser(userId);
    await this.assertPassword(user, dto.password);

    if (!user.recoveryEmail) {
      throw new BadRequestException('No recovery email is set.');
    }

    const previousRecovery = user.recoveryEmail;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { recoveryEmail: null, recoveryEmailVerified: false },
    });

    for (const recipient of new Set<string>([user.email, previousRecovery])) {
      void this.emailService.sendSecurityAlertEmail(recipient, {
        name: user.name,
        event: 'Your recovery email was removed',
      });
    }

    return { status: 'ok' as const };
  }

  /**
   * Starts turning on 2FA: re-auth, then email a setup code to the code target
   * (recovery email if set, else primary) to confirm the channel works before
   * the account depends on it at login.
   */
  async startEnableTwoFactor(userId: string, dto: ConfirmPasswordDto) {
    const user = await this.requireUser(userId);
    await this.assertPassword(user, dto.password);

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-step verification is already turned on.',
      );
    }

    const target = codeTargetEmail(user);
    await this.emailVerification.issueOtp({
      accountType: 'USER',
      accountId: user.id,
      tenantId: user.tenantId,
      email: target,
      name: user.name,
      purpose: TWO_FACTOR_SETUP_PURPOSE,
    });

    return { status: 'otp_sent' as const, target: maskEmail(target) };
  }

  /** Confirms the setup code and turns 2FA on. */
  async verifyEnableTwoFactor(userId: string, dto: SecurityCodeDto) {
    const user = await this.requireUser(userId);

    await this.emailVerification.verifyOtp({
      accountType: 'USER',
      accountId: user.id,
      code: dto.code,
      purpose: TWO_FACTOR_SETUP_PURPOSE,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    // Notify the primary and (if verified) recovery email. The 2FA flag isn't
    // part of securityNotifyTargets, so the pre-update `user` is fine here.
    for (const recipient of securityNotifyTargets(user)) {
      void this.emailService.sendSecurityAlertEmail(recipient, {
        name: user.name,
        event: 'Two-step verification was turned on',
      });
    }

    return { status: 'ok' as const, twoFactorEnabled: true };
  }

  /** Turns 2FA off after re-auth. */
  async disableTwoFactor(userId: string, dto: ConfirmPasswordDto) {
    const user = await this.requireUser(userId);
    await this.assertPassword(user, dto.password);

    if (!user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-step verification is already turned off.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    });

    for (const recipient of securityNotifyTargets(user)) {
      void this.emailService.sendSecurityAlertEmail(recipient, {
        name: user.name,
        event: 'Two-step verification was turned off',
      });
    }

    return { status: 'ok' as const, twoFactorEnabled: false };
  }
}
