import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProspectDiscoveryResult } from './types/prospect-search.types';

interface CacheEntry {
  result: ProspectDiscoveryResult;
  expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 300;
const MAX_CACHE_SIZE = 500;

/**
 * In-memory, per-process TTL cache for prospect discovery searches, keyed on
 * {tenantId, provider, normalized objective+filters}. Mirrors
 * ProspectSearchCacheService's approach for single-company playbooks - kept
 * as a separate service rather than a shared generic one because the cached
 * value shape differs (a list of prospects vs. one company insight).
 * Skipping a repeat search within the TTL avoids a duplicate, billed
 * BlackPearl Prospecting job (confirmed empirically: ~$0.11/prospect).
 *
 * Per-process only - a multi-instance deployment would need a shared store
 * (e.g. Redis) for cache hits to work across instances.
 */
@Injectable()
export class ProspectDiscoveryCacheService {
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

  buildKey(
    tenantId: string,
    provider: string,
    normalizedQuery: string,
  ): string {
    return `${tenantId}::${provider}::${normalizedQuery}`;
  }

  get(key: string): ProspectDiscoveryResult | null {
    const entry = this.cache.get(key);

    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.cache.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return entry.result;
  }

  set(key: string, result: ProspectDiscoveryResult): void {
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
