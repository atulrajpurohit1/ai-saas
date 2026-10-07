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

function buildGuard(check: jest.Mock) {
  return new ProspectSearchRateLimitGuard({
    check,
  } as unknown as ProspectSearchRateLimitService);
}

describe('ProspectSearchRateLimitGuard', () => {
  it('delegates the check to the rate limit service using the active user id', async () => {
    const check = jest.fn().mockResolvedValue(undefined);
    const guard = buildGuard(check);

    await expect(
      guard.canActivate(buildContext({ sub: 'user-1' })),
    ).resolves.toBe(true);
    expect(check).toHaveBeenCalledWith('user-1');
  });

  it('falls back to "anonymous" when there is no active user', async () => {
    const check = jest.fn().mockResolvedValue(undefined);
    const guard = buildGuard(check);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(check).toHaveBeenCalledWith('anonymous');
  });

  it('propagates the exception thrown when the rate limit is exceeded', async () => {
    // The check is awaited now, so the rejection surfaces as a rejected
    // promise rather than a synchronous throw.
    const guard = buildGuard(
      jest.fn().mockRejectedValue(new Error('rate limited')),
    );

    await expect(
      guard.canActivate(buildContext({ sub: 'user-1' })),
    ).rejects.toThrow('rate limited');
  });
});
