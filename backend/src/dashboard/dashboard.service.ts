import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CLOSED_DEAL_STAGES = new Set(['won', 'lost']);
const OPEN_PROPOSAL_EXCLUDED_STATUSES = new Set(['draft']);
const WEEKS_OF_TREND = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

type TimestampRecord = { createdAt: Date };

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

function computePeriodCounts(records: TimestampRecord[], now: Date) {
  const last7Start = now.getTime() - 7 * DAY_MS;
  const prev7Start = now.getTime() - 14 * DAY_MS;

  let last7Days = 0;
  let previous7Days = 0;

  for (const record of records) {
    const t = record.createdAt.getTime();
    if (t >= last7Start) last7Days += 1;
    else if (t >= prev7Start) previous7Days += 1;
  }

  const deltaPct = previous7Days > 0 ? Math.round(((last7Days - previous7Days) / previous7Days) * 1000) / 10 : null;

  return { last7Days, previous7Days, deltaPct };
}

function computeWeeklyTrend(records: TimestampRecord[], now: Date) {
  const buckets = new Map<string, number>();
  const currentWeekStart = startOfWeek(now);

  for (let i = WEEKS_OF_TREND - 1; i >= 0; i -= 1) {
    const weekStart = new Date(currentWeekStart.getTime() - i * WEEK_MS);
    buckets.set(weekStart.toISOString().slice(0, 10), 0);
  }

  const earliestBucketStart = currentWeekStart.getTime() - (WEEKS_OF_TREND - 1) * WEEK_MS;

  for (const record of records) {
    const t = record.createdAt.getTime();
    if (t < earliestBucketStart) continue;
    const weekKey = startOfWeek(record.createdAt).toISOString().slice(0, 10);
    if (buckets.has(weekKey)) {
      buckets.set(weekKey, (buckets.get(weekKey) || 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([weekStart, count]) => ({ weekStart, count }));
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const now = new Date();

    const [leads, deals, proposals] = await Promise.all([
      this.prisma.lead.findMany({ where: { tenantId }, select: { createdAt: true } }),
      this.prisma.deal.findMany({ where: { tenantId }, select: { createdAt: true, stage: true } }),
      this.prisma.proposal.findMany({ where: { tenantId }, select: { createdAt: true, status: true } }),
    ]);

    const leadPeriod = computePeriodCounts(leads, now);
    const dealPeriod = computePeriodCounts(deals, now);
    const proposalPeriod = computePeriodCounts(proposals, now);

    const activeDeals = deals.filter((deal) => !CLOSED_DEAL_STAGES.has(deal.stage.trim().toLowerCase()));
    const sentProposals = proposals.filter(
      (proposal) => !OPEN_PROPOSAL_EXCLUDED_STATUSES.has(proposal.status.trim().toLowerCase()),
    );

    const stageCounts = new Map<string, number>();
    for (const deal of deals) {
      const key = deal.stage.trim().toLowerCase() || 'unknown';
      stageCounts.set(key, (stageCounts.get(key) || 0) + 1);
    }

    return {
      leads: {
        total: leads.length,
        ...leadPeriod,
        weeklyTrend: computeWeeklyTrend(leads, now),
      },
      deals: {
        total: deals.length,
        active: activeDeals.length,
        ...dealPeriod,
        byStage: Array.from(stageCounts.entries()).map(([stage, count]) => ({ stage, count })),
      },
      proposals: {
        total: proposals.length,
        sent: sentProposals.length,
        ...proposalPeriod,
      },
    };
  }
}
