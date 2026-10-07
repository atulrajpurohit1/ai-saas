import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedStoreService } from '../common/shared-store/shared-store.service';

const DEFAULT_LIMIT_PER_MINUTE = 20;
const WINDOW_SECONDS = 60;
const KEY_PREFIX = 'ps:ratelimit:';

/**
 * Fixed-window limiter for Prospect Search, counted in SharedStoreService.
 *
 * The window key embeds the minute bucket, so each minute is a fresh counter
 * that Redis expires on its own - no sweep needed on the shared path.
 *
 * With REDIS_URL set the count is shared, so the configured limit is the real
 * fleet-wide limit. Without it the count is per-process, which on more than one
 * instance means the effective limit is the configured value times the instance
 * count. That was the behaviour before this service used a shared store, and it
 * is still correct on the current single-instance deployment.
 *
 * Mirrors the pattern used by PublicApiRateLimitService.
 */
@Injectable()
export class ProspectSearchRateLimitService {
  private readonly limitPerMinute: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly store: SharedStoreService,
  ) {
    const configured = Number(
      this.configService.get<string>('PROSPECT_SEARCH_RATE_LIMIT_PER_MINUTE'),
    );
    this.limitPerMinute =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_LIMIT_PER_MINUTE;
  }

  async check(userId: string): Promise<void> {
    const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const key = `${KEY_PREFIX}${userId}:${bucket}`;

    // TTL is one window plus a second of slack, so a counter cannot outlive
    // its bucket and leak into the next minute.
    const count = await this.store.increment(key, WINDOW_SECONDS + 1);

    if (count > this.limitPerMinute) {
      throw new HttpException(
        'Prospect search rate limit exceeded. Please slow down and try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
