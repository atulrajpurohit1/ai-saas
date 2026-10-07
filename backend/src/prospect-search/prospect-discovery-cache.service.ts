import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedStoreService } from '../common/shared-store/shared-store.service';
import { ProspectDiscoveryResult } from './types/prospect-search.types';

const DEFAULT_TTL_SECONDS = 300;
const KEY_PREFIX = 'ps:discovery:';

/**
 * TTL cache for prospect discovery searches, keyed on
 * {tenantId, provider, normalized objective+filters}. Skipping a repeat search
 * within the TTL avoids a duplicate, billed BlackPearl Prospecting job.
 * (A previous version of this comment quoted "~$0.11/prospect, confirmed
 * empirically"; that figure was never measured and has been removed -- see
 * credit-packs.constants.ts. The cache is worth having regardless of what a
 * job actually costs.)
 *
 * Backed by SharedStoreService, so cache hits work across instances when
 * REDIS_URL is set and fall back to per-process memory when it is not. Kept as
 * a separate service from ProspectSearchCacheService rather than a shared
 * generic one because the cached value shape differs (a list of prospects vs.
 * one company insight).
 *
 * Hit/miss counters stay process-local on purpose: they are a debugging aid
 * for this instance, and spending a Redis round trip to total them across the
 * fleet would cost more than the number is worth.
 */
@Injectable()
export class ProspectDiscoveryCacheService {
  private readonly ttlSeconds: number;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly store: SharedStoreService,
  ) {
    const ttlSeconds = Number(
      this.configService.get<string>('PROSPECT_SEARCH_CACHE_TTL_SECONDS'),
    );
    this.ttlSeconds =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? ttlSeconds
        : DEFAULT_TTL_SECONDS;
  }

  buildKey(
    tenantId: string,
    provider: string,
    normalizedQuery: string,
  ): string {
    return `${KEY_PREFIX}${tenantId}::${provider}::${normalizedQuery}`;
  }

  async get(key: string): Promise<ProspectDiscoveryResult | null> {
    const raw = await this.store.get(key);

    if (raw === null) {
      this.misses += 1;
      return null;
    }

    try {
      const result = JSON.parse(raw) as ProspectDiscoveryResult;
      this.hits += 1;
      return result;
    } catch {
      // A corrupt or schema-changed entry is a miss, not an error: the caller
      // just re-runs the search.
      this.misses += 1;
      return null;
    }
  }

  async set(key: string, result: ProspectDiscoveryResult): Promise<void> {
    await this.store.set(key, JSON.stringify(result), this.ttlSeconds);
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total === 0 ? 0 : this.hits / total,
      shared: this.store.isShared(),
    };
  }
}
