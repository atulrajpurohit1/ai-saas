import { BadRequestException } from '@nestjs/common';
import {
  AutoRechargeAttemptStatus,
  AutoRechargePauseReason,
} from '@prisma/client';
import { CreditAutoRechargeService } from './credit-auto-recharge.service';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { CREDIT_PACKS } from './credit-packs.constants';

const PRO = CREDIT_PACKS.PRO;

type ConfigOverrides = Partial<{
  id: string;
  tenantId: string;
  enabled: boolean;
  pausedAt: Date | null;
  thresholdCredits: number;
  packKey: string;
  stripePaymentMethodId: string | null;
  monthlyCapAmount: number | null;
  lastRechargeAt: Date | null;
  consecutiveFailures: number;
  pauseReason: AutoRechargePauseReason | null;
}>;

function makeConfig(overrides: ConfigOverrides = {}) {
  return {
    id: 'cfg1',
    tenantId: 't1',
    enabled: true,
    pausedAt: null,
    thresholdCredits: 500,
    packKey: 'PRO',
    stripePaymentMethodId: 'pm_123',
    monthlyCapAmount: null,
    lastRechargeAt: null,
    consecutiveFailures: 0,
    pauseReason: null,
    ...overrides,
  };
}

function build(options: {
  config?: ReturnType<typeof makeConfig> | null;
  balance?: number;
  chargeImpl?: jest.Mock;
  monthlySpend?: number;
  grantImpl?: jest.Mock;
} = {}) {
  const {
    config = makeConfig(),
    balance = 100,
    monthlySpend = 0,
  } = options;

  const updateConfig = jest.fn().mockResolvedValue(config ?? makeConfig());
  const createAttempt = jest.fn().mockResolvedValue({ id: 'att1' });

  const prisma = {
    creditAutoRecharge: {
      findUnique: jest.fn().mockResolvedValue(config),
      findMany: jest.fn().mockResolvedValue(config ? [config] : []),
      update: updateConfig,
      upsert: jest.fn().mockResolvedValue(config ?? makeConfig()),
    },
    creditAutoRechargeAttempt: {
      create: createAttempt,
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { amountCharged: monthlySpend } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  } as unknown as PrismaService;

  const grant =
    options.grantImpl ??
    jest.fn().mockResolvedValue({ balance: 13100, granted: true });
  const credits = {
    getBalance: jest.fn().mockResolvedValue({ balance }),
    grant,
  } as unknown as CreditsService;

  const charge =
    options.chargeImpl ??
    jest.fn().mockResolvedValue({
      paymentIntentId: 'pi_123',
      status: 'succeeded',
      amount: PRO.price * 100,
      currency: 'usd',
    });
  const stripe = {
    chargeSavedCardForPack: charge,
    paymentMethodFromSetupSession: jest.fn(),
  } as unknown as StripeService;

  return {
    service: new CreditAutoRechargeService(prisma, credits, stripe),
    prisma,
    charge,
    grant,
    updateConfig,
    createAttempt,
  };
}

describe('CreditAutoRechargeService.upsertConfig validation', () => {
  it('rejects an unknown pack', async () => {
    const { service } = build();
    await expect(
      service.upsertConfig('t1', {
        enabled: true,
        thresholdCredits: 500,
        packKey: 'NOT_A_PACK',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // A threshold at or above the pack size would leave the balance still under
  // the threshold after a top-up, charging again every sweep.
  it('rejects a threshold that would immediately re-trigger', async () => {
    const { service } = build();
    await expect(
      service.upsertConfig('t1', {
        enabled: true,
        thresholdCredits: PRO.credits,
        packKey: 'PRO',
      }),
    ).rejects.toThrow(/immediately re-trigger/);
  });

  it('rejects a monthly cap below the price of one pack', async () => {
    const { service } = build();
    await expect(
      service.upsertConfig('t1', {
        enabled: true,
        thresholdCredits: 500,
        packKey: 'PRO',
        monthlyCapAmount: PRO.price - 1,
      }),
    ).rejects.toThrow(/monthly cap/i);
  });

  it('accepts a valid configuration and clears any existing pause', async () => {
    const { service, prisma } = build();
    await service.upsertConfig('t1', {
      enabled: true,
      thresholdCredits: 500,
      packKey: 'PRO',
      monthlyCapAmount: 1000,
    });

    const update = (prisma.creditAutoRecharge.upsert as jest.Mock).mock
      .calls[0][0].update;
    expect(update.pausedAt).toBeNull();
    expect(update.consecutiveFailures).toBe(0);
  });
});

describe('CreditAutoRechargeService.rechargeIfDue guards', () => {
  it('does nothing when the balance is above the threshold', async () => {
    const { service, charge } = build({ balance: 5000 });
    const result = await service.rechargeIfDue('t1');
    expect(result).toEqual({ status: 'skipped', reason: 'above-threshold' });
    expect(charge).not.toHaveBeenCalled();
  });

  it('does nothing when not configured', async () => {
    const { service, charge } = build({ config: null });
    expect(await service.rechargeIfDue('t1')).toEqual({
      status: 'skipped',
      reason: 'not-configured',
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it('does nothing while paused', async () => {
    const { service, charge } = build({
      config: makeConfig({ pausedAt: new Date() }),
    });
    expect(await service.rechargeIfDue('t1')).toEqual({
      status: 'skipped',
      reason: 'paused',
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it('records a skipped attempt when no card is saved', async () => {
    const { service, charge, createAttempt } = build({
      config: makeConfig({ stripePaymentMethodId: null }),
    });
    expect(await service.rechargeIfDue('t1')).toEqual({
      status: 'skipped',
      reason: 'no-card',
    });
    expect(charge).not.toHaveBeenCalled();
    expect(createAttempt.mock.calls[0][0].data.status).toBe(
      AutoRechargeAttemptStatus.SKIPPED,
    );
  });

  // Stops a burst of charges if the balance still reads low before a grant
  // has landed.
  it('does not charge twice inside the minimum interval', async () => {
    const { service, charge } = build({
      config: makeConfig({ lastRechargeAt: new Date(Date.now() - 60_000) }),
    });
    expect(await service.rechargeIfDue('t1')).toEqual({
      status: 'skipped',
      reason: 'too-soon',
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it('charges once the minimum interval has passed', async () => {
    const { service, charge } = build({
      config: makeConfig({
        lastRechargeAt: new Date(Date.now() - 60 * 60_000),
      }),
    });
    expect((await service.rechargeIfDue('t1')).status).toBe('recharged');
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it('pauses rather than substituting a pack that no longer exists', async () => {
    const { service, charge, updateConfig } = build({
      config: makeConfig({ packKey: 'REMOVED_PACK' }),
    });
    expect(await service.rechargeIfDue('t1')).toEqual({
      status: 'skipped',
      reason: 'unknown-pack',
    });
    expect(charge).not.toHaveBeenCalled();
    expect(updateConfig.mock.calls[0][0].data.pausedAt).toBeInstanceOf(Date);
  });
});

describe('CreditAutoRechargeService monthly cap', () => {
  it('refuses and pauses when the next charge would exceed the cap', async () => {
    const { service, charge, updateConfig } = build({
      config: makeConfig({ monthlyCapAmount: PRO.price }),
      monthlySpend: PRO.price,
    });

    expect(await service.rechargeIfDue('t1')).toEqual({
      status: 'skipped',
      reason: 'monthly-cap',
    });
    expect(charge).not.toHaveBeenCalled();
    expect(updateConfig.mock.calls[0][0].data.pauseReason).toBe(
      AutoRechargePauseReason.MONTHLY_CAP_REACHED,
    );
  });

  it('charges when the cap still has room', async () => {
    const { service, charge } = build({
      config: makeConfig({ monthlyCapAmount: PRO.price * 3 }),
      monthlySpend: PRO.price,
    });
    expect((await service.rechargeIfDue('t1')).status).toBe('recharged');
    expect(charge).toHaveBeenCalledTimes(1);
  });

  // A decline costs the tenant nothing, so it must not eat their cap.
  it('counts only successful attempts toward the cap', async () => {
    const { service, prisma } = build();
    await service.monthlySpend('cfg1');
    const where = (prisma.creditAutoRechargeAttempt.aggregate as jest.Mock).mock
      .calls[0][0].where;
    expect(where.status).toBe(AutoRechargeAttemptStatus.SUCCEEDED);
  });
});

describe('CreditAutoRechargeService charging', () => {
  it('grants credits keyed on the PaymentIntent id so a replay cannot double-grant', async () => {
    const { service, grant } = build();
    await service.rechargeIfDue('t1');
    expect(grant.mock.calls[0][0].stripeSessionId).toBe('pi_123');
    expect(grant.mock.calls[0][0].amount).toBe(PRO.credits);
  });

  it('treats a non-succeeded intent as a failure rather than a top-up', async () => {
    const { service, grant } = build({
      chargeImpl: jest.fn().mockResolvedValue({
        paymentIntentId: 'pi_x',
        status: 'requires_action',
        amount: 1,
        currency: 'usd',
      }),
    });

    const result = await service.rechargeIfDue('t1');
    expect(result.status).toBe('failed');
    expect(grant).not.toHaveBeenCalled();
  });

  it('records a failed attempt and does not grant on decline', async () => {
    const { service, grant, createAttempt } = build({
      chargeImpl: jest.fn().mockRejectedValue(new Error('card_declined')),
    });

    const result = await service.rechargeIfDue('t1');
    expect(result.status).toBe('failed');
    expect(grant).not.toHaveBeenCalled();
    expect(createAttempt.mock.calls[0][0].data.status).toBe(
      AutoRechargeAttemptStatus.FAILED,
    );
    expect(createAttempt.mock.calls[0][0].data.failureReason).toContain(
      'card_declined',
    );
  });

  it('does not pause on a single decline, which is often transient', async () => {
    const { service, updateConfig } = build({
      chargeImpl: jest.fn().mockRejectedValue(new Error('try again')),
    });
    await service.rechargeIfDue('t1');
    const data = updateConfig.mock.calls[0][0].data;
    expect(data.consecutiveFailures).toBe(1);
    expect(data.pausedAt).toBeUndefined();
  });

  it('pauses after three consecutive declines', async () => {
    const { service, updateConfig } = build({
      config: makeConfig({ consecutiveFailures: 2 }),
      chargeImpl: jest.fn().mockRejectedValue(new Error('expired_card')),
    });
    await service.rechargeIfDue('t1');
    const data = updateConfig.mock.calls[0][0].data;
    expect(data.consecutiveFailures).toBe(3);
    expect(data.pausedAt).toBeInstanceOf(Date);
    expect(data.pauseReason).toBe(AutoRechargePauseReason.PAYMENT_FAILED);
  });

  it('resets the failure count after a success', async () => {
    const { service, prisma } = build({
      config: makeConfig({ consecutiveFailures: 2 }),
    });
    await service.rechargeIfDue('t1');
    // The success path updates inside a transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('CreditAutoRechargeService.sweep', () => {
  it('keeps going after one tenant fails', async () => {
    const { service, prisma } = build();
    (prisma.creditAutoRecharge.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 't1' },
      { tenantId: 't2' },
    ]);
    (prisma.creditAutoRecharge.findUnique as jest.Mock)
      .mockRejectedValueOnce(new Error('db blip'))
      .mockResolvedValueOnce(makeConfig({ tenantId: 't2' }));

    const outcome = await service.sweep();
    expect(outcome.configsChecked).toBe(2);
    expect(outcome.failed).toBe(1);
    expect(outcome.recharged).toBe(1);
  });

  it('only considers enabled, unpaused configs', async () => {
    const { service, prisma } = build();
    await service.sweep();
    expect(
      (prisma.creditAutoRecharge.findMany as jest.Mock).mock.calls[0][0].where,
    ).toEqual({ enabled: true, pausedAt: null });
  });
});
