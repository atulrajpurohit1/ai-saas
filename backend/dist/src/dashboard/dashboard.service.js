"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const CLOSED_DEAL_STAGES = new Set(['won', 'lost']);
const OPEN_PROPOSAL_EXCLUDED_STATUSES = new Set(['draft']);
const WEEKS_OF_TREND = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
function startOfWeek(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    return d;
}
function computePeriodCounts(records, now) {
    const last7Start = now.getTime() - 7 * DAY_MS;
    const prev7Start = now.getTime() - 14 * DAY_MS;
    let last7Days = 0;
    let previous7Days = 0;
    for (const record of records) {
        const t = record.createdAt.getTime();
        if (t >= last7Start)
            last7Days += 1;
        else if (t >= prev7Start)
            previous7Days += 1;
    }
    const deltaPct = previous7Days > 0 ? Math.round(((last7Days - previous7Days) / previous7Days) * 1000) / 10 : null;
    return { last7Days, previous7Days, deltaPct };
}
function computeWeeklyTrend(records, now) {
    const buckets = new Map();
    const currentWeekStart = startOfWeek(now);
    for (let i = WEEKS_OF_TREND - 1; i >= 0; i -= 1) {
        const weekStart = new Date(currentWeekStart.getTime() - i * WEEK_MS);
        buckets.set(weekStart.toISOString().slice(0, 10), 0);
    }
    const earliestBucketStart = currentWeekStart.getTime() - (WEEKS_OF_TREND - 1) * WEEK_MS;
    for (const record of records) {
        const t = record.createdAt.getTime();
        if (t < earliestBucketStart)
            continue;
        const weekKey = startOfWeek(record.createdAt).toISOString().slice(0, 10);
        if (buckets.has(weekKey)) {
            buckets.set(weekKey, (buckets.get(weekKey) || 0) + 1);
        }
    }
    return Array.from(buckets.entries()).map(([weekStart, count]) => ({ weekStart, count }));
}
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary(tenantId) {
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
        const sentProposals = proposals.filter((proposal) => !OPEN_PROPOSAL_EXCLUDED_STATUSES.has(proposal.status.trim().toLowerCase()));
        const stageCounts = new Map();
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map