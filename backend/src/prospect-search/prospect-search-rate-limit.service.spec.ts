import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ProspectSearchRateLimitService } from './prospect-search-rate-limit.service';

function buildService(limitPerMinute?: string) {
  const configService = {
    get: jest.fn(() => limitPerMinute),
  } as unknown as ConfigService;
  return new ProspectSearchRateLimitService(configService);
}

describe('ProspectSearchRateLimitService', () => {
  it('allows requests within the configured limit', () => {
    const service = buildService('3');

    expect(() => service.check('user-1')).not.toThrow();
    expect(() => service.check('user-1')).not.toThrow();
    expect(() => service.check('user-1')).not.toThrow();
  });

  it('throws a 429 once the limit is exceeded within the same window', () => {
    const service = buildService('2');

    service.check('user-1');
    service.check('user-1');

    expect(() => service.check('user-1')).toThrow(HttpException);
    try {
      service.check('user-1');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('tracks limits independently per user', () => {
    const service = buildService('1');

    expect(() => service.check('user-1')).not.toThrow();
    expect(() => service.check('user-2')).not.toThrow();
    expect(() => service.check('user-1')).toThrow(HttpException);
  });

  it('falls back to the default limit when misconfigured', () => {
    const service = buildService('not-a-number');

    for (let i = 0; i < 20; i += 1) {
      expect(() => service.check('user-1')).not.toThrow();
    }
    expect(() => service.check('user-1')).toThrow(HttpException);
  });
});
