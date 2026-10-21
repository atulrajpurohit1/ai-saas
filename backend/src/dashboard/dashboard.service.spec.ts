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

  describe('getRecentActivity', () => {
    it('asks the database for only a handful of rows per table, not the whole table', async () => {
      await service.getRecentActivity('tenant-1');

      // The point of the endpoint: the dashboard used to pull every lead, deal
      // and proposal the tenant owned in order to render five lines.
      for (const table of [prisma.lead, prisma.deal, prisma.proposal]) {
        expect(table.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { tenantId: 'tenant-1' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        );
      }
    });

    it('merges the three sources into one list ordered newest first', async () => {
      prisma.lead.findMany.mockResolvedValue([
        { id: 'l1', name: 'Ada', company: 'Acme', createdAt: daysAgo(1) },
      ]);
      prisma.deal.findMany.mockResolvedValue([
        { id: 'd1', name: 'Renewal', createdAt: daysAgo(3), lead: { company: 'Acme' } },
      ]);
      prisma.proposal.findMany.mockResolvedValue([
        { id: 'p1', title: 'Q4 Proposal', createdAt: daysAgo(2), lead: { company: 'Acme' } },
      ]);

      const activity = await service.getRecentActivity('tenant-1');

      expect(activity.map((a) => a.id)).toEqual(['lead-l1', 'proposal-p1', 'deal-d1']);
      expect(activity[0]).toMatchObject({ kind: 'lead', subject: 'Acme' });
    });

    it('caps the merged list even when every table returns a full page', async () => {
      const rows = (prefix: string) =>
        Array.from({ length: 5 }, (_, i) => ({
          id: `${prefix}${i}`,
          name: prefix,
          title: prefix,
          company: 'Acme',
          createdAt: daysAgo(i + 1),
          lead: { company: 'Acme' },
        }));
      prisma.lead.findMany.mockResolvedValue(rows('l'));
      prisma.deal.findMany.mockResolvedValue(rows('d'));
      prisma.proposal.findMany.mockResolvedValue(rows('p'));

      await expect(service.getRecentActivity('tenant-1')).resolves.toHaveLength(5);
    });

    it('falls back to the linked company when a deal or proposal has no name of its own', async () => {
      prisma.deal.findMany.mockResolvedValue([
        { id: 'd1', name: '', createdAt: daysAgo(1), lead: { company: 'Acme' } },
      ]);
      prisma.proposal.findMany.mockResolvedValue([
        { id: 'p1', title: '', createdAt: daysAgo(2), lead: null },
      ]);

      const activity = await service.getRecentActivity('tenant-1');

      expect(activity.find((a) => a.id === 'deal-d1')?.subject).toBe('Acme');
      expect(activity.find((a) => a.id === 'proposal-p1')?.subject).toBe('Proposal');
    });
  });
});
