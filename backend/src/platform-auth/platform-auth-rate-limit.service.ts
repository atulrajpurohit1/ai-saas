import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateWindow = {
  count: number;
  resetAt: number;
};

/**
 * A deliberately separate limiter for the platform login surface.
 *
 * Platform authentication must not depend on tenant AuthModule wiring, but it
 * still needs both sides of a login throttle: one bucket for the source IP to
 * slow password spraying, and one for the submitted email to slow a
 * distributed attack against a single operator. Account lockout in the
 * database remains the durable second layer.
 *
 * This store is per process. The database lockout is what keeps the targeted
 * account protected across multiple instances; the IP bucket primarily
 * protects bcrypt capacity on each instance.
 */
@Injectable()
export class PlatformAuthRateLimitService {
  private readonly windows = new Map<string, RateWindow>();
  private readonly multiplier: number;

  constructor(config: ConfigService) {
    const configured = Number(
      config.get<string>('PLATFORM_AUTH_RATE_LIMIT_MULTIPLIER'),
    );
    this.multiplier =
      Number.isFinite(configured) && configured > 0 ? configured : 1;
  }

  consumeLogin(ip: string | undefined, email: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    const source = ip?.trim() || 'unknown';

    // A shared office can have several legitimate operators behind one IP,
    // hence the wider source bucket. The account bucket matches the five-try
    // durable lockout policy.
    this.consume(`login:ip:${source}`, 25, 15 * 60);
    this.consume(`login:email:${normalizedEmail}`, 5, 15 * 60);
  }

  private consume(key: string, limit: number, windowSeconds: number): void {
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
          message: `Too many sign-in attempts. Try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private cleanup(now: number): void {
    if (this.windows.size < 1000) return;
    for (const [key, window] of this.windows.entries()) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
