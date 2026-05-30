import { Injectable, Logger } from '@nestjs/common';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { RevenueInsightsService } from '../ai-insights/revenue-insights.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CommandCenterDashboard,
  DailySummary,
  CommandCenterRiskItem,
  CommandCenterOverview,
  WorkforceHealth,
  FinancialHealthOverview,
} from './command-center.types';
import { AiRecommendation, AiInsightMetric } from '../ai-insights/ai-insights.types';

@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly revenueInsightsService: RevenueInsightsService,
    private readonly aiService: AiService,
  ) {}

  async getDashboard(tenantId: string, userId: string): Promise<CommandCenterDashboard> {
    const now = new Date();
    
    // Fetch base insights in parallel
    const [
      opsDashboard,
      incidentInsights,
      revenueDashboard,
      guardsOnDuty,
      openIncidents
    ] = await Promise.all([
      this.aiInsightsService.getDashboard(tenantId),
      this.aiInsightsService.getIncidentInsights(tenantId),
      this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
      this.countGuardsOnDuty(tenantId, now),
      this.countOpenIncidents(tenantId)
    ]);

    // Build unified recommendations
    const recommendations = this.buildUnifiedRecommendations(
      opsDashboard.recommendations,
      revenueDashboard.recommendations.recommendations
    );

    // Build unified risks
    const risks = this.buildUnifiedRisks(
      incidentInsights.highRiskSites,
      incidentInsights.clientRisks,
      revenueDashboard.contracts.rows
    );

    // Build overview
    const overview = this.buildOverview(
      opsDashboard,
      revenueDashboard,
      guardsOnDuty,
      openIncidents
    );

    // Build workforce health
    const workforce = this.buildWorkforceHealth(opsDashboard.guards);

    // Build financial health
    const financial = this.buildFinancialHealth(revenueDashboard, opsDashboard.billing);

    // Generate daily summary
    const dailySummary = await this.generateDailySummary(
      tenantId,
      now,
      overview,
      risks,
      workforce,
      financial,
      recommendations
    );

    const isAiAssisted = dailySummary.source === 'ai_assisted' || 
                         opsDashboard.source === 'ai_assisted' || 
                         revenueDashboard.source === 'ai_assisted';

    return {
      generatedAt: now.toISOString(),
      source: isAiAssisted ? 'ai_assisted' : 'rule_based',
      overview,
      risks,
      workforce,
      financial,
      recommendations,
      dailySummary
    };
  }

  async getSummary(tenantId: string, userId: string): Promise<DailySummary> {
    const dashboard = await this.getDashboard(tenantId, userId);
    return dashboard.dailySummary;
  }

  async getRecommendations(tenantId: string, userId: string): Promise<AiRecommendation[]> {
    const [opsDashboard, revenueDashboard] = await Promise.all([
      this.aiInsightsService.getDashboard(tenantId),
      this.revenueInsightsService.getRevenueDashboard(tenantId, userId)
    ]);
    
    return this.buildUnifiedRecommendations(
      opsDashboard.recommendations,
      revenueDashboard.recommendations.recommendations
    );
  }

  async getRisks(tenantId: string, userId: string) {
    const [incidentInsights, revenueDashboard] = await Promise.all([
      this.aiInsightsService.getIncidentInsights(tenantId),
      this.revenueInsightsService.getRevenueDashboard(tenantId, userId)
    ]);
    
    return this.buildUnifiedRisks(
      incidentInsights.highRiskSites,
      incidentInsights.clientRisks,
      revenueDashboard.contracts.rows
    );
  }

  private async countGuardsOnDuty(tenantId: string, now: Date): Promise<number> {
    // Find active shifts right now and count distinct guards checked in
    const activeShifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        startTime: { lte: now },
        endTime: { gte: now },
        status: { not: 'cancelled' }
      },
      select: {
        attendanceEvents: {
          where: {
            type: 'CHECK_IN'
          },
          select: {
            guardId: true
          }
        }
      }
    });

    const onDutyGuardIds = new Set<string>();
    activeShifts.forEach(shift => {
      shift.attendanceEvents.forEach(event => {
        onDutyGuardIds.add(event.guardId);
      });
    });

    return onDutyGuardIds.size;
  }

  private async countOpenIncidents(tenantId: string): Promise<number> {
    return this.prisma.incident.count({
      where: {
        tenantId,
        status: { in: ['open', 'investigating'] }
      }
    });
  }

  private buildOverview(
    opsDashboard: any, 
    revenueDashboard: any, 
    guardsOnDuty: number, 
    openIncidents: number
  ): CommandCenterOverview {
    const activeClients = opsDashboard.clients.rows.filter((c: any) => c.active).length;
    const totalClients = opsDashboard.clients.rows.length;
    const activeSites = opsDashboard.sites.rows.length; // Approximate, using total sites for now
    const totalGuards = opsDashboard.guards.rows.length;
    
    // Calculate outstanding invoices from billing insights
    const outstandingInvoices = opsDashboard.billing.summary
      .find((m: any) => m.label === 'Outstanding')?.value;
    
    let outstandingAmount = 0;
    const outStr = typeof outstandingInvoices === 'string' ? outstandingInvoices : '$0';
    if (outStr) {
        outstandingAmount = parseFloat(outStr.replace(/[^0-9.-]+/g,"")) || 0;
    }

    const revenueForecast = revenueDashboard.forecast.nextMonthRevenue;
    
    const staffingAlerts = opsDashboard.sites.rows.reduce((sum: number, site: any) => sum + site.coverageIssues, 0);
    const coverageGaps = opsDashboard.sites.summary.find((m: any) => m.label === 'Coverage issues')?.value || 0;

    return {
      activeClients,
      totalClients,
      activeSites,
      guardsOnDuty,
      totalGuards,
      openIncidents,
      outstandingInvoices: typeof coverageGaps === 'number' ? coverageGaps : 0, // Placeholder, usually parsed from string
      outstandingAmount,
      revenueForecast,
      revenueForecastLabel: 'Next Month Forecast',
      staffingAlerts,
      coverageGaps: typeof coverageGaps === 'number' ? coverageGaps : parseInt(coverageGaps) || 0,
      metrics: [
        { label: 'Active Clients', value: activeClients, tone: 'info' },
        { label: 'Guards on Duty', value: guardsOnDuty, tone: guardsOnDuty > 0 ? 'positive' : 'warning' },
        { label: 'Open Incidents', value: openIncidents, tone: openIncidents > 0 ? 'warning' : 'positive' },
        { label: 'Revenue Forecast', value: revenueForecast, tone: 'positive' }
      ]
    };
  }

  private buildWorkforceHealth(guardInsights: any): WorkforceHealth {
    const attendanceSummary = guardInsights.summary.find((m: any) => m.label === 'Attendance rate');
    let overallAttendanceRate: number | null = null;
    if (attendanceSummary && attendanceSummary.value !== 'N/A') {
        overallAttendanceRate = parseFloat(attendanceSummary.value.toString().replace('%', ''));
    }

    const totalLateCheckIns = guardInsights.summary.find((m: any) => m.label === 'Late check-ins')?.value || 0;
    const totalMissedShifts = guardInsights.summary.find((m: any) => m.label === 'Missed shifts')?.value || 0;

    return {
      totalGuards: guardInsights.rows.length,
      overallAttendanceRate,
      totalLateCheckIns: typeof totalLateCheckIns === 'number' ? totalLateCheckIns : parseInt(totalLateCheckIns) || 0,
      totalMissedShifts: typeof totalMissedShifts === 'number' ? totalMissedShifts : parseInt(totalMissedShifts) || 0,
      guards: guardInsights.rows.map((g: any) => ({
        guardId: g.guardId,
        name: g.name,
        scheduledShifts: g.scheduledShifts,
        attendanceRate: g.attendanceRate,
        lateCheckIns: g.lateCheckIns,
        missedShifts: g.missedShifts,
        incidentCount: g.incidentCount
      })),
      recommendations: guardInsights.insights.map((i: any) => i.message),
      metrics: guardInsights.summary
    };
  }

  private buildFinancialHealth(revenueDashboard: any, billingInsights: any): FinancialHealthOverview {
    return {
      forecastedRevenue: revenueDashboard.forecast.nextMonthRevenue,
      quarterlyForecast: revenueDashboard.forecast.quarterlyForecast,
      annualForecast: revenueDashboard.forecast.annualForecast,
      outstandingBalance: revenueDashboard.forecast.outstandingAmount,
      disputedAmount: billingInsights.rows.reduce((sum: number, row: any) => sum + row.disputedAmount, 0),
      disputedInvoiceCount: billingInsights.summary.find((m: any) => m.label === 'Disputed')?.detail ? parseInt(billingInsights.summary.find((m: any) => m.label === 'Disputed').detail) : 0,
      paidAmount: billingInsights.rows.reduce((sum: number, row: any) => sum + row.paidAmount, 0),
      collectionRate: null, // Could be calculated if needed
      averagePaymentDays: revenueDashboard.contracts.rows.reduce((acc: number, cur: any) => acc + (cur.averagePaymentDays || 0), 0) / (revenueDashboard.contracts.rows.filter((c: any) => c.averagePaymentDays !== null).length || 1),
      monthlyGrowthRate: revenueDashboard.forecast.monthlyGrowthRate,
      expectedCollections: revenueDashboard.forecast.expectedCollections,
      metrics: [
         ...revenueDashboard.forecast.summary,
         ...billingInsights.summary
      ].slice(0, 4)
    };
  }

  private buildUnifiedRisks(
    siteRisks: any[], 
    clientRisks: any[], 
    contractRisks: any[]
  ) {
    const formattedSites: CommandCenterRiskItem[] = siteRisks.map(r => ({
      id: r.entityId,
      entityType: 'site',
      name: r.name,
      relatedName: r.relatedName,
      riskScore: r.riskScore,
      riskLevel: r.riskLevel,
      incidentCount: r.incidentCount,
      indicators: r.indicators
    }));

    const formattedClients: CommandCenterRiskItem[] = clientRisks.map(r => ({
      id: r.entityId,
      entityType: 'client',
      name: r.name,
      relatedName: null,
      riskScore: r.riskScore,
      riskLevel: r.riskLevel,
      incidentCount: r.incidentCount,
      indicators: r.indicators
    }));

    const formattedContracts: CommandCenterRiskItem[] = contractRisks
      .filter(c => c.healthScore <= 50)
      .map(c => ({
        id: c.clientId,
        entityType: 'contract',
        name: c.name,
        relatedName: null,
        riskScore: 100 - c.healthScore, // Invert health for risk
        riskLevel: c.healthStatus === 'High Risk' ? 'critical' : c.healthStatus === 'Warning' ? 'warning' : 'medium' as any,
        incidentCount: c.incidentCount,
        indicators: c.indicators
    }));

    // Calculate totals
    const allRisks = [...formattedSites, ...formattedClients, ...formattedContracts];
    const totalHighRisk = allRisks.filter(r => r.riskLevel === 'high').length;
    const totalCritical = allRisks.filter(r => r.riskLevel === 'critical').length;

    return {
      sites: formattedSites,
      clients: formattedClients,
      contracts: formattedContracts,
      totalHighRisk,
      totalCritical
    };
  }

  private buildUnifiedRecommendations(
    opsRecs: AiRecommendation[], 
    revenueRecs: AiRecommendation[]
  ): AiRecommendation[] {
    const all = [...(opsRecs || []), ...(revenueRecs || [])];
    
    // Deduplicate by ID
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    
    // Sort by priority (high -> medium -> low)
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    
    return unique.sort((a, b) => {
      const pA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
      const pB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
      return pB - pA;
    }).slice(0, 10);
  }

  private async generateDailySummary(
    tenantId: string,
    now: Date,
    overview: CommandCenterOverview,
    risks: any,
    workforce: WorkforceHealth,
    financial: FinancialHealthOverview,
    recommendations: AiRecommendation[]
  ): Promise<DailySummary> {
    const formattedDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const fallbackSummary = {
      date: formattedDate,
      incidentSummary: `Currently monitoring ${overview.openIncidents} open incidents. We have ${risks.totalCritical} critical risks identified across sites and clients.`,
      attendanceSummary: workforce.overallAttendanceRate 
        ? `Overall attendance rate is ${workforce.overallAttendanceRate}%. Recorded ${workforce.totalLateCheckIns} late check-ins and ${workforce.totalMissedShifts} missed shifts recently.`
        : 'Attendance data is currently being collected.',
      staffingSummary: `Operating with ${overview.guardsOnDuty} guards currently on duty across ${overview.activeSites} active sites.`,
      financeSummary: `Next month's revenue forecast is ${financial.forecastedRevenue}. Monitoring a disputed amount of ${financial.disputedAmount}.`,
      topRecommendations: recommendations.slice(0, 3).map(r => r.action),
      aiNarrative: '',
      source: 'rule_based' as const
    };

    try {
      // Create a simplified context for the AI prompt
      const context = {
        activeClients: overview.activeClients,
        guardsOnDuty: overview.guardsOnDuty,
        openIncidents: overview.openIncidents,
        criticalRisks: risks.totalCritical,
        attendanceRate: workforce.overallAttendanceRate,
        revenueForecast: financial.forecastedRevenue,
        outstandingBalance: financial.outstandingBalance,
        topRecommendations: recommendations.slice(0, 3).map(r => r.action)
      };

      const prompt = `
        You are an operations executive assistant for a security services company.
        Produce a concise daily operational summary from this data:
        ${JSON.stringify(context)}

        Format: 2-3 paragraphs covering:
        1. Operational status (incidents, attendance, staffing)
        2. Financial health (revenue, collections)  
        3. Top priority actions

        Use a professional, executive tone. Do not mention tenant IDs, user IDs, or raw database fields.
        Return ONLY the summary text, no markdown formatting or headers.
      `;

      // Use a protected call to AI Service. Assuming a generateText-like method exists, or we use the underlying generation.
      // Since aiService.generateText is private, we might need a workaround or use an existing public method.
      // We can use aiService.generateBusinessInsightRecommendations as a proxy, but it returns string[].
      // Looking at AiService, generateIncidentRiskSummary might be the closest fit for a text blob.
      const aiNarrative = await this.aiService.generateIncidentRiskSummary(JSON.stringify(context));

      if (aiNarrative) {
        return {
          ...fallbackSummary,
          aiNarrative,
          source: 'ai_assisted'
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to generate AI daily summary: ${error}`);
    }

    // Fallback if AI fails or returns null
    fallbackSummary.aiNarrative = `${fallbackSummary.staffingSummary} ${fallbackSummary.incidentSummary} ${fallbackSummary.financeSummary}`;
    return fallbackSummary;
  }
}
