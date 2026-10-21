import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CLOSED_DEAL_STAGES = new Set(['won', 'lost']);
const OPEN_PROPOSAL_EXCLUDED_STATUSES = new Set(['draft']);
const WEEKS_OF_TREND = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// How many activity rows the dashboard strip shows. Each of the three tables
// is asked for this many and the merged list is cut back to it, because the
// newest five overall could all come from one table.
const RECENT_ACTIVITY_LIMIT = 5;

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

  /**
   * The five newest leads, deals and proposals, merged.
   *
   * The dashboard used to build this strip on the client by calling GET
   * /leads, /deals and /proposals -- all three of which return every row the
   * tenant owns, with /leads additionally running a nested salesAssessments
   * subquery per lead. Rendering five lines cost three unbounded result sets,
   * so the dashboard got slower every time the customer added a lead.
   *
   * Here the database does the ordering and the limiting, so the work is
   * bounded by RECENT_ACTIVITY_LIMIT rather than by how long the customer has
   * been using the product.
   */
  async getRecentActivity(tenantId: string) {
    const [leads, deals, proposals] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: { id: true, name: true, company: true, createdAt: true },
      }),
      this.prisma.deal.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          name: true,
          createdAt: true,
          lead: { select: { company: true } },
        },
      }),
      this.prisma.proposal.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          title: true,
          createdAt: true,
          lead: { select: { company: true } },
        },
      }),
    ]);

    const activities = [
      ...leads.map((lead) => ({
        id: `lead-${lead.id}`,
        kind: 'lead' as const,
        title: 'New Lead Created',
        subject: lead.company || lead.name || 'Lead',
        createdAt: lead.createdAt,
      })),
      ...deals.map((deal) => ({
        id: `deal-${deal.id}`,
        kind: 'deal' as const,
        title: 'Deal Started',
        subject: deal.name || deal.lead?.company || 'Deal',
        createdAt: deal.createdAt,
      })),
      ...proposals.map((proposal) => ({
        id: `proposal-${proposal.id}`,
        kind: 'proposal' as const,
        title: 'Proposal Created',
        subject: proposal.title || proposal.lead?.company || 'Proposal',
        createdAt: proposal.createdAt,
      })),
    ];

    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_ACTIVITY_LIMIT);
  }
}
