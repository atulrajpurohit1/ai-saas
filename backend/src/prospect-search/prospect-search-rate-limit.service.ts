import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateWindow = {
  count: number;
  resetAt: number;
};

const DEFAULT_LIMIT_PER_MINUTE = 20;

/**
 * Simple in-memory fixed-window limiter, mirroring the pattern already used
 * by PublicApiRateLimitService. Per-process only - a multi-instance
 * deployment would need a shared store (e.g. Redis) instead.
 */
@Injectable()
export class ProspectSearchRateLimitService {
  private readonly windows = new Map<string, RateWindow>();
  private readonly limitPerMinute: number;

  constructor(private readonly configService: ConfigService) {
    const configured = Number(
      this.configService.get<string>('PROSPECT_SEARCH_RATE_LIMIT_PER_MINUTE'),
    );
    this.limitPerMinute =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_LIMIT_PER_MINUTE;
  }

  check(userId: string): void {
    const now = Date.now();
    const bucket = Math.floor(now / 60_000);
    const windowKey = `${userId}:${bucket}`;
    const existing = this.windows.get(windowKey);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(windowKey, { count: 1, resetAt: (bucket + 1) * 60_000 });
      this.cleanup(now);
      return;
    }

    existing.count += 1;
    if (existing.count > this.limitPerMinute) {
      throw new HttpException(
        'Prospect search rate limit exceeded. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private cleanup(now: number) {
    if (this.windows.size < 1000) return;

    for (const [key, window] of this.windows.entries()) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}
