import { InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for third-party credentials held at rest.
 *
 * The wire format (iv.tag.ciphertext, each base64url) is identical to the one
 * CrmConnectorsService uses inline, so the two are interchangeable given the
 * same key material. This exists as a shared helper because the telephony
 * connectors needed the same thing; CrmConnectorsService still carries its own
 * copy and is deliberately left alone -- rewriting it would re-encrypt nothing
 * and risk every live CRM connection for a cosmetic win.
 */

export function encryptSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSecret(value: string, secret: string): string {
  const [ivText, tagText, encryptedText] = value.split('.');
  if (!ivText || !tagText || !encryptedText) {
    throw new InternalServerErrorException('Stored credential is malformed.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function deriveKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

/**
 * Key material for encrypting stored telephony credentials.
 *
 * There is deliberately no default. A hardcoded fallback in this repository --
 * which is public -- would mean every deployment that forgot the variable
 * encrypted its tenants' RingCentral JWTs under a key anyone could derive, and
 * would do it silently. A RingCentral JWT does not expire, so a database dump
 * under a guessable key is a standing takeover of the customer's phone system.
 *
 * Falls back to CRM_TOKEN_SECRET only because that variable is already
 * mandatory wherever connectors are in use and shares the same threat model.
 */
export function telephonySecret(): string {
  const configured =
    process.env.TELEPHONY_TOKEN_SECRET?.trim() ||
    process.env.CRM_TOKEN_SECRET?.trim();

  if (!configured) {
    throw new InternalServerErrorException(
      'Telephony credential encryption is not configured. ' +
        'Set TELEPHONY_TOKEN_SECRET.',
    );
  }

  return configured;
}
