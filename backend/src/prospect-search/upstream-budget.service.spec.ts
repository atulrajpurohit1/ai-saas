import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpstreamSpendCapExceededException } from '../billing/upstream-spend-cap.exception';
import {
  BlackPearlProspectingProvider,
  UpstreamBudgetSnapshot,
} from './providers/blackpearl-prospecting.provider';
import { UpstreamBudgetService } from './upstream-budget.service';

describe('UpstreamBudgetService', () => {
  let provider: { getUpstreamStatus: jest.Mock };
  let service: UpstreamBudgetService;

  const snapshot = (
    overrides: Partial<UpstreamBudgetSnapshot> = {},
  ): UpstreamBudgetSnapshot => ({
    projectId: 'proj_123',
    prepaidBalanceUsd: 500,
    tightestHardBudget: null,
    ...overrides,
  });

  const build = (env: Record<string, string | undefined> = {}) => {
    const configService = {
      get: jest.fn((key: string) => env[key]),
    };
    return new UpstreamBudgetService(
      configService as unknown as ConfigService,
      provider as unknown as BlackPearlProspectingProvider,
    );
  };

  beforeEach(() => {
    provider = { getUpstreamStatus: jest.fn() };
    service = build();
  });

  describe('assertCanSpend', () => {
    it('allows spending with a healthy balance', async () => {
      provider.getUpstreamStatus.mockResolvedValue(snapshot());
      await expect(service.assertCanSpend()).resolves.toBeUndefined();
    });

    it('refuses once the balance reaches the reserve floor', async () => {
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({ prepaidBalanceUsd: 25 }),
      );
      await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('refuses below the floor', async () => {
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({ prepaidBalanceUsd: 3.5 }),
      );
      await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('honours a configured floor', async () => {
      service = build({ BLACKPEARL_RESERVE_FLOOR_USD: '100' });
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({ prepaidBalanceUsd: 60 }),
      );
      await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    /**
     * A hard budget rejects new work at zero remaining however full the
     * prepaid pot is, so it is the binding constraint when it is the tighter
     * of the two. The old guard looked only at the pot and would have called
     * this healthy.
     */
    it('refuses on a hard budget even when the prepaid pot is healthy', async () => {
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({
          prepaidBalanceUsd: 5000,
          tightestHardBudget: {
            scope: 'project',
            capabilityKey: null,
            limitUsd: 50,
            remainingUsd: 4,
            resetsAt: '2026-11-01T00:00:00Z',
          },
        }),
      );
      await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('allows spending when a hard budget has room', async () => {
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({
          prepaidBalanceUsd: 5000,
          tightestHardBudget: {
            scope: 'organization',
            capabilityKey: null,
            limitUsd: 500,
            remainingUsd: 400,
            resetsAt: '2026-11-01T00:00:00Z',
          },
        }),
      );
      await expect(service.assertCanSpend()).resolves.toBeUndefined();
    });

    /**
     * An unknown balance is not evidence of an empty one. Failing closed here
     * would turn "the status endpoint is down" into "Prospect Search is down for
     * everyone", which is a worse outcome than briefly overspending -- and
     * BlackPearl rejects the job itself once the money really is gone.
     */
    it('allows spending when the balance cannot be determined', async () => {
      provider.getUpstreamStatus.mockResolvedValue(null);
      await expect(service.assertCanSpend()).resolves.toBeUndefined();
    });

    it('allows spending when the read succeeds but reports no figures', async () => {
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({ prepaidBalanceUsd: null }),
      );
      await expect(service.assertCanSpend()).resolves.toBeUndefined();
    });
  });

  describe('caching', () => {
    it('caches the snapshot between calls', async () => {
      provider.getUpstreamStatus.mockResolvedValue(snapshot());
      await service.getSnapshot();
      await service.getSnapshot();
      expect(provider.getUpstreamStatus).toHaveBeenCalledTimes(1);
    });

    it('re-reads after invalidate()', async () => {
      provider.getUpstreamStatus.mockResolvedValue(snapshot());
      await service.getSnapshot();
      service.invalidate();
      await service.getSnapshot();
      expect(provider.getUpstreamStatus).toHaveBeenCalledTimes(2);
    });

    it('re-reads when forced', async () => {
      provider.getUpstreamStatus.mockResolvedValue(snapshot());
      await service.getSnapshot();
      await service.getSnapshot(true);
      expect(provider.getUpstreamStatus).toHaveBeenCalledTimes(2);
    });

    /**
     * The point of keeping a last-known figure: a failed read must not switch
     * the guard off. This could not work before, because the provider returned
     * null both for "could not read" and for "no balance reported".
     */
    it('falls back to the last figure it saw when a later read fails', async () => {
      provider.getUpstreamStatus.mockResolvedValueOnce(
        snapshot({ prepaidBalanceUsd: 10 }),
      );
      await service.getSnapshot();

      service.invalidate();
      provider.getUpstreamStatus.mockResolvedValueOnce(null);

      // Still enforced, from the stale figure, rather than failing open.
      await expect(service.assertCanSpend()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('exposes the prepaid balance on its own', async () => {
      provider.getUpstreamStatus.mockResolvedValue(
        snapshot({ prepaidBalanceUsd: 480 }),
      );
      await expect(service.getBalanceUsd()).resolves.toBe(480);
    });
  });

  describe('assertTenantCanSpend', () => {
    /**
     * No cap is configured by default, deliberately: the number has to come
     * from what a search really costs us, which is not yet established.
     */
    it('allows any spend when no cap is configured', () => {
      expect(() =>
        service.assertTenantCanSpend('tenant-1', 10_000),
      ).not.toThrow();
    });

    it('allows a tenant under its cap', () => {
      service = build({ BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD: '50' });
      expect(() =>
        service.assertTenantCanSpend('tenant-1', 12.5),
      ).not.toThrow();
    });

    it('refuses the tenant that has reached its cap', () => {
      service = build({ BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD: '50' });
      expect(() => service.assertTenantCanSpend('tenant-1', 50)).toThrow(
        UpstreamSpendCapExceededException,
      );
    });

    /**
     * The whole point of a per-tenant cap: it refuses ONE tenant, where the
     * global floor refused everybody.
     */
    it('refuses only the tenant that is over, not the next one', () => {
      service = build({ BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD: '50' });
      expect(() => service.assertTenantCanSpend('greedy', 61.4)).toThrow(
        UpstreamSpendCapExceededException,
      );
      expect(() => service.assertTenantCanSpend('quiet', 1.2)).not.toThrow();
    });

    it('says when the limit resets', () => {
      service = build({ BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD: '50' });
      try {
        service.assertTenantCanSpend('tenant-1', 50);
        throw new Error('expected a refusal');
      } catch (error) {
        expect(error).toBeInstanceOf(UpstreamSpendCapExceededException);
        const resetsAt = (error as UpstreamSpendCapExceededException).resetsAt;
        expect(new Date(resetsAt).getTime()).toBeGreaterThan(Date.now());
        expect(new Date(resetsAt).getUTCDate()).toBe(1);
      }
    });

    it('enforces nothing when the configured cap is not a positive number', () => {
      service = build({ BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD: 'free' });
      expect(() =>
        service.assertTenantCanSpend('tenant-1', 10_000),
      ).not.toThrow();
    });
  });
});
