import { ConfigService } from '@nestjs/config';
import { SharedStoreService } from '../common/shared-store/shared-store.service';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchResult } from './types/prospect-search.types';

function buildResult(companyName: string): ProspectSearchResult {
  return {
    companyName,
    insight: {
      companyName,
      businessSummary: 'Growing security services company.',
      valueProps: [],
      salesAngles: [],
      keyPersonas: [],
      potentialObjections: [],
    },
  };
}

/**
 * Exercises the real SharedStoreService on its in-memory fallback path (no
 * REDIS_URL), which is both the current production shape and the behaviour
 * these tests previously asserted directly against a Map.
 */
function buildService(ttlSeconds?: string) {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'PROSPECT_SEARCH_CACHE_TTL_SECONDS' ? ttlSeconds : undefined,
    ),
  } as unknown as ConfigService;
  const store = new SharedStoreService(configService);
  store.onModuleInit();
  return new ProspectSearchCacheService(configService, store);
}

describe('ProspectSearchCacheService', () => {
  it('returns null on a cache miss', async () => {
    const cache = buildService();

    await expect(
      cache.get('tenant-1', 'Find security companies', 'mock'),
    ).resolves.toBeNull();
  });

  it('returns the cached result for an identical tenant/prompt/provider', async () => {
    const cache = buildService();
    const result = buildResult('Find security companies in Texas');

    await cache.set(
      'tenant-1',
      'Find security companies in Texas',
      'mock',
      result,
    );

    // toEqual, not toBe: the value round-trips through JSON in the store, so
    // it is an equal structure rather than the same reference.
    await expect(
      cache.get('tenant-1', 'Find security companies in Texas', 'mock'),
    ).resolves.toEqual(result);
  });

  it('is case-insensitive and trims whitespace when matching prompts', async () => {
    const cache = buildService();
    const result = buildResult('Find security companies');

    await cache.set('tenant-1', '  Find Security Companies  ', 'mock', result);

    await expect(
      cache.get('tenant-1', 'find security companies', 'mock'),
    ).resolves.toEqual(result);
  });

  it('isolates cache entries per tenant', async () => {
    const cache = buildService();
    const result = buildResult('Find security companies');

    await cache.set('tenant-1', 'Find security companies', 'mock', result);

    await expect(
      cache.get('tenant-2', 'Find security companies', 'mock'),
    ).resolves.toBeNull();
  });

  it('isolates cache entries per provider', async () => {
    const cache = buildService();
    const result = buildResult('Find security companies');

    await cache.set('tenant-1', 'Find security companies', 'mock', result);

    await expect(
      cache.get('tenant-1', 'Find security companies', 'blackpearl'),
    ).resolves.toBeNull();
  });

  it('expires entries after the configured TTL', async () => {
    jest.useFakeTimers();
    try {
      // TTL is now whole seconds (Redis EX takes an integer), so the old
      // sub-millisecond TTL is no longer expressible; advance time instead.
      const cache = buildService('1');
      const result = buildResult('Find security companies');

      await cache.set('tenant-1', 'Find security companies', 'mock', result);
      jest.advanceTimersByTime(1500);

      await expect(
        cache.get('tenant-1', 'Find security companies', 'mock'),
      ).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('tracks hit/miss stats and computes the hit ratio', async () => {
    const cache = buildService();
    const result = buildResult('Find security companies');
    await cache.set('tenant-1', 'Find security companies', 'mock', result);

    await cache.get('tenant-1', 'Find security companies', 'mock'); // hit
    await cache.get('tenant-1', 'unknown prompt', 'mock'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBeCloseTo(0.5);
  });

  it('reports state as not shared when REDIS_URL is unset', () => {
    expect(buildService().getStats().shared).toBe(false);
  });
});
