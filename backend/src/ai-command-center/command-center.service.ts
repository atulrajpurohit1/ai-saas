import { Injectable, Logger, Optional } from '@nestjs/common';
import { AiGovernanceService } from '../ai-governance/ai-governance.service';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { RecommendationService } from '../ai-insights/recommendation.service';
import { AiActionsService } from '../ai-actions/ai-actions.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { RevenueInsightsService } from '../ai-insights/revenue-insights.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeRetrievalService } from '../knowledge-base/knowledge-retrieval.service';
import {
  CommandCenterDashboard,
  DailySummary,
  CommandCenterRiskItem,
  CommandCenterOverview,
  WorkforceHealth,
  FinancialHealthOverview,
} from './command-center.types';
import { AiRecommendation } from '../ai-insights/ai-insights.types';

@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);
  private readonly promptVersion = 'v5-phase-7';

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly revenueInsightsService: RevenueInsightsService,
    private readonly recommendationService: RecommendationService,
    private readonly aiActionsService: AiActionsService,
    private readonly aiService: AiService,
    private readonly aiMonitoringService: AiMonitoringService,
    @Optional()
    private readonly aiGovernanceService?: AiGovernanceService,
    @Optional()
    private readonly knowledgeRetrievalService?: KnowledgeRetrievalService,
  ) { }

  async getDashboard(
    tenantId: string,
    userId: string,
    userRole?: string,
  ): Promise<CommandCenterDashboard> {
    const now = new Date();

    // Fetch base insights in parallel
    const [
      opsDashboard,
      incidentInsights,
      revenueDashboard,
      schedulingOverview,
      guardsOnDuty,
      openIncidents
    ] = await Promise.all([
      this.aiInsightsService.getDashboard(tenantId, userId),
      this.aiInsightsService.getIncidentInsights(tenantId, userId),
      this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
      this.recommendationService.getSchedulingOverview(tenantId),
      this.countGuardsOnDuty(tenantId, now),
      this.countOpenIncidents(tenantId)
    ]);

    // Build unified recommendations
    const recommendations = this.buildUnifiedRecommendations(
      opsDashboard.recommendations,
      revenueDashboard.recommendations.recommendations,
      schedulingOverview.recommendations
    );
    await this.syncPendingActions(tenantId, userId, userRole, recommendations);

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
      schedulingOverview,
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
      schedulingOverview,
      recommendations
    );

    const isAiAssisted = dailySummary.source === 'ai_assisted' ||
      opsDashboard.source === 'ai_assisted' ||
      revenueDashboard.source === 'ai_assisted';

    const dashboard: CommandCenterDashboard = {
      generatedAt: now.toISOString(),
      source: isAiAssisted ? 'ai_assisted' : 'rule_based',
      overview,
      risks,
      workforce,
      financial,
      scheduling: schedulingOverview,
      recommendations,
      dailySummary
    };

    const generation = await this.aiMonitoringService.logGeneration({
      tenantId,
      createdBy: userId,
      promptVersion: this.promptVersion,
      promptKey: 'daily_summary',
      modelUsed: this.aiService.getModelName(),
      sourceModule: 'ai_command_center.dashboard',
      generatedOutput: dashboard,
      fallbackUsed: dailySummary.source !== 'ai_assisted',
      status: isAiAssisted ? 'success' : 'fallback',
    });

    return {
      ...dashboard,
      aiGenerationId: generation?.id,
      recommendations: this.aiMonitoringService.attachGenerationId(
        dashboard.recommendations,
        generation?.id,
      ),
    };
  }

  async getSummary(
    tenantId: string,
    userId: string,
    userRole?: string,
  ): Promise<DailySummary> {
    const dashboard = await this.getDashboard(tenantId, userId, userRole);
    return dashboard.dailySummary;
  }

  async getRecommendations(
    tenantId: string,
    userId: string,
    userRole?: string,
  ): Promise<AiRecommendation[]> {
    const [opsDashboard, revenueDashboard, schedulingOverview] = await Promise.all([
      this.aiInsightsService.getDashboard(tenantId, userId),
      this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
      this.recommendationService.getSchedulingOverview(tenantId),
    ]);

    const recommendations = this.buildUnifiedRecommendations(
      opsDashboard.recommendations,
      revenueDashboard.recommendations.recommendations,
      schedulingOverview.recommendations
    );
    await this.syncPendingActions(tenantId, userId, userRole, recommendations);
    return recommendations;
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

  private async syncPendingActions(
    tenantId: string,
    userId: string,
    userRole: string | undefined,
    recommendations: AiRecommendation[],
  ) {
    if (userRole !== 'admin' || recommendations.length === 0) return;

    try {
      await this.aiActionsService.syncFromRecommendations(
        tenantId,
        recommendations,
        userId,
      );
    } catch (error) {
      this.logger.warn(`Failed to sync AI actions: ${error}`);
    }
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
    schedulingOverview: Awaited<ReturnType<RecommendationService['getSchedulingOverview']>>,
    guardsOnDuty: number,
    openIncidents: number
  ): CommandCenterOverview {
    const activeClients = opsDashboard.clients.rows.filter((c: any) => c.active).length;
    const totalClients = opsDashboard.clients.rows.length;
    const activeSites = opsDashboard.sites.rows.length; // Approximate, using total sites for now
    const totalGuards = opsDashboard.guards.rows.length;

    const outstandingInvoices = opsDashboard.billing.rows.reduce(
      (sum: number, row: any) =>
        sum + (row.outstandingAmount > 0 ? row.invoiceCount : 0),
      0,
    );
    const outstandingAmount = opsDashboard.billing.rows.reduce(
      (sum: number, row: any) => sum + row.outstandingAmount,
      0,
    );

    const revenueForecast = revenueDashboard.forecast.nextMonthRevenue;

    const staffingAlerts = schedulingOverview.coverageGaps;
    const coverageGaps = opsDashboard.sites.summary.find((m: any) => m.label === 'Coverage issues')?.value || 0;

    return {
      activeClients,
      totalClients,
      activeSites,
      guardsOnDuty,
      totalGuards,
      openIncidents,
      outstandingInvoices,
      outstandingAmount,
      revenueForecast,
      revenueForecastLabel: 'Next Month Forecast',
      staffingAlerts,
      coverageGaps: schedulingOverview.shortageSlots ||
        (typeof coverageGaps === 'number' ? coverageGaps : parseInt(coverageGaps) || 0),
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
        riskLevel: c.healthStatus === 'High Risk' ? 'critical' : 'high',
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
    revenueRecs: AiRecommendation[],
    schedulingRecs: AiRecommendation[] = []
  ): AiRecommendation[] {
    const all = [...(opsRecs || []), ...(revenueRecs || []), ...(schedulingRecs || [])];

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
    schedulingOverview: Awaited<ReturnType<RecommendationService['getSchedulingOverview']>>,
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
      staffingSummary: `Operating with ${overview.guardsOnDuty} guards currently on duty across ${overview.activeSites} active sites. ${schedulingOverview.shortageSlots} upcoming guard slots need coverage.`,
      financeSummary: `Next month's revenue forecast is ${financial.forecastedRevenue}. Monitoring a disputed amount of ${financial.disputedAmount}.`,
      topRecommendations: recommendations.slice(0, 3).map(r => r.action),
      aiNarrative: '',
      source: 'rule_based' as const
    };

    try {
      const feedbackSummary =
        await this.aiMonitoringService.getFeedbackSummaryForPrompt(tenantId);
      const organizationalMemory = await this.knowledgeRetrievalService?.retrieveRelevant({
        tenantId,
        sourceModule: 'ai_command_center.dashboard',
        categories: ['operations', 'incidents', 'staffing', 'billing', 'client_management', 'scheduling'],
        query: [
          fallbackSummary.incidentSummary,
          fallbackSummary.attendanceSummary,
          fallbackSummary.staffingSummary,
          fallbackSummary.financeSummary,
          ...fallbackSummary.topRecommendations,
        ].join(' '),
        limit: 8,
      });
      // Create a simplified context for the AI prompt
      const context = {
        activeClients: overview.activeClients,
        guardsOnDuty: overview.guardsOnDuty,
        openIncidents: overview.openIncidents,
        criticalRisks: risks.totalCritical,
        attendanceRate: workforce.overallAttendanceRate,
        revenueForecast: financial.forecastedRevenue,
        outstandingBalance: financial.outstandingBalance,
        upcomingCoverageGaps: schedulingOverview.coverageGaps,
        upcomingShortageSlots: schedulingOverview.shortageSlots,
        topRecommendations: recommendations.slice(0, 3).map(r => r.action),
        adminFeedbackHistory: feedbackSummary.summaryText,
        organizationalMemory: organizationalMemory?.map((entry) => ({
          title: entry.title,
          category: entry.category,
          summary: entry.summary,
          tags: entry.tags,
        })) || [],
      };

      const aiNarrative = await this.aiService.generateIncidentRiskSummary(
        JSON.stringify(context),
        await this.resolvePromptTemplate(
          tenantId,
          'ai_command_center.dashboard',
          'daily_summary',
        ),
      );

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

  private async resolvePromptTemplate(
    tenantId: string,
    moduleName: string,
    promptKey: string,
  ) {
    return (
      await this.aiGovernanceService?.resolvePromptVersion({
        tenantId,
        moduleName,
        promptKey,
        fallbackVersion: this.promptVersion,
      })
    )?.promptText ?? null;
  }
}
