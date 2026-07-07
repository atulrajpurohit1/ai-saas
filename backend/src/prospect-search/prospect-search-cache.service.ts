import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProspectSearchResult } from './types/prospect-search.types';

interface CacheEntry {
  result: ProspectSearchResult;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 300;
const MAX_CACHE_SIZE = 500;

/**
 * In-memory, per-process TTL cache keyed on {tenantId, provider, prompt}.
 * A repeat prompt within the TTL window skips both the AI filter-parsing
 * call and the provider fetch entirely - the strongest, simplest form of
 * "avoid duplicate provider requests". Filters are not part of the lookup
 * key (they're a deterministic function of the prompt at write time) but
 * are preserved in the cached value for observability/debugging.
 *
 * Per-process only - a multi-instance deployment would need a shared store
 * (e.g. Redis) for cache hits to work across instances.
 */
@Injectable()
export class ProspectSearchCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(private readonly configService: ConfigService) {
    const ttlSeconds = Number(
      this.configService.get<string>('PROSPECT_SEARCH_CACHE_TTL_SECONDS'),
    );
    this.ttlMs =
      (Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? ttlSeconds
        : DEFAULT_TTL_SECONDS) * 1000;
  }

  private buildKey(tenantId: string, prompt: string, provider: string): string {
    return `${tenantId}::${provider}::${prompt.trim().toLowerCase()}`;
  }

  get(
    tenantId: string,
    prompt: string,
    provider: string,
  ): ProspectSearchResult | null {
    const key = this.buildKey(tenantId, prompt, provider);
    const entry = this.cache.get(key);

    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.cache.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return entry.result;
  }

  set(
    tenantId: string,
    prompt: string,
    provider: string,
    result: ProspectSearchResult,
  ): void {
    const key = this.buildKey(tenantId, prompt, provider);
    this.cache.set(key, { result, expiresAt: Date.now() + this.ttlMs });
    this.cleanup();
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: total === 0 ? 0 : this.hits / total,
    };
  }

  private cleanup() {
    if (this.cache.size < MAX_CACHE_SIZE) return;

    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
