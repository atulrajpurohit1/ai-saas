import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import {
  EmailVerificationService,
  RECOVERY_EMAIL_PURPOSE,
  TWO_FACTOR_SETUP_PURPOSE,
} from '../email-verification/email-verification.service';
import { AccountSecurityService } from './account-security.service';

// bcrypt's native exports are non-configurable; auto-mock and set compare.
jest.mock('bcrypt');

describe('AccountSecurityService', () => {
  let service: AccountSecurityService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let emailService: { sendSecurityAlertEmail: jest.Mock };
  let emailVerification: {
    assertValidEmail: jest.Mock;
    issueOtp: jest.Mock;
    verifyOtp: jest.Mock;
    getPendingOtpEmail: jest.Mock;
  };

  const baseUser = {
    id: 'user-1',
    email: 'owner@example.com',
    name: 'Owner',
    password: 'hash',
    tenantId: 'tenant-1',
    twoFactorEnabled: false,
    recoveryEmail: null,
    recoveryEmailVerified: false,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(baseUser),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    emailService = {
      sendSecurityAlertEmail: jest.fn().mockResolvedValue({ sent: true }),
    };
    emailVerification = {
      assertValidEmail: jest.fn((e: string) =>
        Promise.resolve(e.toLowerCase()),
      ),
      issueOtp: jest.fn().mockResolvedValue(undefined),
      verifyOtp: jest.fn().mockResolvedValue(true),
      getPendingOtpEmail: jest.fn().mockResolvedValue('backup@example.com'),
    };

    service = new AccountSecurityService(
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
      emailVerification as unknown as EmailVerificationService,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  it('rejects a wrong password before issuing a recovery-email code', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.startRecoveryEmail('user-1', {
        password: 'nope',
        email: 'backup@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(emailVerification.issueOtp).not.toHaveBeenCalled();
  });

  it('refuses a recovery email equal to the main email', async () => {
    await expect(
      service.startRecoveryEmail('user-1', {
        password: 'ok',
        email: 'owner@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('emails a code to the new recovery address on start', async () => {
    const res = await service.startRecoveryEmail('user-1', {
      password: 'ok',
      email: 'backup@example.com',
    });

    expect(emailVerification.issueOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: RECOVERY_EMAIL_PURPOSE,
        email: 'backup@example.com',
      }),
    );
    expect(res.status).toBe('otp_sent');
  });

  it('saves the verified recovery address and alerts', async () => {
    const res = await service.verifyRecoveryEmail('user-1', { code: '123456' });

    expect(emailVerification.verifyOtp).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: RECOVERY_EMAIL_PURPOSE }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          recoveryEmail: 'backup@example.com',
          recoveryEmailVerified: true,
        },
      }),
    );
    expect(emailService.sendSecurityAlertEmail).toHaveBeenCalled();
    expect(res.status).toBe('ok');
  });

  it('fails verify when no recovery change is in progress', async () => {
    emailVerification.getPendingOtpEmail.mockResolvedValue(null);

    await expect(
      service.verifyRecoveryEmail('user-1', { code: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(emailVerification.verifyOtp).not.toHaveBeenCalled();
  });

  it('turns 2FA on only after the setup code is verified', async () => {
    await service.startEnableTwoFactor('user-1', { password: 'ok' });
    expect(emailVerification.issueOtp).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: TWO_FACTOR_SETUP_PURPOSE }),
    );

    const res = await service.verifyEnableTwoFactor('user-1', {
      code: '123456',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { twoFactorEnabled: true } }),
    );
    expect(res.twoFactorEnabled).toBe(true);
  });

  it('will not re-enable 2FA that is already on', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      twoFactorEnabled: true,
    });

    await expect(
      service.startEnableTwoFactor('user-1', { password: 'ok' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
