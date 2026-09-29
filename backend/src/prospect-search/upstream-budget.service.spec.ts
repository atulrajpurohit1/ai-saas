import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';
import { UpstreamBudgetService } from './upstream-budget.service';

describe('UpstreamBudgetService', () => {
  let provider: { getUpstreamBalanceUsd: jest.Mock };
  let service: UpstreamBudgetService;

  const build = (env: Record<string, string> = {}) => {
    const configService = {
      get: jest.fn((key: string) => env[key]),
    };
    return new UpstreamBudgetService(
      configService as unknown as ConfigService,
      provider as unknown as BlackPearlProspectingProvider,
    );
  };

  beforeEach(() => {
    provider = { getUpstreamBalanceUsd: jest.fn() };
    service = build();
  });

  it('allows spending with a healthy balance', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(500);
    await expect(service.assertCanSpend()).resolves.toBeUndefined();
  });

  it('refuses once the balance reaches the reserve floor', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(25);
    await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('refuses below the floor', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(3.5);
    await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('honours a configured floor', async () => {
    service = build({ BLACKPEARL_RESERVE_FLOOR_USD: '100' });
    provider.getUpstreamBalanceUsd.mockResolvedValue(60);
    await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  /**
   * An unknown balance is not evidence of an empty one. Failing closed here
   * would turn "the status endpoint is down" into "Prospect Search is down for
   * everyone", which is a worse outcome than briefly overspending -- and
   * BlackPearl rejects the job itself once the money really is gone.
   */
  it('allows spending when the balance cannot be determined', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(null);
    await expect(service.assertCanSpend()).resolves.toBeUndefined();
  });

  it('allows spending when the balance lookup throws', async () => {
    provider.getUpstreamBalanceUsd.mockRejectedValue(new Error('network'));
    await expect(service.assertCanSpend()).resolves.toBeUndefined();
  });

  it('caches the balance rather than calling out on every search', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(500);

    await service.getBalanceUsd();
    await service.getBalanceUsd();
    await service.assertCanSpend();

    expect(provider.getUpstreamBalanceUsd).toHaveBeenCalledTimes(1);
  });

  it('re-reads after invalidate, so spending is reflected', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(500);
    await service.getBalanceUsd();

    service.invalidate();
    provider.getUpstreamBalanceUsd.mockResolvedValue(480);

    await expect(service.getBalanceUsd()).resolves.toBe(480);
    expect(provider.getUpstreamBalanceUsd).toHaveBeenCalledTimes(2);
  });

  it('re-reads when forced', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(500);
    await service.getBalanceUsd();
    await service.getBalanceUsd(true);
    expect(provider.getUpstreamBalanceUsd).toHaveBeenCalledTimes(2);
  });

  it('falls back to the last known balance when a refresh fails', async () => {
    provider.getUpstreamBalanceUsd.mockResolvedValue(500);
    await service.getBalanceUsd();

    service.invalidate();
    provider.getUpstreamBalanceUsd.mockRejectedValue(new Error('network'));

    await expect(service.getBalanceUsd()).resolves.toBe(500);
  });
});
