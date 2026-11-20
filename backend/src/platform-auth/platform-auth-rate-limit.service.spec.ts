import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAuthRateLimitService } from './platform-auth-rate-limit.service';

describe('PlatformAuthRateLimitService', () => {
  const create = () =>
    new PlatformAuthRateLimitService({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);

  it('allows five attempts for an account inside the window', () => {
    const limiter = create();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(() =>
        limiter.consumeLogin('203.0.113.4', 'OPS@Example.com'),
      ).not.toThrow();
    }
  });

  it('blocks the sixth attempt even when source IPs are rotated', () => {
    const limiter = create();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.consumeLogin(`203.0.113.${attempt}`, 'ops@example.com');
    }

    expect(() =>
      limiter.consumeLogin('198.51.100.9', ' ops@EXAMPLE.com '),
    ).toThrow(HttpException);
  });

  it('blocks password spraying from one source across many accounts', () => {
    const limiter = create();

    for (let attempt = 0; attempt < 25; attempt += 1) {
      limiter.consumeLogin('203.0.113.4', `operator-${attempt}@example.com`);
    }

    expect(() =>
      limiter.consumeLogin('203.0.113.4', 'another@example.com'),
    ).toThrow(HttpException);
  });
});
