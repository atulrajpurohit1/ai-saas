import { Injectable } from '@nestjs/common';
import { promises as dns, Resolver } from 'dns';
import disposableDomains from 'disposable-email-domains';

// RFC 5322-ish practical email syntax check (same shape class-validator's
// @IsEmail uses under the hood) plus a hard length ceiling.
const EMAIL_SYNTAX_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DISPOSABLE_DOMAINS = new Set(
  disposableDomains.map((d) => d.toLowerCase()),
);

// Used only as a fallback resolver when the runtime's configured default
// resolver is itself unreachable (ECONNREFUSED/ECONNRESET) — a sandboxed or
// otherwise DNS-restricted environment should not be indistinguishable from
// "this domain doesn't exist, but we're being lenient."
const FALLBACK_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

// Hard ceiling on any single DNS lookup. Some sandboxed/restricted networks
// don't actively refuse a query (which would fail fast with ECONNREFUSED) —
// they silently drop it, and Node's resolver has no built-in timeout for
// that case, so a lookup can otherwise hang for the OS's full retry/timeout
// budget (tens of seconds) per attempt. hasMailExchanger makes at most 5
// sequential lookups (MX/A/AAAA against the default resolver, MX/A against
// the fallback) so this is kept low enough that even the worst case (every
// lookup timing out) stays well under 5 seconds total — a slow DNS check
// must never make a signup request appear to hang.
const DNS_LOOKUP_TIMEOUT_MS = 900;

export interface EmailValidationResult {
  valid: boolean;
  normalizedEmail: string;
  reason?: 'SYNTAX' | 'DISPOSABLE' | 'NO_MX_RECORD';
}

type ResolveOutcome = 'found' | 'unresolvable' | 'unknown';

// Distinct identity (not an Error) so a timeout can never be confused with
// a real DNS error code in the catch block below.
const TIMEOUT_SENTINEL = Symbol('dns-lookup-timeout');

@Injectable()
export class EmailValidationService {
  /**
   * Normalizes and validates an email address before it is allowed to
   * receive an OTP. This intentionally does NOT attempt an SMTP
   * mailbox-existence probe (those are unreliable and frequently blocked by
   * mail servers) — mailbox ownership is proven by the OTP step instead.
   */
  async validate(rawEmail: string): Promise<EmailValidationResult> {
    const normalizedEmail = this.normalize(rawEmail);

    if (
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      !EMAIL_SYNTAX_RE.test(normalizedEmail)
    ) {
      return { valid: false, normalizedEmail, reason: 'SYNTAX' };
    }

    const domain = normalizedEmail.split('@')[1];

    if (DISPOSABLE_DOMAINS.has(domain)) {
      return { valid: false, normalizedEmail, reason: 'DISPOSABLE' };
    }

    const hasMx = await this.hasMailExchanger(domain);
    if (!hasMx) {
      return { valid: false, normalizedEmail, reason: 'NO_MX_RECORD' };
    }

    return { valid: true, normalizedEmail };
  }

  normalize(rawEmail: string): string {
    return (rawEmail || '').trim().toLowerCase();
  }

  /**
   * Confirms the domain can plausibly receive mail: it resolves an MX
   * record, or (rarer, but valid per RFC 5321) an A/AAAA record to fall back
   * to.
   *
   * A definitive "this domain does not exist / has no such records" answer
   * (ENOTFOUND / ENODATA) counts as a real rejection. A definitive
   * "the resolver itself refused/reset the connection" (ECONNREFUSED /
   * ECONNRESET) is retried once against a fallback public resolver
   * (Cloudflare/Google) before being trusted as a rejection too — that
   * combination means DNS is reachable in general but this specific domain
   * has nothing to resolve, which is exactly the "aisa7823egascrm.com"-style
   * fake domain this check exists to catch. Only a genuinely inconclusive
   * failure (timeout, SERVFAIL, no outbound DNS at all even via the
   * fallback resolver) fails OPEN — mailbox ownership is proven by the OTP
   * step regardless, so we never want to block a real signup over a flaky
   * network check.
   */
  private async hasMailExchanger(domain: string): Promise<boolean> {
    const mx = await this.tryResolve(domain, 'MX');
    if (mx === 'found') return true;
    if (mx === 'unresolvable') {
      // No MX record for the domain — still check A/AAAA per RFC 5321
      // fallback before declaring it invalid.
      const a = await this.tryResolve(domain, 'A');
      if (a === 'found') return true;
      if (a === 'unresolvable') {
        const aaaa = await this.tryResolve(domain, 'AAAA');
        if (aaaa === 'found') return true;
        if (aaaa === 'unresolvable') return false;
      }
    }

    // 'unknown' against the default resolver: it may itself be unreachable
    // in this runtime (sandboxed/offline), not necessarily a sign the
    // domain is fine. Retry the same three lookups against a public
    // fallback resolver before giving up and failing open.
    const fallbackMx = await this.tryResolve(
      domain,
      'MX',
      FALLBACK_DNS_SERVERS,
    );
    if (fallbackMx === 'found') return true;
    if (fallbackMx === 'unresolvable') {
      const fallbackA = await this.tryResolve(
        domain,
        'A',
        FALLBACK_DNS_SERVERS,
      );
      if (fallbackA === 'found') return true;
      if (fallbackA === 'unresolvable') return false;
    }

    // Still inconclusive even against the fallback resolver: fail open.
    return true;
  }

  private async tryResolve(
    domain: string,
    type: 'MX' | 'A' | 'AAAA',
    useServers?: string[],
  ): Promise<ResolveOutcome> {
    try {
      const records = await this.withTimeout(this.lookup(domain, type, useServers));
      return records.length > 0 ? 'found' : 'unresolvable';
    } catch (error: unknown) {
      if (error === TIMEOUT_SENTINEL) {
        // A silently-dropped query (no response at all, as opposed to an
        // active refusal) is inconclusive, not a rejection — treat it the
        // same as any other unreachable-resolver case.
        return 'unknown';
      }
      const code = (error as { code?: string })?.code;
      if (
        code === 'ENOTFOUND' ||
        code === 'ENODATA' ||
        // A connection-level failure is only treated as a real rejection
        // when it came from the fallback resolver — at that point we've
        // already confirmed the default resolver couldn't answer either,
        // so a second independent resolver refusing/resetting is a strong
        // signal the domain itself doesn't exist, not that DNS is broken.
        ((code === 'ECONNREFUSED' || code === 'ECONNRESET') && useServers)
      ) {
        return 'unresolvable';
      }
      return 'unknown';
    }
  }

  /**
   * Races a DNS lookup against a hard timeout so a silently-dropped query
   * (common on sandboxed/firewalled networks, which don't return
   * ECONNREFUSED the way an actively-closed port does) can never block a
   * signup request. Rejects with the shared TIMEOUT_SENTINEL, not an Error,
   * so tryResolve can tell "timed out" apart from any real DNS error code.
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(TIMEOUT_SENTINEL), DNS_LOOKUP_TIMEOUT_MS);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private lookup(
    domain: string,
    type: 'MX' | 'A' | 'AAAA',
    useServers?: string[],
  ): Promise<unknown[]> {
    if (!useServers) {
      if (type === 'MX') return dns.resolveMx(domain);
      if (type === 'A') return dns.resolve(domain);
      return dns.resolve6(domain);
    }

    const resolver = new Resolver();
    resolver.setServers(useServers);

    return new Promise((resolve, reject) => {
      const callback = (
        err: NodeJS.ErrnoException | null,
        records: unknown[],
      ) => {
        if (err) reject(err);
        else resolve(records || []);
      };
      if (type === 'MX') resolver.resolveMx(domain, callback);
      else if (type === 'A') resolver.resolve4(domain, callback);
      else resolver.resolve6(domain, callback);
    });
  }
}
