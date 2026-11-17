import { InternalServerErrorException } from '@nestjs/common';
import { decryptSecret, encryptSecret, telephonySecret } from './secret-box.util';

const KEY = 'a-test-encryption-secret';

describe('secret box', () => {
  it('round-trips a credential', () => {
    const secret = 'eyJhbGciOi.payload.signature';
    expect(decryptSecret(encryptSecret(secret, KEY), KEY)).toBe(secret);
  });

  it('produces different ciphertext each time for the same input', () => {
    // A fixed IV would let anyone with database access tell which tenants
    // share a credential, and would break GCM's security outright.
    const a = encryptSecret('same-value', KEY);
    const b = encryptSecret('same-value', KEY);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe(decryptSecret(b, KEY));
  });

  it('refuses to decrypt under the wrong key', () => {
    const encrypted = encryptSecret('secret-value', KEY);
    expect(() => decryptSecret(encrypted, 'a-different-secret')).toThrow();
  });

  it('refuses a tampered ciphertext rather than returning garbage', () => {
    // The auth tag is the whole point of GCM here: a database row someone
    // edited must fail loudly, not decrypt to a value we then send to
    // RingCentral as a credential.
    const [iv, tag, payload] = encryptSecret('secret-value', KEY).split('.');
    const flipped = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A');
    expect(() => decryptSecret([iv, tag, flipped].join('.'), KEY)).toThrow();
  });

  it('rejects a malformed stored value', () => {
    expect(() => decryptSecret('not-a-valid-box', KEY)).toThrow(
      InternalServerErrorException,
    );
  });

  describe('telephonySecret', () => {
    const original = { ...process.env };

    afterEach(() => {
      process.env = { ...original };
    });

    it('prefers its own variable', () => {
      process.env.TELEPHONY_TOKEN_SECRET = 'telephony-key';
      process.env.CRM_TOKEN_SECRET = 'crm-key';
      expect(telephonySecret()).toBe('telephony-key');
    });

    it('falls back to the CRM secret', () => {
      delete process.env.TELEPHONY_TOKEN_SECRET;
      process.env.CRM_TOKEN_SECRET = 'crm-key';
      expect(telephonySecret()).toBe('crm-key');
    });

    it('throws rather than defaulting when nothing is configured', () => {
      // This repository is public. A literal fallback here would mean every
      // deployment that forgot the variable encrypted its tenants'
      // non-expiring RingCentral JWTs under a key anyone could derive.
      delete process.env.TELEPHONY_TOKEN_SECRET;
      delete process.env.CRM_TOKEN_SECRET;
      expect(() => telephonySecret()).toThrow(InternalServerErrorException);
    });
  });
});
