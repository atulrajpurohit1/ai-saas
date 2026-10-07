import { AiFeature } from '@prisma/client';
import { AiUsageService } from './ai-usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveAiFeature } from './ai-feature.map';

function buildService(overrides: Record<string, unknown> = {}) {
  const create = jest.fn().mockResolvedValue({});
  const prisma = {
    aiUsageEvent: { create, ...overrides },
  } as unknown as PrismaService;
  return { service: new AiUsageService(prisma), create };
}

describe('AiUsageService.estimateCostUsd', () => {
  it('prices input and output tokens at the per-model rate', () => {
    const { service } = buildService();
    // 1M input @ $0.30 + 1M output @ $2.50
    expect(service.estimateCostUsd('gemini-2.5-flash', 1_000_000, 1_000_000)).
      toBeCloseTo(2.8, 10);
  });

  it('prices a realistic call', () => {
    const { service } = buildService();
    // 20k in, 2k out => 20000/1e6*0.30 + 2000/1e6*2.50 = 0.006 + 0.005
    expect(service.estimateCostUsd('gemini-2.5-flash', 20_000, 2_000)).
      toBeCloseTo(0.011, 10);
  });

  it('returns null for an unknown model rather than guessing a rate', () => {
    const { service } = buildService();
    expect(service.estimateCostUsd('some-future-model', 1000, 1000)).toBeNull();
  });

  it('returns null when the response carried no token counts', () => {
    const { service } = buildService();
    expect(service.estimateCostUsd('gemini-2.5-flash', null, null)).toBeNull();
  });

  it('treats a single missing side as zero, not the whole call as unmetered', () => {
    const { service } = buildService();
    expect(service.estimateCostUsd('gemini-2.5-flash', 1_000_000, null)).
      toBeCloseTo(0.3, 10);
  });
});

describe('AiUsageService.record', () => {
  const base = {
    feature: AiFeature.PROPOSAL_DRAFT,
    model: 'gemini-2.5-flash',
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    succeeded: true,
    durationMs: 1234,
  };

  it('persists the computed cost alongside the token counts', async () => {
    const { service, create } = buildService();
    await service.record(base);

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.inputTokens).toBe(1000);
    expect(data.outputTokens).toBe(500);
    expect(Number(data.estimatedCostUsd)).toBeCloseTo(0.00155, 10);
  });

  it('stores a null cost when the model is unrecognised', async () => {
    const { service, create } = buildService();
    await service.record({ ...base, model: 'mystery-model' });
    expect(create.mock.calls[0][0].data.estimatedCostUsd).toBeNull();
  });

  // Logging is observational: the AI response is already in the caller's
  // hand, so a failed insert must never surface as a failed AI request.
  it('swallows a database failure instead of throwing', async () => {
    const { service } = buildService({
      create: jest.fn().mockRejectedValue(new Error('db down')),
    });
    await expect(service.record(base)).resolves.toBeUndefined();
  });

  it('records failed calls, which can still have burned tokens', async () => {
    const { service, create } = buildService();
    await service.record({ ...base, succeeded: false });
    expect(create.mock.calls[0][0].data.succeeded).toBe(false);
  });
});

describe('resolveAiFeature', () => {
  it('maps a known action label', () => {
    expect(resolveAiFeature('proposal draft generation')).toBe(
      AiFeature.PROPOSAL_DRAFT,
    );
  });

  it('maps an action whose label embeds an id', () => {
    expect(resolveAiFeature('proposal generation for lead abc-123')).toBe(
      AiFeature.LEAD_GENERATION,
    );
  });

  it('falls back to OTHER so an unmapped action is still recorded', () => {
    expect(resolveAiFeature('something nobody mapped')).toBe(AiFeature.OTHER);
  });
});
