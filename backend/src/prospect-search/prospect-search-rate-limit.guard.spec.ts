import { ExecutionContext } from '@nestjs/common';
import { ProspectSearchRateLimitGuard } from './prospect-search-rate-limit.guard';
import { ProspectSearchRateLimitService } from './prospect-search-rate-limit.service';

function buildContext(user?: { sub: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('ProspectSearchRateLimitGuard', () => {
  it('delegates the check to the rate limit service using the active user id', () => {
    const rateLimitService = { check: jest.fn() };
    const guard = new ProspectSearchRateLimitGuard(
      rateLimitService as unknown as ProspectSearchRateLimitService,
    );

    const result = guard.canActivate(buildContext({ sub: 'user-1' }));

    expect(result).toBe(true);
    expect(rateLimitService.check).toHaveBeenCalledWith('user-1');
  });

  it('propagates the exception thrown when the rate limit is exceeded', () => {
    const rateLimitService = {
      check: jest.fn(() => {
        throw new Error('rate limited');
      }),
    };
    const guard = new ProspectSearchRateLimitGuard(
      rateLimitService as unknown as ProspectSearchRateLimitService,
    );

    expect(() => guard.canActivate(buildContext({ sub: 'user-1' }))).toThrow(
      'rate limited',
    );
  });
});
