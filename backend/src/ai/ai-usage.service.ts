import { Injectable, Logger } from '@nestjs/common';
import { AiFeature, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Per-model token rates in USD per million tokens.
 *
 * Hardcoded deliberately. These are published list prices, they change rarely,
 * and the alternative -- reading them from config -- would mean a silent
 * mispricing whenever an env var went unset. An unknown model yields a null
 * cost rather than a wrong one.
 */
const MODEL_RATES_USD_PER_MTOK: Record<
  string,
  { input: number; output: number }
> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
};

/** What a single AI call reported, as handed to the recorder. */
export interface AiUsageRecord {
  feature: AiFeature;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  succeeded: boolean;
  durationMs: number | null;
  tenantId?: string | null;
  userId?: string | null;
}

/** One row of the per-feature cost breakdown. */
export interface AiFeatureCostSummary {
  feature: AiFeature;
  calls: number;
  failedCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  /** Mean cost of a SUCCESSFUL call -- what a credit price is set from. */
  averageCostUsd: number | null;
  /** Worst observed successful call, which is what sets the margin risk. */
  maxCostUsd: number | null;
}

/**
 * Records what each AI call cost us.
 *
 * AI features are unmetered today: the permission guard answers "does this
 * plan include this feature", never "how much has been used". Metering them
 * needs a credit price per feature, and that price cannot be set honestly
 * without knowing the real cost -- which nothing measured.
 *
 * This service only observes. It moves no balance, blocks no call, and is
 * never on the critical path: a failure to log must not fail the AI request
 * that was already served, so every write swallows its own errors. Billing is
 * built on top of this once the figures exist.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Our cost in USD for a call, or null when it cannot be computed --
   * an unmetered response or an unrecognised model. Null is not zero, and is
   * stored as null so averages skip it instead of being dragged down.
   */
  estimateCostUsd(
    model: string,
    inputTokens: number | null,
    outputTokens: number | null,
  ): number | null {
    const rates = MODEL_RATES_USD_PER_MTOK[model];
    if (!rates) return null;
    if (inputTokens === null && outputTokens === null) return null;

    const input = ((inputTokens ?? 0) / 1_000_000) * rates.input;
    const output = ((outputTokens ?? 0) / 1_000_000) * rates.output;
    return input + output;
  }

  /**
   * Writes one usage row. Never throws: logging is strictly observational, so
   * a failed insert is reported and dropped rather than surfaced to a caller
   * whose AI request already succeeded.
   */
  async record(record: AiUsageRecord): Promise<void> {
    const estimatedCostUsd = this.estimateCostUsd(
      record.model,
      record.inputTokens,
      record.outputTokens,
    );

    try {
      await this.prisma.aiUsageEvent.create({
        data: {
          tenantId: record.tenantId ?? null,
          userId: record.userId ?? null,
          feature: record.feature,
          model: record.model,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          estimatedCostUsd:
            estimatedCostUsd === null
              ? null
              : new Prisma.Decimal(estimatedCostUsd),
          succeeded: record.succeeded,
          durationMs: record.durationMs,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record AI usage for ${record.feature}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Cost per feature over a window -- the report the per-feature credit price
   * gets set from.
   *
   * Averages and maxima count successful calls only: a call that failed or
   * fell back is not representative of what the feature costs to deliver,
   * though its tokens still count toward the spend totals, because we paid
   * for them.
   */
  async getFeatureCostSummary(params: {
    since: Date;
    tenantId?: string;
  }): Promise<AiFeatureCostSummary[]> {
    const { since, tenantId } = params;

    const rows = await this.prisma.aiUsageEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        feature: true,
        totalTokens: true,
        estimatedCostUsd: true,
        succeeded: true,
      },
    });

    const byFeature = new Map<AiFeature, AiFeatureCostSummary>();
    // Successful-only costs, kept aside so the average is not diluted by
    // failed calls that never produced the feature's output.
    const successCosts = new Map<AiFeature, number[]>();

    for (const row of rows) {
      const existing = byFeature.get(row.feature) ?? {
        feature: row.feature,
        calls: 0,
        failedCalls: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        averageCostUsd: null,
        maxCostUsd: null,
      };

      existing.calls += 1;
      if (!row.succeeded) existing.failedCalls += 1;
      existing.totalTokens += row.totalTokens ?? 0;

      const cost =
        row.estimatedCostUsd === null ? null : Number(row.estimatedCostUsd);
      if (cost !== null) {
        existing.totalCostUsd += cost;
        if (row.succeeded) {
          const costs = successCosts.get(row.feature) ?? [];
          costs.push(cost);
          successCosts.set(row.feature, costs);
        }
      }

      byFeature.set(row.feature, existing);
    }

    for (const [feature, summary] of byFeature) {
      const costs = successCosts.get(feature);
      if (costs?.length) {
        summary.averageCostUsd =
          costs.reduce((sum, c) => sum + c, 0) / costs.length;
        summary.maxCostUsd = Math.max(...costs);
      }
    }

    return [...byFeature.values()].sort(
      (a, b) => b.totalCostUsd - a.totalCostUsd,
    );
  }

  /** Total AI cost for one tenant over a window. */
  async getTenantCostUsd(tenantId: string, since: Date): Promise<number> {
    const result = await this.prisma.aiUsageEvent.aggregate({
      where: { tenantId, createdAt: { gte: since } },
      _sum: { estimatedCostUsd: true },
    });
    return Number(result._sum.estimatedCostUsd ?? 0);
  }

  /**
   * Spend per tenant over a window, highest first. Answers "what does this
   * client cost us", which is the question that could not be answered at all
   * before this table existed.
   */
  async getTopTenantsByCost(params: {
    since: Date;
    limit?: number;
  }): Promise<Array<{ tenantId: string | null; costUsd: number; calls: number }>> {
    const { since, limit = 20 } = params;

    const grouped = await this.prisma.aiUsageEvent.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: since } },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    });

    return grouped
      .map((row) => ({
        tenantId: row.tenantId,
        costUsd: Number(row._sum.estimatedCostUsd ?? 0),
        calls: row._count._all,
      }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, limit);
  }
}
