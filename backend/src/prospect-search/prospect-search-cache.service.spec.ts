import { ConfigService } from '@nestjs/config';
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

function buildService(ttlSeconds?: string) {
  const configService = {
    get: jest.fn(() => ttlSeconds),
  } as unknown as ConfigService;
  return new ProspectSearchCacheService(configService);
}

describe('ProspectSearchCacheService', () => {
  it('returns null on a cache miss', () => {
    const cache = buildService();

    expect(cache.get('tenant-1', 'Find security companies', 'mock')).toBeNull();
  });

  it('returns the cached result for an identical tenant/prompt/provider', () => {
    const cache = buildService();
    const result = buildResult('Find security companies in Texas');

    cache.set('tenant-1', 'Find security companies in Texas', 'mock', result);

    expect(
      cache.get('tenant-1', 'Find security companies in Texas', 'mock'),
    ).toBe(result);
  });

  it('is case-insensitive and trims whitespace when matching prompts', () => {
    const cache = buildService();
    const result = buildResult('Find security companies');

    cache.set('tenant-1', '  Find Security Companies  ', 'mock', result);

    expect(cache.get('tenant-1', 'find security companies', 'mock')).toBe(
      result,
    );
  });

  it('isolates cache entries per tenant', () => {
    const cache = buildService();
    const result = buildResult('Find security companies');

    cache.set('tenant-1', 'Find security companies', 'mock', result);

    expect(cache.get('tenant-2', 'Find security companies', 'mock')).toBeNull();
  });

  it('isolates cache entries per provider', () => {
    const cache = buildService();
    const result = buildResult('Find security companies');

    cache.set('tenant-1', 'Find security companies', 'mock', result);

    expect(
      cache.get('tenant-1', 'Find security companies', 'blackpearl'),
    ).toBeNull();
  });

  it('expires entries after the configured TTL', () => {
    const cache = buildService('0.001'); // 1ms TTL
    const result = buildResult('Find security companies');

    cache.set('tenant-1', 'Find security companies', 'mock', result);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(
          cache.get('tenant-1', 'Find security companies', 'mock'),
        ).toBeNull();
        resolve(undefined);
      }, 20);
    });
  });

  it('tracks hit/miss stats and computes the hit ratio', () => {
    const cache = buildService();
    const result = buildResult('Find security companies');
    cache.set('tenant-1', 'Find security companies', 'mock', result);

    cache.get('tenant-1', 'Find security companies', 'mock'); // hit
    cache.get('tenant-1', 'unknown prompt', 'mock'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRatio).toBeCloseTo(0.5);
  });
});
