import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateWindow = {
  count: number;
  resetAt: number;
};

@Injectable()
export class PublicApiRateLimitService {
  private readonly windows = new Map<string, RateWindow>();

  check(apiKeyId: string, limit: number) {
    const now = Date.now();
    const bucket = Math.floor(now / 60_000);
    const windowKey = `${apiKeyId}:${bucket}`;
    const existing = this.windows.get(windowKey);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(windowKey, {
        count: 1,
        resetAt: (bucket + 1) * 60_000,
      });
      this.cleanup(now);
      return;
    }

    existing.count += 1;
    if (existing.count > limit) {
      throw new HttpException('API key rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
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
