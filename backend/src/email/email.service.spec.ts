import { Test, TestingModule } from '@nestjs/testing';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PrismaService, useValue: {} },
        {
          provide: BrandingService,
          useValue: {
            brandingSnapshot: jest.fn(),
            emailShell: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  interface CapturedMailOptions {
    from: string;
    replyTo?: string;
    to: string;
    subject: string;
  }

  describe('sender construction (Resend/SMTP-provider compatibility)', () => {
    // Reused across cases: swap in a mock transporter so no real network
    // call happens, and capture what sendMail was called with.
    const mockTransport = (svc: EmailService) => {
      const sendMail = jest
        .fn<Promise<{ messageId: string }>, [CapturedMailOptions]>()
        .mockResolvedValue({ messageId: 'test-id' });
      (
        svc as unknown as { transporter: { sendMail: typeof sendMail } }
      ).transporter = {
        sendMail,
      };
      return sendMail;
    };

    const originalEmailFrom = process.env.EMAIL_FROM;

    afterEach(() => {
      if (originalEmailFrom === undefined) {
        delete process.env.EMAIL_FROM;
      } else {
        process.env.EMAIL_FROM = originalEmailFrom;
      }
    });

    it('sends the signup OTP from the configured EMAIL_FROM address, not the tenant support email', async () => {
      process.env.EMAIL_FROM = 'verified-sender@resend-domain.com';

      // EMAIL_FROM is read once at construction time (mirrors how
      // SMTP_HOST/PORT/USER/PASS are already read in the constructor), so
      // build a fresh instance after setting the env var.
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: PrismaService, useValue: {} },
          {
            provide: BrandingService,
            useValue: {
              brandingSnapshot: jest.fn().mockResolvedValue({
                company_name: 'Acme Security',
                support_email: 'support@acme-tenant-domain.com',
                support_phone: null,
                primary_color: '#4f46e5',
                accent_color: '#4f46e5',
                logo_url: null,
              }),
              emailShell: jest.fn().mockReturnValue('<html></html>'),
            },
          },
        ],
      }).compile();
      const freshService = module.get<EmailService>(EmailService);
      const sendMail = mockTransport(freshService);

      await freshService.sendOtpEmail('tenant-1', {
        email: 'user@example.com',
        name: 'User',
        code: '123456',
        expiresInMinutes: 10,
      });

      expect(sendMail).toHaveBeenCalledTimes(1);
      const call = sendMail.mock.calls[0][0];
      expect(call.from).toBe(
        '"Acme Security" <verified-sender@resend-domain.com>',
      );
      // The tenant's own (unverified) support email must never become the
      // SMTP envelope sender — only the Reply-To, so replies still reach it.
      expect(call.from).not.toContain('support@acme-tenant-domain.com');
      expect(call.replyTo).toBe('support@acme-tenant-domain.com');
    });

    it('omits replyTo when the tenant has no support email configured', async () => {
      process.env.EMAIL_FROM = 'verified-sender@resend-domain.com';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: PrismaService, useValue: {} },
          {
            provide: BrandingService,
            useValue: {
              brandingSnapshot: jest.fn().mockResolvedValue({
                company_name: 'Acme Security',
                support_email: null,
                support_phone: null,
                primary_color: '#4f46e5',
                accent_color: '#4f46e5',
                logo_url: null,
              }),
              emailShell: jest.fn().mockReturnValue('<html></html>'),
            },
          },
        ],
      }).compile();
      const freshService = module.get<EmailService>(EmailService);
      const sendMail = mockTransport(freshService);

      await freshService.sendOtpEmail('tenant-1', {
        email: 'user@example.com',
        code: '123456',
        expiresInMinutes: 10,
      });

      const call = sendMail.mock.calls[0][0];
      expect(call.replyTo).toBeUndefined();
    });

    it('falls back to the Ethereal-safe placeholder sender when EMAIL_FROM is not configured', async () => {
      delete process.env.EMAIL_FROM;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: PrismaService, useValue: {} },
          {
            provide: BrandingService,
            useValue: {
              brandingSnapshot: jest.fn(),
              emailShell: jest.fn(),
            },
          },
        ],
      }).compile();
      const freshService = module.get<EmailService>(EmailService);
      const sendMail = mockTransport(freshService);

      await freshService.sendOtpEmail(null, {
        email: 'user@example.com',
        code: '123456',
        expiresInMinutes: 10,
      });

      const call = sendMail.mock.calls[0][0];
      expect(call.from).toBe('"AegisLead" <no-reply@aisaascrm.com>');
    });
  });
});
