import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedStoreService } from '../common/shared-store/shared-store.service';
import { ProspectSearchResult } from './types/prospect-search.types';

const DEFAULT_TTL_SECONDS = 300;
const KEY_PREFIX = 'ps:playbook:';

/**
 * TTL cache keyed on {tenantId, provider, prompt}. A repeat prompt within the
 * TTL window skips both the AI filter-parsing call and the provider fetch
 * entirely - the strongest, simplest form of "avoid duplicate provider
 * requests". Filters are not part of the lookup key (they're a deterministic
 * function of the prompt at write time) but are preserved in the cached value
 * for observability/debugging.
 *
 * Backed by SharedStoreService, so cache hits work across instances when
 * REDIS_URL is set and fall back to per-process memory when it is not.
 *
 * Hit/miss counters stay process-local - see ProspectDiscoveryCacheService.
 */
@Injectable()
export class ProspectSearchCacheService {
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

  private buildKey(tenantId: string, prompt: string, provider: string): string {
    return `${KEY_PREFIX}${tenantId}::${provider}::${prompt.trim().toLowerCase()}`;
  }

  async get(
    tenantId: string,
    prompt: string,
    provider: string,
  ): Promise<ProspectSearchResult | null> {
    const raw = await this.store.get(
      this.buildKey(tenantId, prompt, provider),
    );

    if (raw === null) {
      this.misses += 1;
      return null;
    }

    try {
      const result = JSON.parse(raw) as ProspectSearchResult;
      this.hits += 1;
      return result;
    } catch {
      // Corrupt or schema-changed entry: treat as a miss and re-fetch.
      this.misses += 1;
      return null;
    }
  }

  async set(
    tenantId: string,
    prompt: string,
    provider: string,
    result: ProspectSearchResult,
  ): Promise<void> {
    await this.store.set(
      this.buildKey(tenantId, prompt, provider),
      JSON.stringify(result),
      this.ttlSeconds,
    );
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
