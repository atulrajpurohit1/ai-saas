import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiInsightsService } from './ai-insights.service';
import {
  BillingInsightsResponse,
  ClientInsightsResponse,
  GuardInsightsResponse,
  SiteInsightsResponse,
} from './ai-insights.types';

describe('AiInsightsService', () => {
  let service: AiInsightsService;
  let prisma: {
    client: { findMany: jest.Mock };
    invoice: { findMany: jest.Mock };
    incident: { findMany: jest.Mock };
    guard: { findMany: jest.Mock };
    shift: { findMany: jest.Mock };
    site: { findMany: jest.Mock };
  };
  let aiService: {
    generateBusinessInsightRecommendations: jest.Mock;
    generateIncidentRiskSummary: jest.Mock;
  };

  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = {
      client: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      incident: { findMany: jest.fn().mockResolvedValue([]) },
      guard: { findMany: jest.fn().mockResolvedValue([]) },
      shift: { findMany: jest.fn().mockResolvedValue([]) },
      site: { findMany: jest.fn().mockResolvedValue([]) },
    };
    aiService = {
      generateBusinessInsightRecommendations: jest.fn().mockResolvedValue(null),
      generateIncidentRiskSummary: jest.fn().mockResolvedValue(null),
    };
    service = new AiInsightsService(
      prisma as unknown as PrismaService,
      aiService as unknown as AiService,
    );
  });

  it('scopes every section query to the current tenant', async () => {
    await service.getClientInsights(tenantId);
    await service.getGuardInsights(tenantId);
    await service.getSiteInsights(tenantId);
    await service.getBillingInsights(tenantId);
    await service.getIncidentInsights(tenantId);

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } }),
    );
    expect(prisma.guard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } }),
    );
    expect(prisma.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } }),
    );
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  it('summarizes client revenue and incident frequency', async () => {
    const now = new Date();
    const currentMonthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    prisma.client.findMany.mockResolvedValue([
      {
        id: 'client-abc',
        name: 'ABC',
        companyName: 'Client ABC',
        createdAt: currentMonthDate,
        _count: {
          sites: 1,
          invoices: 1,
          proposals: 1,
          deals: 0,
          rateCards: 1,
        },
      },
      {
        id: 'client-xyz',
        name: 'XYZ',
        companyName: 'Client XYZ',
        createdAt: currentMonthDate,
        _count: {
          sites: 1,
          invoices: 0,
          proposals: 0,
          deals: 0,
          rateCards: 0,
        },
      },
    ]);
    prisma.invoice.findMany.mockResolvedValue([
      {
        clientId: 'client-abc',
        totalAmount: 1000,
        status: 'issued',
        issuedAt: currentMonthDate,
        createdAt: currentMonthDate,
      },
    ]);
    prisma.incident.findMany.mockResolvedValue([
      {
        id: 'incident-1',
        severity: 'high',
        site: { clientId: 'client-xyz' },
      },
      {
        id: 'incident-2',
        severity: 'medium',
        site: { clientId: 'client-xyz' },
      },
    ]);

    const result = await service.getClientInsights(tenantId);

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        clientId: 'client-abc',
        revenue: 1000,
        revenueShare: 100,
      }),
    );
    expect(result.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'clients-top-revenue',
          message: 'Client ABC generated 100% of monthly revenue.',
        }),
        expect.objectContaining({
          id: 'clients-high-incidents',
          subject: 'Client XYZ',
        }),
      ]),
    );
  });

  it('falls back to rule-based dashboard recommendations when AI is unavailable', async () => {
    jest
      .spyOn(service, 'getClientInsights')
      .mockResolvedValue(section<ClientInsightsResponse['rows'][number]>([
        {
          clientId: 'client-1',
          name: 'Client B',
          active: true,
          revenue: 0,
          revenueShare: 0,
          incidentCount: 2,
          contractActivity: 1,
          siteCount: 1,
        },
      ]));
    jest
      .spyOn(service, 'getGuardInsights')
      .mockResolvedValue(section<GuardInsightsResponse['rows'][number]>([
        {
          guardId: 'guard-1',
          name: 'Guard Smith',
          scheduledShifts: 4,
          attendanceRecords: 1,
          attendanceRate: 25,
          lateCheckIns: 0,
          missedShifts: 3,
          incidentCount: 0,
        },
      ]));
    jest
      .spyOn(service, 'getSiteInsights')
      .mockResolvedValue(section<SiteInsightsResponse['rows'][number]>([
        {
          siteId: 'site-1',
          name: 'Site A',
          clientName: 'Client B',
          scheduledShifts: 4,
          incidentCount: 3,
          incidentRate: 75,
          coverageIssues: 2,
          shortageSlots: 2,
          attendanceRate: 50,
        },
      ]));
    jest
      .spyOn(service, 'getBillingInsights')
      .mockResolvedValue(section<BillingInsightsResponse['rows'][number]>([
        {
          clientId: 'client-1',
          name: 'Client B',
          revenue: 1000,
          paidAmount: 0,
          outstandingAmount: 1000,
          disputedAmount: 0,
          invoiceCount: 1,
        },
      ]));

    const result = await service.getDashboard(tenantId);

    expect(result.source).toBe('rule_based');
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'Increase staffing or supervision at Site A.',
          source: 'rule',
        }),
        expect.objectContaining({
          action: 'Review attendance with Guard Smith.',
          source: 'rule',
        }),
        expect.objectContaining({
          action: 'Follow up with Client B on unpaid invoices.',
          source: 'rule',
        }),
      ]),
    );
  });

  it('scores incident risk by severity, repeated site incidents, and recent frequency', async () => {
    const recent = new Date();

    prisma.incident.findMany.mockResolvedValue([
      incidentFixture({
        id: 'incident-critical',
        severity: 'critical',
        occurredAt: recent,
      }),
      incidentFixture({
        id: 'incident-high',
        severity: 'high',
        occurredAt: recent,
      }),
    ]);

    const result = await service.getIncidentInsights(tenantId);

    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
    expect(result.source).toBe('rule_based');
    expect(result.highRiskSites[0]).toEqual(
      expect.objectContaining({
        entityId: 'site-1',
        name: 'Site A',
        riskScore: 85,
        riskLevel: 'critical',
        incidentCount: 2,
        recent7DayCount: 2,
        repeatedIncidentTypes: 1,
      }),
    );
    expect(result.recurringIncidentTypes[0]).toEqual(
      expect.objectContaining({
        label: 'Access control',
        count: 2,
      }),
    );
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'Increase supervision at Site A.',
        }),
      ]),
    );
  });

  function section<T>(rows: T[]) {
    return {
      generatedAt: new Date().toISOString(),
      summary: [],
      insights: [],
      rows,
    };
  }

  function incidentFixture(input: {
    id: string;
    severity: string;
    occurredAt: Date;
  }) {
    return {
      id: input.id,
      title: 'Unauthorized access at gate',
      description: 'Unauthorized access attempt at the front gate.',
      severity: input.severity,
      status: 'approved',
      occurredAt: input.occurredAt,
      site: {
        id: 'site-1',
        name: 'Site A',
        clientId: 'client-1',
        client: {
          id: 'client-1',
          name: 'Client A',
          companyName: null,
        },
      },
      guard: {
        id: 'guard-1',
        name: 'Guard John',
      },
      shift: {
        id: 'shift-1',
        startTime: input.occurredAt,
        endTime: input.occurredAt,
      },
    };
  }
});
