import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cross-instance key/value + counter store, with a per-process fallback.
 *
 * Prospect Search holds two kinds of state that were originally per-process
 * Maps: cached provider results, and rate-limit counters. Both are correct on
 * a single instance and both break quietly on the second one -- a cache miss
 * per instance multiplies the (billed) BlackPearl job count, and an N-instance
 * deployment turns a 20/min limit into 20N/min. This service is the one place
 * that state lives, so the services above it stop caring how many instances
 * are running.
 *
 * When REDIS_URL is not set, everything falls back to in-memory Maps and the
 * behaviour is exactly what it was before Redis existed. That is the current
 * production shape (render.yaml runs a single web instance), so the fallback
 * is the supported default, not a degraded mode -- but it is only correct
 * while there is one instance, which `isShared` lets callers and /health
 * report honestly.
 *
 * Redis is treated as a cache, never as a source of truth: every operation
 * fails SOFT. A Redis outage degrades to local behaviour (a duplicate upstream
 * job, a limiter that counts per-instance) rather than taking Prospect Search
 * down with it. The alternative -- failing requests when Redis blips -- would
 * make a cache a new single point of failure for a feature that worked without
 * it.
 */

/** Local-fallback sweep threshold, mirroring the old per-service cleanup. */
const MAX_LOCAL_ENTRIES = 500;

interface LocalEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class SharedStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SharedStoreService.name);
  private readonly local = new Map<string, LocalEntry>();
  private redis: Redis | null = null;
  /** Flipped false on the first connection error so logs stay readable. */
  private redisHealthy = false;
  private loggedDegraded = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('REDIS_URL')?.trim();

    if (!url) {
      this.logger.log(
        'REDIS_URL is not set - Prospect Search cache and rate limiting are per-process. Correct for a single instance; set REDIS_URL before scaling to more than one.',
      );
      return;
    }

    // lazyConnect so construction cannot throw, and a bad URL surfaces as a
    // connection error we degrade from rather than a boot crash.
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      // Default reconnect backoff is fine, but cap it so a long outage does
      // not leave us waiting minutes after Redis returns.
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });

    this.redis.on('ready', () => {
      this.redisHealthy = true;
      this.loggedDegraded = false;
      this.logger.log('Redis connected - cache and rate limits are shared.');
    });

    this.redis.on('error', (error: Error) => {
      this.redisHealthy = false;
      if (!this.loggedDegraded) {
        this.loggedDegraded = true;
        this.logger.error(
          `Redis unavailable, degrading to per-process cache and rate limiting: ${error.message}`,
        );
      }
    });

    void this.redis.connect().catch(() => {
      // Already logged by the 'error' handler; swallow so boot continues.
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  /** True only when state is genuinely shared across instances right now. */
  isShared(): boolean {
    return this.redis !== null && this.redisHealthy;
  }

  async get(key: string): Promise<string | null> {
    if (this.isShared()) {
      try {
        return await this.redis!.get(key);
      } catch (error) {
        this.noteFailure('get', error);
      }
    }
    return this.localGet(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.isShared()) {
      try {
        await this.redis!.set(key, value, 'EX', ttlSeconds);
        return;
      } catch (error) {
        this.noteFailure('set', error);
      }
    }
    this.localSet(key, value, ttlSeconds);
  }

  /**
   * Increments a fixed-window counter and returns the new count, setting the
   * window's expiry on first use. The Redis path is a single pipelined
   * INCR+EXPIRE round trip so two instances cannot interleave into a lost
   * increment.
   */
  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (this.isShared()) {
      try {
        const results = await this.redis!
          .multi()
          .incr(key)
          .expire(key, ttlSeconds)
          .exec();
        const count = results?.[0]?.[1];
        if (typeof count === 'number') return count;
      } catch (error) {
        this.noteFailure('increment', error);
      }
    }
    return this.localIncrement(key, ttlSeconds);
  }

  private noteFailure(op: string, error: unknown): void {
    this.redisHealthy = false;
    if (!this.loggedDegraded) {
      this.loggedDegraded = true;
      this.logger.error(
        `Redis ${op} failed, falling back to per-process state: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private localGet(key: string): string | null {
    const entry = this.local.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.local.delete(key);
      return null;
    }
    return entry.value;
  }

  private localSet(key: string, value: string, ttlSeconds: number): void {
    this.local.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    this.sweepLocal();
  }

  private localIncrement(key: string, ttlSeconds: number): number {
    const existing = this.localGet(key);
    const next = (existing === null ? 0 : Number(existing)) + 1;
    const expiresAt =
      existing === null
        ? Date.now() + ttlSeconds * 1000
        : (this.local.get(key)?.expiresAt ??
          Date.now() + ttlSeconds * 1000);
    // Preserve the original window's expiry: re-setting it on every hit would
    // turn a fixed window into a sliding one that never resets under load.
    this.local.set(key, { value: String(next), expiresAt });
    this.sweepLocal();
    return next;
  }

  private sweepLocal(): void {
    if (this.local.size < MAX_LOCAL_ENTRIES) return;
    const now = Date.now();
    for (const [key, entry] of this.local.entries()) {
      if (entry.expiresAt <= now) this.local.delete(key);
    }
  }
}
