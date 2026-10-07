import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SharedStoreService } from '../common/shared-store/shared-store.service';
import { ProspectSearchRateLimitService } from './prospect-search-rate-limit.service';

/**
 * Exercises the real SharedStoreService on its in-memory fallback path (no
 * REDIS_URL) - the current production shape.
 */
function buildService(limitPerMinute?: string) {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'PROSPECT_SEARCH_RATE_LIMIT_PER_MINUTE'
        ? limitPerMinute
        : undefined,
    ),
  } as unknown as ConfigService;
  const store = new SharedStoreService(configService);
  store.onModuleInit();
  return new ProspectSearchRateLimitService(configService, store);
}

describe('ProspectSearchRateLimitService', () => {
  it('allows requests within the configured limit', async () => {
    const service = buildService('3');

    await expect(service.check('user-1')).resolves.toBeUndefined();
    await expect(service.check('user-1')).resolves.toBeUndefined();
    await expect(service.check('user-1')).resolves.toBeUndefined();
  });

  it('throws a 429 once the limit is exceeded within the same window', async () => {
    const service = buildService('2');

    await service.check('user-1');
    await service.check('user-1');

    await expect(service.check('user-1')).rejects.toThrow(HttpException);
    try {
      await service.check('user-1');
      fail('expected the limiter to reject');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('tracks limits independently per user', async () => {
    const service = buildService('1');

    await expect(service.check('user-1')).resolves.toBeUndefined();
    await expect(service.check('user-2')).resolves.toBeUndefined();
    await expect(service.check('user-1')).rejects.toThrow(HttpException);
  });

  it('falls back to the default limit when misconfigured', async () => {
    const service = buildService('not-a-number');

    for (let i = 0; i < 20; i += 1) {
      await expect(service.check('user-1')).resolves.toBeUndefined();
    }
    await expect(service.check('user-1')).rejects.toThrow(HttpException);
  });

  it('starts a fresh window in the next minute bucket', async () => {
    jest.useFakeTimers();
    try {
      const service = buildService('1');

      await service.check('user-1');
      await expect(service.check('user-1')).rejects.toThrow(HttpException);

      // The window key embeds the minute bucket, so crossing a minute
      // boundary must reset the count rather than keep rejecting.
      jest.advanceTimersByTime(61_000);
      await expect(service.check('user-1')).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
