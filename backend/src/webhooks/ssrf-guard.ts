import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * Outbound webhook delivery POSTs to a URL the tenant supplies, from inside
 * our network. Without a check, a tenant admin can point a webhook at
 * 169.254.169.254 (cloud instance metadata), at 127.0.0.1, or at any RFC1918
 * address, and use the recorded delivery status as an oracle for what is
 * listening on our private network -- server-side request forgery.
 *
 * `@IsUrl({ protocols: ['http', 'https'] })` does not help: those URLs are
 * perfectly well-formed. What matters is the ADDRESS the hostname resolves to.
 */

/** Hostnames that are never legitimate webhook destinations. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

/**
 * Returns true for addresses that must never be reachable from a
 * tenant-controlled URL: loopback, private, link-local (which includes the
 * cloud metadata address), carrier-grade NAT, and unspecified/reserved space.
 */
export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;

    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
    if (a >= 224) return true; // multicast, reserved, broadcast
    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;

    // IPv4-mapped (::ffff:a.b.c.d) must be judged on the embedded IPv4
    // address, or every IPv4 rule above is trivially bypassed.
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);

    if (normalized.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(normalized)) return true; // unique local fc00::/7
    if (normalized.startsWith('ff')) return true; // multicast
    return false;
  }

  // Not parseable as an IP at all -- refuse rather than guess.
  return true;
}

/**
 * Throws unless `rawUrl` is an http(s) URL whose host resolves entirely to
 * public addresses.
 *
 * Call this BOTH when the webhook is saved and immediately before each
 * delivery: a hostname that resolved to a public address at save time can be
 * repointed at an internal one later (DNS rebinding), so a save-time-only
 * check is not enough.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Webhook URL is not a valid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Webhook URL must use http or https.');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new BadRequestException(
      'Webhook URL must point to a public address.',
    );
  }

  // A literal IP needs no DNS round trip.
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new BadRequestException(
        'Webhook URL must point to a public address.',
      );
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BadRequestException('Webhook URL host could not be resolved.');
  }

  // EVERY address must be public. A host with one public and one private
  // record would otherwise be a coin flip at connect time.
  if (
    addresses.length === 0 ||
    addresses.some((entry) => isBlockedAddress(entry.address))
  ) {
    throw new BadRequestException(
      'Webhook URL must point to a public address.',
    );
  }

  return url;
}
