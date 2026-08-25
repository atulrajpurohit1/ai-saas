import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    lead: { findMany: jest.Mock };
    deal: { findMany: jest.Mock };
    proposal: { findMany: jest.Mock };
  };

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    prisma = {
      lead: { findMany: jest.fn().mockResolvedValue([]) },
      deal: { findMany: jest.fn().mockResolvedValue([]) },
      proposal: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('computes real period-over-period deltas from createdAt timestamps (no fabricated data)', async () => {
    prisma.lead.findMany.mockResolvedValue([
      { createdAt: daysAgo(1) },
      { createdAt: daysAgo(2) },
      { createdAt: daysAgo(9) }, // previous week
      { createdAt: daysAgo(10) }, // previous week
    ]);

    const summary = await service.getSummary('tenant-1');

    expect(summary.leads.total).toBe(4);
    expect(summary.leads.last7Days).toBe(2);
    expect(summary.leads.previous7Days).toBe(2);
    expect(summary.leads.deltaPct).toBe(0);
  });

  it('returns a null delta (not a fabricated percentage) when there is no prior-period baseline', async () => {
    prisma.lead.findMany.mockResolvedValue([{ createdAt: daysAgo(1) }]);

    const summary = await service.getSummary('tenant-1');

    expect(summary.leads.last7Days).toBe(1);
    expect(summary.leads.previous7Days).toBe(0);
    expect(summary.leads.deltaPct).toBeNull();
  });

  it('excludes Won/Lost deals from the active count, case-insensitively', async () => {
    prisma.deal.findMany.mockResolvedValue([
      { createdAt: daysAgo(1), stage: 'New' },
      { createdAt: daysAgo(1), stage: 'Won' },
      { createdAt: daysAgo(1), stage: 'lost' },
      { createdAt: daysAgo(1), stage: 'Proposal' },
    ]);

    const summary = await service.getSummary('tenant-1');

    expect(summary.deals.total).toBe(4);
    expect(summary.deals.active).toBe(2);
  });

  it('groups deals by stage case-insensitively for the pipeline breakdown', async () => {
    prisma.deal.findMany.mockResolvedValue([
      { createdAt: daysAgo(1), stage: 'new' },
      { createdAt: daysAgo(1), stage: 'New' },
      { createdAt: daysAgo(1), stage: 'Contacted' },
    ]);

    const summary = await service.getSummary('tenant-1');
    const newBucket = summary.deals.byStage.find((s) => s.stage === 'new');

    expect(newBucket?.count).toBe(2);
    expect(summary.deals.byStage).toHaveLength(2);
  });

  it('counts only non-draft proposals as "sent"', async () => {
    prisma.proposal.findMany.mockResolvedValue([
      { createdAt: daysAgo(1), status: 'draft' },
      { createdAt: daysAgo(1), status: 'sent' },
      { createdAt: daysAgo(1), status: 'approved' },
    ]);

    const summary = await service.getSummary('tenant-1');

    expect(summary.proposals.total).toBe(3);
    expect(summary.proposals.sent).toBe(2);
  });

  it('buckets the weekly trend into exactly 8 weeks, including empty weeks', async () => {
    prisma.lead.findMany.mockResolvedValue([{ createdAt: daysAgo(3) }]);

    const summary = await service.getSummary('tenant-1');

    expect(summary.leads.weeklyTrend).toHaveLength(8);
    const total = summary.leads.weeklyTrend.reduce((sum, w) => sum + w.count, 0);
    expect(total).toBe(1);
  });
});
