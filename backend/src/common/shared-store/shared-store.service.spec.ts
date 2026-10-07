import { ConfigService } from '@nestjs/config';
import { SharedStoreService } from './shared-store.service';

/**
 * Covers the in-memory fallback path only (no REDIS_URL). The Redis path needs
 * a real server to be worth testing, so it is exercised by running the app
 * with REDIS_URL set rather than against a mock that would only assert that
 * ioredis was called.
 */
function buildStore(redisUrl?: string) {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'REDIS_URL' ? redisUrl : undefined,
    ),
  } as unknown as ConfigService;
  const store = new SharedStoreService(configService);
  store.onModuleInit();
  return store;
}

describe('SharedStoreService (fallback path)', () => {
  it('reports not shared when REDIS_URL is unset', () => {
    expect(buildStore().isShared()).toBe(false);
  });

  it('returns null for an unknown key', async () => {
    await expect(buildStore().get('nope')).resolves.toBeNull();
  });

  it('round-trips a value', async () => {
    const store = buildStore();
    await store.set('k', 'v', 60);
    await expect(store.get('k')).resolves.toBe('v');
  });

  it('expires a value once its TTL has passed', async () => {
    jest.useFakeTimers();
    try {
      const store = buildStore();
      await store.set('k', 'v', 1);

      jest.advanceTimersByTime(1500);
      await expect(store.get('k')).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('increments a counter from zero', async () => {
    const store = buildStore();
    await expect(store.increment('c', 60)).resolves.toBe(1);
    await expect(store.increment('c', 60)).resolves.toBe(2);
    await expect(store.increment('c', 60)).resolves.toBe(3);
  });

  it('keeps counters independent per key', async () => {
    const store = buildStore();
    await store.increment('a', 60);
    await store.increment('a', 60);
    await expect(store.increment('b', 60)).resolves.toBe(1);
  });

  it('keeps the original window expiry instead of sliding it on each hit', async () => {
    jest.useFakeTimers();
    try {
      const store = buildStore();
      await store.increment('c', 10);

      // Half-way through the window, another hit must not extend it - a fixed
      // window that slid on every request would never reset under load.
      jest.advanceTimersByTime(6000);
      await expect(store.increment('c', 10)).resolves.toBe(2);

      jest.advanceTimersByTime(5000); // now past the original 10s expiry
      await expect(store.increment('c', 10)).resolves.toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not throw on destroy when Redis was never configured', async () => {
    await expect(buildStore().onModuleDestroy()).resolves.toBeUndefined();
  });
});
