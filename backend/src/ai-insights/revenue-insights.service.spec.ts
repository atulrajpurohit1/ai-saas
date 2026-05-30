import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueInsightsService } from './revenue-insights.service';

describe('RevenueInsightsService', () => {
  let service: RevenueInsightsService;
  let prisma: {
    client: { findMany: jest.Mock };
    invoice: { findMany: jest.Mock };
    rateCard: { findMany: jest.Mock };
    incident: { findMany: jest.Mock };
  };
  let aiService: {
    generateRevenueFinancialRecommendations: jest.Mock;
    generateRevenueIntelligenceSummary: jest.Mock;
  };
  let auditService: {
    log: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const userId = 'user-1';

  beforeEach(() => {
    prisma = {
      client: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      rateCard: { findMany: jest.fn().mockResolvedValue([]) },
      incident: { findMany: jest.fn().mockResolvedValue([]) },
    };
    aiService = {
      generateRevenueFinancialRecommendations: jest.fn().mockResolvedValue(null),
      generateRevenueIntelligenceSummary: jest.fn().mockResolvedValue(null),
    };
    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new RevenueInsightsService(
      prisma as unknown as PrismaService,
      aiService as unknown as AiService,
      auditService as unknown as AuditService,
    );
  });

  it('scopes revenue intelligence queries to the current tenant and writes audit events', async () => {
    const result = await service.getRevenueDashboard(tenantId, userId);

    expect(result.source).toBe('rule_based');
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } }),
    );
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
    expect(prisma.rateCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } }),
    );
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'AI_REVENUE_DASHBOARD_VIEWED',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'AI_REVENUE_FORECAST_GENERATED',
      }),
    );
  });

  it('builds rule-based forecasts, contract health, renewals, and recommendations from invoice history', async () => {
    const now = new Date();
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10),
    );
    const previousMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 10),
    );
    const dueDate = new Date(now);
    dueDate.setUTCDate(dueDate.getUTCDate() - 45);
    const renewalDate = new Date(now);
    renewalDate.setUTCDate(renewalDate.getUTCDate() + 30);

    prisma.client.findMany.mockResolvedValue([
      {
        id: 'client-abc',
        name: 'ABC',
        companyName: 'ABC Security',
        createdAt: previousMonth,
        _count: {
          sites: 1,
          invoices: 3,
          rateCards: 1,
          deals: 0,
          proposals: 0,
        },
      },
    ]);
    prisma.invoice.findMany.mockResolvedValue([
      invoiceFixture({
        id: 'invoice-1',
        status: 'paid',
        amount: 1000,
        issuedAt: previousMonth,
        paidAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 20),
        ),
      }),
      invoiceFixture({
        id: 'invoice-2',
        status: 'paid',
        amount: 2000,
        issuedAt: lastMonth,
        paidAt: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 25),
        ),
      }),
      invoiceFixture({
        id: 'invoice-3',
        status: 'issued',
        amount: 500,
        issuedAt: lastMonth,
        dueDate,
      }),
    ]);
    prisma.rateCard.findMany.mockResolvedValue([
      {
        id: 'rate-1',
        clientId: 'client-abc',
        siteId: 'site-1',
        roleName: 'Standard guard',
        hourlyRate: 50,
        effectiveFrom: previousMonth,
        effectiveTo: renewalDate,
        status: 'active',
        createdAt: previousMonth,
        client: {
          name: 'ABC',
          companyName: 'ABC Security',
        },
        site: {
          name: 'Site A',
        },
      },
    ]);

    const result = await service.getRevenueDashboard(tenantId, userId);

    expect(result.forecast.nextMonthRevenue).toBeGreaterThan(0);
    expect(result.contracts.rows[0]).toEqual(
      expect.objectContaining({
        clientId: 'client-abc',
        name: 'ABC Security',
        activeContract: true,
      }),
    );
    expect(result.renewals.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId: 'client-abc',
          type: 'renewal_due',
        }),
      ]),
    );
    expect(result.recommendations.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'revenue-rule-overdue-invoices',
          source: 'rule',
        }),
      ]),
    );
  });

  function invoiceFixture(input: {
    id: string;
    status: string;
    amount: number;
    issuedAt: Date;
    paidAt?: Date;
    dueDate?: Date;
  }) {
    return {
      id: input.id,
      clientId: 'client-abc',
      siteId: 'site-1',
      invoiceNumber: input.id,
      status: input.status,
      totalAmount: input.amount,
      billingStartDate: input.issuedAt,
      billingEndDate: input.issuedAt,
      issuedAt: input.issuedAt,
      paidAt: input.paidAt || null,
      dueDate: input.dueDate || null,
      createdAt: input.issuedAt,
      client: {
        name: 'ABC',
        companyName: 'ABC Security',
      },
      site: {
        id: 'site-1',
        name: 'Site A',
      },
      disputes: [],
    };
  }
});
