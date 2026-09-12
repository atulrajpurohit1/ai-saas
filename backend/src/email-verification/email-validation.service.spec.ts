jest.mock('dns', () => {
  const resolverInstance = {
    setServers: jest.fn(),
    resolveMx: jest.fn(),
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  };
  return {
    promises: {
      resolveMx: jest.fn(),
      resolve: jest.fn(),
      resolve6: jest.fn(),
    },
    Resolver: jest.fn(() => resolverInstance),
    __mockResolverInstance: resolverInstance,
  };
});

import { promises as dns } from 'dns';
import { EmailValidationService } from './email-validation.service';

const mockedDns = dns as jest.Mocked<typeof dns>;
// The mocked fallback `Resolver` instance (callback-based API), shared by
// every `new Resolver()` call since the factory above always returns the
// same object — mirrors how the real fallback path is only ever invoked
// once per `hasMailExchanger` call.
const mockedResolver = jest.requireMock('dns').__mockResolverInstance as {
  setServers: jest.Mock;
  resolveMx: jest.Mock;
  resolve4: jest.Mock;
  resolve6: jest.Mock;
};

/** Wires a callback-style mock (`(domain, cb) => cb(err, records)`). */
const mockCallback = (
  fn: jest.Mock,
  result: { error?: NodeJS.ErrnoException; records?: unknown[] },
) => {
  fn.mockImplementation(
    (_domain: string, cb: (err: any, records: any) => void) => {
      cb(result.error ?? null, result.records ?? []);
    },
  );
};

describe('EmailValidationService', () => {
  let service: EmailValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailValidationService();
  });

  describe('normalize', () => {
    it('trims and lowercases', () => {
      expect(service.normalize('  Foo.Bar@Example.COM  ')).toBe(
        'foo.bar@example.com',
      );
    });
  });

  describe('validate — syntax', () => {
    it('rejects missing email', async () => {
      const result = await service.validate('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SYNTAX');
    });

    it('rejects a clearly malformed email', async () => {
      const result = await service.validate('not-an-email');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SYNTAX');
    });

    it('rejects an email with no TLD', async () => {
      const result = await service.validate('user@localhost');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SYNTAX');
    });

    it('rejects an overly long address', async () => {
      const local = 'a'.repeat(250);
      const result = await service.validate(`${local}@example.com`);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SYNTAX');
    });
  });

  describe('validate — disposable domains', () => {
    it('rejects a known disposable domain', async () => {
      const result = await service.validate('someone@mailinator.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('DISPOSABLE');
    });
  });

  describe('validate — domain resolvability', () => {
    it('rejects a domain the resolver definitively reports as nonexistent (ENOTFOUND on MX, A and AAAA)', async () => {
      const notFound = Object.assign(new Error('not found'), {
        code: 'ENOTFOUND',
      });
      mockedDns.resolveMx.mockRejectedValue(notFound);
      mockedDns.resolve.mockRejectedValue(notFound);
      mockedDns.resolve6.mockRejectedValue(notFound);

      const result = await service.validate(
        'user@this-domain-should-not-exist-aegislead-test.invalid',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NO_MX_RECORD');
      // A definitive ENOTFOUND never needs the fallback resolver.
      expect(mockedResolver.resolveMx).not.toHaveBeenCalled();
    });

    it('accepts a domain with a valid MX record', async () => {
      mockedDns.resolveMx.mockResolvedValue([
        { exchange: 'mx.example.com', priority: 10 },
      ] as any);

      const result = await service.validate('someone@gmail.com');
      expect(result.valid).toBe(true);
      expect(result.normalizedEmail).toBe('someone@gmail.com');
    });

    it('falls back to an A record when there is no MX record', async () => {
      const noData = Object.assign(new Error('no data'), { code: 'ENODATA' });
      mockedDns.resolveMx.mockRejectedValue(noData);
      mockedDns.resolve.mockResolvedValue(['1.2.3.4'] as any);

      const result = await service.validate('someone@example.com');
      expect(result.valid).toBe(true);
    });

    it('fails open (accepts) when both the default and fallback resolver are inconclusive', async () => {
      const timeout = Object.assign(new Error('timed out'), {
        code: 'ETIMEOUT',
      });
      mockedDns.resolveMx.mockRejectedValue(timeout);
      mockCallback(mockedResolver.resolveMx, { error: timeout });

      const result = await service.validate('someone@example.com');
      expect(result.valid).toBe(true);
    });

    it('retries against a fallback resolver when the default resolver connection is refused, and accepts if the fallback finds an MX record', async () => {
      const connRefused = Object.assign(new Error('refused'), {
        code: 'ECONNREFUSED',
      });
      mockedDns.resolveMx.mockRejectedValue(connRefused);
      mockCallback(mockedResolver.resolveMx, {
        records: [{ exchange: 'mx.example.com', priority: 10 }],
      });

      const result = await service.validate('someone@example.com');
      expect(result.valid).toBe(true);
      expect(mockedResolver.setServers).toHaveBeenCalled();
    });

    it('rejects when both the default and fallback resolver agree the domain does not exist (the fake-domain / Neon-sandbox-DNS case)', async () => {
      const connRefused = Object.assign(new Error('refused'), {
        code: 'ECONNREFUSED',
      });
      mockedDns.resolveMx.mockRejectedValue(connRefused);
      mockedDns.resolve.mockRejectedValue(connRefused);
      // Fallback resolver gets a definitive "no such domain" for both MX
      // and A — this is the case that previously slipped through as
      // fail-open (see aisa7823egascrm.com bug report).
      const notFound = Object.assign(new Error('not found'), {
        code: 'ENOTFOUND',
      });
      mockCallback(mockedResolver.resolveMx, { error: notFound });
      mockCallback(mockedResolver.resolve4, { error: notFound });

      const result = await service.validate(
        'someone@this-should-not-exist.invalid',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NO_MX_RECORD');
    });
  });
});
