import { Test, TestingModule } from '@nestjs/testing';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
  getTestMessageUrl: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodemailer = require('nodemailer');

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

  describe('transport TLS mode (nodemailer fallback path)', () => {
    // Regression coverage: port 465 is implicit TLS and the socket must be
    // TLS from the first byte, unlike 587/25 which start plaintext and
    // upgrade via STARTTLS. nodemailer does not infer this from the port
    // when host/port are passed explicitly -- getting `secure` wrong here
    // doesn't throw, it just hangs until connectionTimeout, which is
    // exactly what happened against Resend's smtp.resend.com:465 in
    // production before this was fixed. This path only runs when no
    // Resend API key is configured (see the "transport selection" tests
    // below for that switch), so this suite clears both env vars that
    // would otherwise route EmailService to the Resend HTTP transport.
    const originalHost = process.env.SMTP_HOST;
    const originalPort = process.env.SMTP_PORT;
    const originalUser = process.env.SMTP_USER;
    const originalSmtpPass = process.env.SMTP_PASS;
    const originalResendKey = process.env.RESEND_API_KEY;

    afterEach(() => {
      if (originalHost === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = originalHost;
      if (originalPort === undefined) delete process.env.SMTP_PORT;
      else process.env.SMTP_PORT = originalPort;
      if (originalUser === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = originalUser;
      if (originalSmtpPass === undefined) delete process.env.SMTP_PASS;
      else process.env.SMTP_PASS = originalSmtpPass;
      if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = originalResendKey;
    });

    const buildWithPort = async (port: string) => {
      delete process.env.SMTP_PASS;
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = port;
      nodemailer.createTransport.mockClear();
      nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn() });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: PrismaService, useValue: {} },
          {
            provide: BrandingService,
            useValue: { brandingSnapshot: jest.fn(), emailShell: jest.fn() },
          },
        ],
      }).compile();
      module.get<EmailService>(EmailService);

      const options = nodemailer.createTransport.mock.calls[0][0] as {
        secure?: boolean;
      };
      return options;
    };

    it('uses implicit TLS (secure: true) for port 465', async () => {
      const options = await buildWithPort('465');
      expect(options.secure).toBe(true);
    });

    it('uses STARTTLS (secure: false) for port 587', async () => {
      const options = await buildWithPort('587');
      expect(options.secure).toBe(false);
    });

    it('stays on SMTP when only SMTP_PASS is set, since that is the SMTP provider password (e.g. a Gmail App Password) and not a Resend API key', async () => {
      nodemailer.createTransport.mockClear();
      nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn() });
      delete process.env.RESEND_API_KEY;
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'sender@gmail.com';
      process.env.SMTP_PASS = 'gmail-app-password';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: PrismaService, useValue: {} },
          {
            provide: BrandingService,
            useValue: { brandingSnapshot: jest.fn(), emailShell: jest.fn() },
          },
        ],
      }).compile();
      module.get<EmailService>(EmailService);

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
      const options = nodemailer.createTransport.mock.calls[0][0];
      expect(options.host).toBe('smtp.gmail.com');
      expect(options.auth.pass).toBe('gmail-app-password');
    });
  });

  describe('Resend HTTP transport', () => {
    // When RESEND_API_KEY is set, mail goes over Resend's HTTPS REST API
    // rather than SMTP. Beyond avoiding SMTP entirely, this surfaces
    // Resend's actual error responses (e.g. a 403 explaining that an
    // unverified sending domain restricts delivery to the account owner's
    // own address) instead of the opaque connection timeouts the SMTP
    // relay produced for the same condition.
    const originalEnv = { ...process.env };
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      global.fetch = originalFetch;
    });

    const buildWithResendKey = async (apiKey: string) => {
      // Explicit deletes (rather than relying on describe-level cleanup
      // ordering from other suites in this file) so this suite is correct
      // regardless of what ran before it.
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_PASS;
      delete process.env.RESEND_API_KEY;
      process.env.RESEND_API_KEY = apiKey;

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
      return module.get<EmailService>(EmailService);
    };

    it('sends via Resend REST API (not nodemailer/SMTP) when RESEND_API_KEY is set', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend-message-id' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      // The file's outer `beforeEach` (top of this file) constructs its own
      // throwaway EmailService before every test, including this one, which
      // may itself call nodemailer.createTransport depending on ambient env
      // at that moment -- irrelevant to what THIS test is asserting. Clear
      // the mock's call history right before building the instance under
      // test so only calls made during this test's own construction count.
      const createTransportSpy = jest.spyOn(
        require('nodemailer'),
        'createTransport',
      );
      createTransportSpy.mockClear();

      const service = await buildWithResendKey('re_test_key');
      const info = await service.sendOtpEmail(null, {
        email: 'user@example.com',
        code: '123456',
        expiresInMinutes: 10,
      });

      expect(createTransportSpy).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, requestInit] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      expect(requestInit.method).toBe('POST');
      expect(requestInit.headers.Authorization).toBe('Bearer re_test_key');
      const body = JSON.parse(requestInit.body);
      expect(body.to).toBe('user@example.com');
      expect(body.html).toContain('123456');
      expect(info.messageId).toBe('resend-message-id');
      // Not a nodemailer send, so there is no Ethereal preview link.
      expect(info.previewUrl).toBe(false);
      createTransportSpy.mockRestore();
    });

    it('throws with the Resend API error body when the request is rejected', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => '{"message":"invalid `to` field"}',
      }) as unknown as typeof fetch;

      const service = await buildWithResendKey('re_test_key');

      await expect(
        service.sendOtpEmail(null, {
          email: 'user@example.com',
          code: '123456',
          expiresInMinutes: 10,
        }),
      ).rejects.toThrow(/422/);
    });
  });
});
