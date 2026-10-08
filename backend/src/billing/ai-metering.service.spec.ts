import { AiFeature } from '@prisma/client';
import { AiMeteringService } from './ai-metering.service';
import { CreditsService } from './credits.service';
import { InsufficientCreditsException } from './insufficient-credits.exception';
import { aiCreditCost } from './ai-credit-costs.constants';

function build(options: { spendImpl?: jest.Mock; refundImpl?: jest.Mock } = {}) {
  const spend =
    options.spendImpl ?? jest.fn().mockResolvedValue({ balance: 100, spent: 5 });
  const refundSpend =
    options.refundImpl ?? jest.fn().mockResolvedValue({ balance: 105 });
  const credits = {
    spend,
    refundSpend,
    hasCredits: jest.fn().mockResolvedValue(true),
    getBalance: jest.fn().mockResolvedValue({ balance: 0 }),
  } as unknown as CreditsService;

  return { service: new AiMeteringService(credits), spend, refundSpend };
}

const CTX = {
  tenantId: 't1',
  userId: 'u1',
  feature: AiFeature.PROPOSAL_DRAFT,
};

describe('AiMeteringService.run', () => {
  it('charges before running the work', async () => {
    const order: string[] = [];
    const spend = jest.fn().mockImplementation(() => {
      order.push('charge');
      return Promise.resolve({ balance: 100, spent: 15 });
    });
    const { service } = build({ spendImpl: spend });

    await service.run(CTX, async () => {
      order.push('work');
      return 'draft';
    });

    expect(order).toEqual(['charge', 'work']);
  });

  it('returns the work result', async () => {
    const { service } = build();
    await expect(service.run(CTX, async () => 'draft')).resolves.toBe('draft');
  });

  it('charges the configured price for the feature', async () => {
    const { service, spend } = build();
    await service.run(CTX, async () => 'ok');
    expect(spend.mock.calls[0][0].amount).toBe(
      aiCreditCost(AiFeature.PROPOSAL_DRAFT),
    );
  });

  // The customer got nothing, so they keep their credits.
  it('refunds when the work throws, and re-throws the original error', async () => {
    const { service, refundSpend } = build();
    const boom = new Error('gemini exploded');

    await expect(
      service.run(CTX, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(refundSpend).toHaveBeenCalledTimes(1);
    expect(refundSpend.mock.calls[0][0].amount).toBe(
      aiCreditCost(AiFeature.PROPOSAL_DRAFT),
    );
  });

  it('does not run the work when the tenant cannot pay', async () => {
    const work = jest.fn();
    const { service } = build({
      spendImpl: jest
        .fn()
        .mockRejectedValue(new InsufficientCreditsException('no', 15, 0)),
    });

    await expect(service.run(CTX, work)).rejects.toThrow(
      InsufficientCreditsException,
    );
    expect(work).not.toHaveBeenCalled();
  });

  // Hiding the AI error behind a refund error would mask the real fault.
  it('still throws the original error when the refund itself fails', async () => {
    const { service } = build({
      refundImpl: jest.fn().mockRejectedValue(new Error('ledger down')),
    });
    const boom = new Error('gemini exploded');

    await expect(
      service.run(CTX, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });

  it('skips the ledger entirely for a free feature', async () => {
    const { service, spend, refundSpend } = build();
    jest.spyOn(service, 'costOf').mockReturnValue(0);

    await expect(service.run(CTX, async () => 'ok')).resolves.toBe('ok');
    expect(spend).not.toHaveBeenCalled();
    expect(refundSpend).not.toHaveBeenCalled();
  });
});

describe('AiMeteringService.runNullable', () => {
  it('keeps the charge when a result comes back', async () => {
    const { service, refundSpend } = build();
    await expect(service.runNullable(CTX, async () => 'ok')).resolves.toBe(
      'ok',
    );
    expect(refundSpend).not.toHaveBeenCalled();
  });

  // Several AI methods report failure by returning null; charging for that
  // would bill the customer for nothing.
  it('refunds when the work returns null', async () => {
    const { service, refundSpend } = build();
    await expect(service.runNullable(CTX, async () => null)).resolves.toBeNull();
    expect(refundSpend).toHaveBeenCalledTimes(1);
  });

  it('refunds when the work returns undefined', async () => {
    const { service, refundSpend } = build();
    await service.runNullable(CTX, async () => undefined as unknown as string);
    expect(refundSpend).toHaveBeenCalledTimes(1);
  });
});

describe('AiMeteringService.runChargeableIf', () => {
  it('keeps the charge when the result is chargeable', async () => {
    const { service, refundSpend } = build();
    const result = await service.runChargeableIf(
      CTX,
      async () => ({ fallbackUsed: false }),
      (r) => !r.fallbackUsed,
    );
    expect(result.fallbackUsed).toBe(false);
    expect(refundSpend).not.toHaveBeenCalled();
  });

  // A locally-built fallback is not the feature the customer paid for.
  it('refunds when the result is a fallback, but still returns it', async () => {
    const { service, refundSpend } = build();
    const result = await service.runChargeableIf(
      CTX,
      async () => ({ fallbackUsed: true }),
      (r) => !r.fallbackUsed,
    );
    expect(result.fallbackUsed).toBe(true);
    expect(refundSpend).toHaveBeenCalledTimes(1);
  });
});

describe('AiMeteringService.canAfford', () => {
  it('is true for a free feature without consulting the balance', async () => {
    const { service } = build();
    jest.spyOn(service, 'costOf').mockReturnValue(0);
    await expect(service.canAfford('t1', AiFeature.COPILOT_ANSWER)).resolves.toBe(
      true,
    );
  });
});

describe('AI credit prices', () => {
  it('prices every feature in the enum', () => {
    for (const feature of Object.values(AiFeature)) {
      expect(aiCreditCost(feature)).toBeGreaterThanOrEqual(0);
    }
  });

  it('charges more for document-heavy features than for short drafts', () => {
    expect(aiCreditCost(AiFeature.SECURITY_RFP_ANALYSIS)).toBeGreaterThan(
      aiCreditCost(AiFeature.EMAIL_DRAFT),
    );
  });

  it('honours an env override', () => {
    const key = 'AI_CREDIT_COST_EMAIL_DRAFT';
    const previous = process.env[key];
    process.env[key] = '99';
    try {
      expect(aiCreditCost(AiFeature.EMAIL_DRAFT)).toBe(99);
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  // An unset or malformed variable must not silently make a feature free.
  it('falls back to the default for a malformed override', () => {
    const key = 'AI_CREDIT_COST_EMAIL_DRAFT';
    const previous = process.env[key];
    process.env[key] = 'not-a-number';
    try {
      expect(aiCreditCost(AiFeature.EMAIL_DRAFT)).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it('allows a deliberate zero', () => {
    const key = 'AI_CREDIT_COST_EMAIL_DRAFT';
    const previous = process.env[key];
    process.env[key] = '0';
    try {
      expect(aiCreditCost(AiFeature.EMAIL_DRAFT)).toBe(0);
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });
});
