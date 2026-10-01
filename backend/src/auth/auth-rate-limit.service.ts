import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateWindow = {
  count: number;
  resetAt: number;
};

/**
 * Fixed-window limiter for unauthenticated auth endpoints, mirroring the
 * pattern already used by ProspectSearchRateLimitService and
 * PublicApiRateLimitService.
 *
 * Before this existed, /auth/login, /auth/register, /auth/forgot-password and
 * the OTP endpoints had no throttling of any kind: password guessing and OTP
 * guessing were bounded only by network speed. The per-account OTP attempt
 * counter (EmailVerificationService.MAX_VERIFY_ATTEMPTS) caps guesses against
 * one account, but nothing capped an attacker spreading attempts across many
 * accounts from one host.
 *
 * Limits are deliberately generous enough not to affect a real person who
 * mistypes a password several times, and are applied on two independent keys
 * (source IP, and the submitted email) so that neither a single host nor a
 * single targeted account can be hammered.
 *
 * Per-process only -- a multi-instance deployment needs a shared store
 * (e.g. Redis) for this to hold globally. See LIMITATIONS in the security
 * notes; this is a meaningful improvement over no limit at all, not a
 * complete defence on its own.
 */
@Injectable()
export class AuthRateLimitService {
  private readonly windows = new Map<string, RateWindow>();
  private readonly multiplier: number;

  constructor(private readonly configService: ConfigService) {
    // Escape hatch for load testing / unusual deployments. Values <= 0 or
    // non-numeric fall back to 1 (i.e. the documented limits apply as-is).
    const configured = Number(
      this.configService.get<string>('AUTH_RATE_LIMIT_MULTIPLIER'),
    );
    this.multiplier =
      Number.isFinite(configured) && configured > 0 ? configured : 1;
  }

  /**
   * Counts one attempt against `key`. Throws 429 once `limit` attempts have
   * been made inside the current `windowSeconds` window.
   */
  consume(key: string, limit: number, windowSeconds: number): void {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const bucket = Math.floor(now / windowMs);
    const windowKey = `${key}:${bucket}`;
    const effectiveLimit = Math.ceil(limit * this.multiplier);
    const existing = this.windows.get(windowKey);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(windowKey, {
        count: 1,
        resetAt: (bucket + 1) * windowMs,
      });
      this.cleanup(now);
      return;
    }

    existing.count += 1;
    if (existing.count > effectiveLimit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      );
      throw new HttpException(
        {
          message: `Too many attempts. Please try again in ${retryAfter} seconds.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private cleanup(now: number) {
    if (this.windows.size < 5000) return;

    for (const [key, window] of this.windows.entries()) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}
