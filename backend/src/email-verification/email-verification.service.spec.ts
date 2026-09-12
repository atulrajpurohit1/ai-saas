import { BadRequestException, HttpException } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service';
import { EmailValidationService } from './email-validation.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let prisma: {
    emailOtp: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };
  let emailService: {
    sendOtpEmail: jest.Mock;
    sendPasswordResetOtpEmail: jest.Mock;
  };
  let emailValidation: { validate: jest.Mock };

  beforeEach(() => {
    prisma = {
      emailOtp: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    emailService = {
      sendOtpEmail: jest.fn().mockResolvedValue({}),
      sendPasswordResetOtpEmail: jest.fn().mockResolvedValue({}),
    };
    emailValidation = { validate: jest.fn() };

    service = new EmailVerificationService(
      prisma as any,
      emailService as any,
      emailValidation as any,
    );
  });

  describe('assertValidEmail', () => {
    it('returns the normalized email when valid', async () => {
      emailValidation.validate.mockResolvedValue({
        valid: true,
        normalizedEmail: 'user@example.com',
      });
      await expect(service.assertValidEmail('User@Example.com')).resolves.toBe(
        'user@example.com',
      );
    });

    it('throws a generic BadRequestException when invalid, without leaking the reason', async () => {
      emailValidation.validate.mockResolvedValue({
        valid: false,
        normalizedEmail: 'bad',
        reason: 'DISPOSABLE',
      });

      await expect(service.assertValidEmail('bad')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.assertValidEmail('bad')).rejects.toThrow(
        'Please enter a valid email address.',
      );
    });
  });

  describe('issueOtp', () => {
    it('creates a fresh OTP and emails it when no prior OTP exists', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue(null);
      prisma.emailOtp.upsert.mockResolvedValue({});

      await service.issueOtp({
        accountType: 'USER',
        accountId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        name: 'User',
      });

      expect(prisma.emailOtp.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = prisma.emailOtp.upsert.mock.calls[0][0];
      expect(upsertArgs.create.codeHash).toHaveLength(64); // sha256 hex
      expect(upsertArgs.create.attempts).toBe(0);

      expect(emailService.sendOtpEmail).toHaveBeenCalledTimes(1);
      const [, otpParams] = emailService.sendOtpEmail.mock.calls[0];
      expect(otpParams.code).toMatch(/^\d{6}$/);
    });

    it('enforces the resend cooldown', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        lastSentAt: new Date(),
        sendCount: 1,
      });

      await expect(
        service.issueOtp({
          accountType: 'USER',
          accountId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
        }),
      ).rejects.toThrow(HttpException);
      expect(prisma.emailOtp.upsert).not.toHaveBeenCalled();
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('allows a resend once the cooldown has elapsed', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        lastSentAt: new Date(Date.now() - 61_000),
        sendCount: 1,
      });
      prisma.emailOtp.upsert.mockResolvedValue({});

      await expect(
        service.issueOtp({
          accountType: 'USER',
          accountId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
        }),
      ).resolves.toBeDefined();
      expect(prisma.emailOtp.upsert).toHaveBeenCalledTimes(1);
    });

    it('blocks issuing after the total-send cap regardless of cooldown', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        lastSentAt: new Date(Date.now() - 61_000),
        sendCount: 10,
      });

      await expect(
        service.issueOtp({
          accountType: 'USER',
          accountId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
        }),
      ).rejects.toThrow(HttpException);
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('converts an email-delivery failure into a generic BadRequestException instead of letting it surface as a 500', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue(null);
      prisma.emailOtp.upsert.mockResolvedValue({});
      emailService.sendOtpEmail.mockRejectedValue(
        new Error(
          '550 The example.com domain is not verified. Please, add and verify your domain on https://resend.com/domains',
        ),
      );

      await expect(
        service.issueOtp({
          accountType: 'USER',
          accountId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.issueOtp({
          accountType: 'USER',
          accountId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
        }),
      ).rejects.toThrow('Please enter a valid email address.');
    });

    it('routes PASSWORD_RESET-purpose OTPs through sendPasswordResetOtpEmail, not sendOtpEmail', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue(null);
      prisma.emailOtp.upsert.mockResolvedValue({});

      await service.issueOtp({
        accountType: 'USER',
        accountId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        purpose: 'PASSWORD_RESET',
      });

      expect(emailService.sendPasswordResetOtpEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    const hashOf = (code: string) =>
      require('crypto').createHash('sha256').update(code).digest('hex');

    it('rejects when no OTP record exists', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyOtp({
          accountType: 'USER',
          accountId: 'user-1',
          code: '123456',
        }),
      ).rejects.toThrow(
        'Invalid verification code. Please request a new code.',
      );
    });

    it('rejects an already-consumed OTP (single-use)', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        id: 'otp-1',
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: hashOf('123456'),
      });

      await expect(
        service.verifyOtp({
          accountType: 'USER',
          accountId: 'user-1',
          code: '123456',
        }),
      ).rejects.toThrow(
        'Invalid verification code. Please request a new code.',
      );
    });

    it('rejects an expired OTP', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        id: 'otp-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: hashOf('123456'),
      });

      await expect(
        service.verifyOtp({
          accountType: 'USER',
          accountId: 'user-1',
          code: '123456',
        }),
      ).rejects.toThrow(
        'This verification code has expired. Please request a new code.',
      );
    });

    it('rejects when attempts are exhausted', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        id: 'otp-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 5,
        maxAttempts: 5,
        codeHash: hashOf('123456'),
      });

      await expect(
        service.verifyOtp({
          accountType: 'USER',
          accountId: 'user-1',
          code: '123456',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('rejects a wrong code and increments attempts', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        id: 'otp-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: hashOf('123456'),
      });
      prisma.emailOtp.update.mockResolvedValue({});

      await expect(
        service.verifyOtp({
          accountType: 'USER',
          accountId: 'user-1',
          code: '999999',
        }),
      ).rejects.toThrow('Invalid verification code.');

      expect(prisma.emailOtp.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('accepts the correct code and marks it consumed', async () => {
      prisma.emailOtp.findUnique.mockResolvedValue({
        id: 'otp-1',
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
        codeHash: hashOf('123456'),
      });
      prisma.emailOtp.update.mockResolvedValue({});

      await expect(
        service.verifyOtp({
          accountType: 'USER',
          accountId: 'user-1',
          code: '123456',
        }),
      ).resolves.toBe(true);

      expect(prisma.emailOtp.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { consumedAt: expect.any(Date) },
      });
    });
  });
});
