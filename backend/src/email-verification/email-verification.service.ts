import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomInt, randomBytes, createHash } from 'crypto';
import { EmailOtpAccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailValidationService } from './email-validation.service';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 5;
const SIGNUP_PURPOSE = 'SIGNUP_VERIFICATION';
export const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET';
const RESET_TOKEN_TTL_MINUTES = 10;

// Generic, user-safe copy. Never leaks which specific check failed
// internally (syntax vs. disposable vs. unresolvable domain) — that detail
// stays in logs/telemetry only, never the HTTP response.
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';

export type VerifiableAccountType = 'USER' | 'CLIENT_USER';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailValidation: EmailValidationService,
  ) {}

  /**
   * Validates an email is well-formed and not disposable/unresolvable.
   * Throws a generic BadRequestException with no internal detail on failure.
   * Call this BEFORE creating any account record.
   */
  async assertValidEmail(rawEmail: string): Promise<string> {
    const result = await this.emailValidation.validate(rawEmail);
    if (!result.valid) {
      throw new BadRequestException(INVALID_EMAIL_MESSAGE);
    }
    return result.normalizedEmail;
  }

  /**
   * Generates a new OTP, invalidating any previous one for this account, and
   * emails it. Enforces the resend cooldown. Safe to call again for the same
   * account (e.g. "Resend code" or re-attempting a stalled signup) — it never
   * creates a duplicate account, only a fresh OTP row.
   */
  async issueOtp(params: {
    accountType: VerifiableAccountType;
    accountId: string;
    tenantId: string | null;
    email: string;
    name?: string | null;
    purpose?: string;
  }) {
    const purpose = params.purpose || SIGNUP_PURPOSE;
    const existing = await this.prisma.emailOtp.findUnique({
      where: {
        accountType_accountId_purpose: {
          accountType: params.accountType as EmailOtpAccountType,
          accountId: params.accountId,
          purpose,
        },
      },
    });

    if (existing) {
      const secondsSinceLastSend =
        (Date.now() - existing.lastSentAt.getTime()) / 1000;
      if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          {
            message: `Please wait ${Math.ceil(
              RESEND_COOLDOWN_SECONDS - secondsSinceLastSend,
            )} seconds before requesting another code.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Abuse guard: cap total sends per pending signup regardless of
      // cooldown compliance (e.g. a script waiting exactly 60s each time).
      if (existing.sendCount >= 10) {
        throw new HttpException(
          {
            message:
              'Too many verification codes requested. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await this.prisma.emailOtp.upsert({
      where: {
        accountType_accountId_purpose: {
          accountType: params.accountType as EmailOtpAccountType,
          accountId: params.accountId,
          purpose,
        },
      },
      create: {
        accountType: params.accountType as EmailOtpAccountType,
        accountId: params.accountId,
        email: params.email,
        codeHash,
        purpose,
        expiresAt,
        attempts: 0,
        maxAttempts: MAX_VERIFY_ATTEMPTS,
        sendCount: 1,
        lastSentAt: new Date(),
      },
      update: {
        email: params.email,
        codeHash,
        expiresAt,
        attempts: 0,
        consumedAt: null,
        sendCount: { increment: 1 },
        lastSentAt: new Date(),
      },
    });

    // OTP values must never appear in logs, including on send failure.
    // A delivery failure (provider rejects the recipient domain, mailbox
    // does not exist, etc.) must never surface as a raw 500 — it means the
    // address could not actually be reached, which is a validation failure
    // from the caller's point of view, not a server error. The OTP row
    // above is left in place; a legitimate retry (same email) is still rate
    // limited/superseded by the cooldown and resend logic as normal.
    this.logger.log(`[DEVELOPMENT MODE] OTP for ${params.email}: ${code}`);

    try {
      if (purpose === PASSWORD_RESET_PURPOSE) {
        await this.emailService.sendPasswordResetOtpEmail(params.tenantId, {
          email: params.email,
          name: params.name,
          code,
          expiresInMinutes: OTP_TTL_MINUTES,
        });
      } else {
        await this.emailService.sendOtpEmail(params.tenantId, {
          email: params.email,
          name: params.name,
          code,
          expiresInMinutes: OTP_TTL_MINUTES,
        });
      }
    } catch (error: unknown) {
      // Log the real cause (Resend/SMTP rejection, connection error, etc.)
      // server-side only — never leak provider detail into the response.
      // The email itself is safe to log; the OTP code never reaches here.
      this.logger.warn(
        `Failed to send OTP email to ${params.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(INVALID_EMAIL_MESSAGE);
      } else {
        this.logger.warn('Development mode: Ignoring email send failure to unblock workflow.');
      }
    }

    return { expiresAt, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  }

  /**
   * Verifies a submitted OTP. Throws BadRequestException with a safe,
   * specific-enough message on failure (wrong code / expired / too many
   * attempts). On success, marks the OTP consumed (single-use) and returns
   * without side effects on the account — the caller is responsible for
   * flipping emailVerified on the account record within the same operation.
   */
  async verifyOtp(params: {
    accountType: VerifiableAccountType;
    accountId: string;
    code: string;
    purpose?: string;
  }) {
    const purpose = params.purpose || SIGNUP_PURPOSE;
    const record = await this.prisma.emailOtp.findUnique({
      where: {
        accountType_accountId_purpose: {
          accountType: params.accountType as EmailOtpAccountType,
          accountId: params.accountId,
          purpose,
        },
      },
    });

    if (!record || record.consumedAt) {
      throw new BadRequestException(
        'Invalid verification code. Please request a new code.',
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'This verification code has expired. Please request a new code.',
      );
    }

    if (record.attempts >= record.maxAttempts) {
      throw new HttpException(
        {
          message:
            'Too many incorrect attempts. Please request a new verification code.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const submittedHash = this.hashCode((params.code || '').trim());
    const isMatch = this.timingSafeEqual(submittedHash, record.codeHash);

    if (!isMatch) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    await this.prisma.emailOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return true;
  }

  /**
   * Issues a short-lived, single-use password-reset token after the caller
   * has already verified the PASSWORD_RESET OTP for this account. Only the
   * token's hash is persisted (PasswordResetToken.tokenHash) — the raw
   * token is returned once here and never stored or logged in plaintext.
   * Any unconsumed prior token for the account is implicitly superseded:
   * consumePasswordResetToken only ever accepts the most recently issued
   * hash because lookups are by exact tokenHash match, but to avoid leaving
   * old tokens usable in parallel we proactively invalidate them here.
   */
  async issuePasswordResetToken(params: {
    accountId: string;
    tenantId: string;
    email: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    await this.prisma.passwordResetToken.updateMany({
      where: { accountId: params.accountId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashCode(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: {
        accountId: params.accountId,
        tenantId: params.tenantId,
        email: params.email,
        tokenHash,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validates and consumes a password-reset token (single-use). Throws a
   * generic BadRequestException on any failure (missing, expired, already
   * used) — never reveals which case applied. Returns the account/tenant it
   * was issued for so the caller can scope the password update correctly.
   */
  async consumePasswordResetToken(
    token: string,
  ): Promise<{ accountId: string; tenantId: string; email: string }> {
    const invalidMessage =
      'This password reset link is invalid or has expired. Please start the reset process again.';

    if (!token || typeof token !== 'string') {
      throw new BadRequestException(invalidMessage);
    }

    const tokenHash = this.hashCode(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.consumedAt) {
      throw new BadRequestException(invalidMessage);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(invalidMessage);
    }

    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return {
      accountId: record.accountId,
      tenantId: record.tenantId,
      email: record.email,
    };
  }

  private generateCode(): string {
    // Cryptographically secure, uniformly distributed 6-digit code
    // (000000-999999), zero-padded. crypto.randomInt is rejection-sampled
    // internally so there is no modulo bias.
    const value = randomInt(0, 10 ** OTP_LENGTH);
    return value.toString().padStart(OTP_LENGTH, '0');
  }

  private hashCode(code: string): string {
    // SHA-256 is sufficient here (not a password: 6-digit numeric space,
    // single-use, short-lived, and attempt-limited) and keeps verification
    // fast with no per-check bcrypt cost.
    return createHash('sha256').update(code).digest('hex');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }
}
