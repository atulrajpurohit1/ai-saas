import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiDiscoveryCallIntelligenceDraft,
  AiDiscoveryGuideDraft,
  AiOutreachDraft,
  AiSalesAssessmentDraft,
  AiService,
} from '../ai/ai.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { AuditService } from '../audit/audit.service';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from '../proposals/proposals.service';
import { AnalyzeDiscoveryCallDto } from './dto/analyze-discovery-call.dto';
import { CreateFollowUpTaskDto } from './dto/create-follow-up-task.dto';
import { GenerateDiscoveryProposalDto } from './dto/generate-discovery-proposal.dto';
import { SaveDiscoveryDto } from './dto/save-discovery.dto';

type SalesEntityType = 'lead' | 'deal';

interface SalesEntityContext {
  entityType: SalesEntityType;
  lead: {
    id: string;
    name: string;
    company: string;
    email: string | null;
    status: string;
    createdAt: Date;
    notes?: Array<{ content: string; createdAt: Date }>;
    proposals?: Array<{ title: string; status: string; createdAt: Date }>;
  };
  deal?: {
    id: string;
    name: string;
    stage: string;
    createdAt: Date;
    notes?: Array<{ content: string; createdAt: Date }>;
    proposals?: Array<{ title: string; status: string; createdAt: Date }>;
    client?: { id: string; name: string; companyName: string | null } | null;
  };
  discovery?: DiscoverySnapshot | null;
  assessment?: AiSalesAssessmentDraft | null;
}

export interface ActivitySnapshot {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
}

interface DealMomentumContext {
  id: string;
  name: string;
  stage: string;
  createdAt: Date;
  activities?: ActivitySnapshot[];
  discoverySessions?: Array<{ id: string; createdAt: Date }>;
}

interface DealMomentumAssessment {
  closeReadinessScore: number | null;
  discoveryQualityScore: number | null;
  recommendedNextAction?: string | null;
}

interface AssessmentSnapshot {
  id: string;
  leadScore: number | null;
  priorityTier: string | null;
  closeReadinessScore: number | null;
  discoveryQualityScore: number | null;
  recommendedNextAction: string | null;
  summary?: string | null;
  createdAt: Date;
}

export interface DealMomentum {
  status: 'healthy' | 'watch' | 'stalled' | 'urgent' | 'closed';
  score: number;
  daysOpen: number;
  daysSinceActivity: number | null;
  overdueActivityCount: number;
  pendingActivityCount: number;
  nextActivity: ActivitySnapshot | null;
  lastActivity: ActivitySnapshot | null;
  reasons: string[];
  recommendedAction: string;
}

export interface ForecastHistoryPoint {
  id: string;
  score: number | null;
  discoveryQualityScore: number | null;
  createdAt: Date;
}

export interface DealForecast {
  status: 'commit' | 'likely' | 'watch' | 'at_risk' | 'unscored' | 'closed_won' | 'closed_lost';
  label: string;
  confidence: number;
  probability: number;
  currentReadiness: number | null;
  previousReadiness: number | null;
  readinessChange: number | null;
  trend: 'improving' | 'flat' | 'declining' | 'unknown';
  history: ForecastHistoryPoint[];
  reasons: string[];
  recommendedAction: string;
}

export interface ObjectionPattern {
  key: string;
  label: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  examples: string[];
  recommendedResponse: string;
  playbook: string[];
  relatedLeads: Array<{
    id: string;
    name: string;
    company: string;
    status: string;
  }>;
  relatedDeals: Array<{
    id: string;
    name: string;
    stage: string;
    company: string;
  }>;
}

interface DiscoverySnapshot {
  id: string;
  propertyType: string | null;
  buyerRole: string | null;
  currentProvider: string | null;
  guardCount: number | null;
  serviceHours: string | null;
  painPoints: string[];
  riskConcerns: string[];
  decisionTimeline: string | null;
  budgetSensitivity: string | null;
  objections: string[];
  notes: string | null;
  createdAt: Date;
}

@Injectable()
export class SalesAcceleratorService {
  private readonly logger = new Logger(SalesAcceleratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly aiMonitoringService: AiMonitoringService,
    private readonly auditService: AuditService,
    private readonly activitiesService: ActivitiesService,
    private readonly proposalsService: ProposalsService,
  ) {}

  async getDashboard(tenantId: string) {
    const [
      leads,
      deals,
      recentAssessments,
      discoveryObjections,
      assessmentObjections,
    ] = await Promise.all([
      this.prisma.lead.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          company: true,
          status: true,
          createdAt: true,
          discoverySessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, createdAt: true },
          },
          salesAssessments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              leadScore: true,
              priorityTier: true,
              closeReadinessScore: true,
              discoveryQualityScore: true,
              riskProfile: true,
              proposalAngle: true,
              recommendedNextAction: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.deal.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          stage: true,
          createdAt: true,
          lead: { select: { id: true, name: true, company: true } },
          client: { select: { id: true, name: true, companyName: true } },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              type: true,
              subject: true,
              status: true,
              dueDate: true,
              createdAt: true,
            },
          },
          discoverySessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, createdAt: true },
          },
          salesAssessments: {
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: {
              id: true,
              leadScore: true,
              priorityTier: true,
              closeReadinessScore: true,
              discoveryQualityScore: true,
              riskProfile: true,
              proposalAngle: true,
              recommendedNextAction: true,
              summary: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.salesAssessment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          assessmentType: true,
          leadScore: true,
          priorityTier: true,
          closeReadinessScore: true,
          summary: true,
          recommendedNextAction: true,
          createdAt: true,
          lead: { select: { id: true, name: true, company: true } },
          deal: { select: { id: true, name: true, stage: true } },
        },
      }),
      this.prisma.discoverySession.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          objections: true,
          createdAt: true,
          lead: {
            select: { id: true, name: true, company: true, status: true },
          },
          deal: {
            select: {
              id: true,
              name: true,
              stage: true,
              lead: { select: { company: true } },
            },
          },
        },
      }),
      this.prisma.salesAssessment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          objectionRisks: true,
          createdAt: true,
          lead: {
            select: { id: true, name: true, company: true, status: true },
          },
          deal: {
            select: {
              id: true,
              name: true,
              stage: true,
              lead: { select: { company: true } },
            },
          },
        },
      }),
    ]);

    const assessedLeads = leads
      .map((lead) => ({ ...lead, assessment: lead.salesAssessments[0] ?? null }))
      .filter((lead) => lead.assessment);
    const dealsWithMomentum = deals.map((deal) => {
      const assessment = deal.salesAssessments[0] ?? null;
      const momentum = this.dealMomentum(deal, assessment);
      return {
        ...deal,
        assessment,
        momentum,
        forecast: this.dealForecast(deal, deal.salesAssessments, momentum),
      };
    });
    const assessedDeals = dealsWithMomentum.filter((deal) => deal.assessment);

    const topLeads = assessedLeads
      .sort(
        (a, b) =>
          (b.assessment?.leadScore ?? -1) - (a.assessment?.leadScore ?? -1),
      )
      .slice(0, 5);
    const atRiskDeals = assessedDeals
      .sort(
        (a, b) =>
          (a.assessment?.closeReadinessScore ?? 101) -
          (b.assessment?.closeReadinessScore ?? 101),
      )
      .slice(0, 5);
    const stalledDeals = dealsWithMomentum
      .filter((deal) =>
        ['urgent', 'stalled'].includes(deal.momentum.status),
      )
      .sort((a, b) => a.momentum.score - b.momentum.score)
      .slice(0, 5);
    const forecastRiskDeals = dealsWithMomentum
      .filter((deal) =>
        ['at_risk', 'watch'].includes(deal.forecast.status),
      )
      .sort((a, b) => a.forecast.confidence - b.forecast.confidence)
      .slice(0, 5);
    const missingDiscoveryLeads = leads
      .filter((lead) => lead.discoverySessions.length === 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);
    const missingDiscoveryDeals = dealsWithMomentum
      .filter((deal) => deal.discoverySessions.length === 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);
    const allObjectionPatterns = this.buildObjectionPatterns(
      discoveryObjections,
      assessmentObjections,
    );
    const objectionPatterns = allObjectionPatterns.slice(0, 6);
    const trackedObjections = allObjectionPatterns.reduce(
      (sum, pattern) => sum + pattern.count,
      0,
    );

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        totalLeads: leads.length,
        totalDeals: deals.length,
        assessedLeads: assessedLeads.length,
        assessedDeals: assessedDeals.length,
        highPriorityLeads: assessedLeads.filter(
          (lead) => lead.assessment?.priorityTier === 'high',
        ).length,
        dealsBelowReadiness: assessedDeals.filter(
          (deal) => (deal.assessment?.closeReadinessScore ?? 100) < 50,
        ).length,
        stalledDeals: dealsWithMomentum.filter((deal) =>
          ['urgent', 'stalled'].includes(deal.momentum.status),
        ).length,
        overdueDealActivities: dealsWithMomentum.reduce(
          (sum, deal) => sum + deal.momentum.overdueActivityCount,
          0,
        ),
        trackedObjections,
        objectionPatternCount: allObjectionPatterns.length,
        forecastAtRiskDeals: dealsWithMomentum.filter((deal) =>
          ['at_risk', 'watch'].includes(deal.forecast.status),
        ).length,
        averageForecastConfidence: this.average(
          dealsWithMomentum.map((deal) =>
            deal.forecast.status === 'unscored' ? null : deal.forecast.confidence,
          ),
        ),
        leadsMissingDiscovery: leads.filter(
          (lead) => lead.discoverySessions.length === 0,
        ).length,
        dealsMissingDiscovery: deals.filter(
          (deal) => deal.discoverySessions.length === 0,
        ).length,
        averageLeadScore: this.average(
          assessedLeads.map((lead) => lead.assessment?.leadScore ?? null),
        ),
        averageCloseReadiness: this.average(
          assessedDeals.map(
            (deal) => deal.assessment?.closeReadinessScore ?? null,
          ),
        ),
      },
      topLeads,
      atRiskDeals,
      stalledDeals,
      forecastRiskDeals,
      objectionPatterns,
      missingDiscoveryLeads,
      missingDiscoveryDeals,
      recentAssessments,
    };
  }

  async getLeadWorkspace(tenantId: string, leadId: string) {
    const lead = await this.getLeadOrThrow(tenantId, leadId);
    const [discovery, assessment] = await Promise.all([
      this.latestDiscovery(tenantId, { leadId }),
      this.latestAssessment(tenantId, { leadId }),
    ]);
    const objectionPatterns = await this.entityObjectionPatterns(
      tenantId,
      discovery,
      assessment,
    );

    return { lead, discovery, assessment, objectionPatterns };
  }

  async getDealWorkspace(tenantId: string, dealId: string) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const [discovery, assessment, assessmentHistory] = await Promise.all([
      this.latestDiscovery(tenantId, { dealId }),
      this.latestAssessment(tenantId, { dealId }),
      this.assessmentHistory(tenantId, { dealId }),
    ]);
    const objectionPatterns = await this.entityObjectionPatterns(
      tenantId,
      discovery,
      assessment,
    );
    const momentum = this.dealMomentum(
      {
        ...deal,
        discoverySessions: discovery
          ? [{ id: discovery.id, createdAt: discovery.createdAt }]
          : [],
      },
      assessment,
    );

    return {
      deal,
      discovery,
      assessment,
      objectionPatterns,
      momentum,
      forecast: this.dealForecast(deal, assessmentHistory, momentum),
    };
  }

  async saveLeadDiscovery(
    tenantId: string,
    leadId: string,
    dto: SaveDiscoveryDto,
    userId?: string,
  ) {
    await this.getLeadOrThrow(tenantId, leadId);

    const discovery = await this.prisma.discoverySession.create({
      data: {
        ...this.discoveryData(dto),
        tenantId,
        leadId,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE_DISCOVERY',
      entityType: 'Lead',
      entityId: leadId,
      details: 'Captured AI sales accelerator discovery details',
    });

    return discovery;
  }

  async saveDealDiscovery(
    tenantId: string,
    dealId: string,
    dto: SaveDiscoveryDto,
    userId?: string,
  ) {
    const deal = await this.getDealOrThrow(tenantId, dealId);

    const discovery = await this.prisma.discoverySession.create({
      data: {
        ...this.discoveryData(dto),
        tenantId,
        leadId: deal.leadId,
        dealId,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE_DISCOVERY',
      entityType: 'Deal',
      entityId: dealId,
      details: 'Captured AI sales accelerator discovery details',
    });

    return discovery;
  }

  async generateLeadDiscoveryGuide(
    tenantId: string,
    leadId: string,
    userId?: string,
  ) {
    const lead = await this.getLeadOrThrow(tenantId, leadId);
    const discovery = await this.latestDiscovery(tenantId, { leadId });
    return this.generateDiscoveryGuide(
      tenantId,
      userId,
      this.contextText({ entityType: 'lead', lead, discovery }),
      { entityType: 'lead', leadId, discoverySessionId: discovery?.id ?? null },
    );
  }

  async generateDealDiscoveryGuide(
    tenantId: string,
    dealId: string,
    userId?: string,
  ) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const discovery = await this.latestDiscovery(tenantId, { dealId });
    return this.generateDiscoveryGuide(
      tenantId,
      userId,
      this.contextText({
        entityType: 'deal',
        lead: deal.lead,
        deal,
        discovery,
      }),
      { entityType: 'deal', dealId, discoverySessionId: discovery?.id ?? null },
    );
  }

  async generateLeadOutreach(
    tenantId: string,
    leadId: string,
    userId?: string,
  ) {
    const lead = await this.getLeadOrThrow(tenantId, leadId);
    const [discovery, assessment] = await Promise.all([
      this.latestDiscovery(tenantId, { leadId }),
      this.latestAssessment(tenantId, { leadId }),
    ]);

    return this.generateOutreachPlan(
      tenantId,
      userId,
      this.contextText({
        entityType: 'lead',
        lead,
        discovery,
        assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
      }),
      { entityType: 'lead', leadId, discoverySessionId: discovery?.id ?? null },
    );
  }

  async generateDealOutreach(
    tenantId: string,
    dealId: string,
    userId?: string,
  ) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const [discovery, assessment] = await Promise.all([
      this.latestDiscovery(tenantId, { dealId }),
      this.latestAssessment(tenantId, { dealId }),
    ]);

    return this.generateOutreachPlan(
      tenantId,
      userId,
      this.contextText({
        entityType: 'deal',
        lead: deal.lead,
        deal,
        discovery,
        assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
      }),
      { entityType: 'deal', dealId, discoverySessionId: discovery?.id ?? null },
    );
  }

  async analyzeLeadDiscoveryCall(
    tenantId: string,
    leadId: string,
    dto: AnalyzeDiscoveryCallDto,
    userId?: string,
  ) {
    const lead = await this.getLeadOrThrow(tenantId, leadId);
    const [discovery, assessment] = await Promise.all([
      this.latestDiscovery(tenantId, { leadId }),
      this.latestAssessment(tenantId, { leadId }),
    ]);

    return this.analyzeDiscoveryCall(
      tenantId,
      userId,
      this.contextText({
        entityType: 'lead',
        lead,
        discovery,
        assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
      }),
      dto.transcript,
      {
        entityType: 'lead',
        leadId,
        discoverySessionId: discovery?.id ?? null,
      },
    );
  }

  async analyzeDealDiscoveryCall(
    tenantId: string,
    dealId: string,
    dto: AnalyzeDiscoveryCallDto,
    userId?: string,
  ) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const [discovery, assessment] = await Promise.all([
      this.latestDiscovery(tenantId, { dealId }),
      this.latestAssessment(tenantId, { dealId }),
    ]);

    return this.analyzeDiscoveryCall(
      tenantId,
      userId,
      this.contextText({
        entityType: 'deal',
        lead: deal.lead,
        deal,
        discovery,
        assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
      }),
      dto.transcript,
      {
        entityType: 'deal',
        dealId,
        discoverySessionId: discovery?.id ?? null,
      },
    );
  }

  async scoreLead(tenantId: string, leadId: string, userId?: string) {
    const lead = await this.getLeadOrThrow(tenantId, leadId);
    const discovery = await this.latestDiscovery(tenantId, { leadId });

    return this.createAssessment(
      tenantId,
      userId,
      {
        entityType: 'lead',
        lead,
        discovery,
      },
      {
        leadId,
        dealId: null,
        discoverySessionId: discovery?.id ?? null,
      },
    );
  }

  async scoreDeal(tenantId: string, dealId: string, userId?: string) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const discovery = await this.latestDiscovery(tenantId, { dealId });

    return this.createAssessment(
      tenantId,
      userId,
      {
        entityType: 'deal',
        lead: deal.lead,
        deal,
        discovery,
      },
      {
        leadId: deal.leadId,
        dealId,
        discoverySessionId: discovery?.id ?? null,
      },
    );
  }

  async generateProposalFromDiscovery(
    tenantId: string,
    dealId: string,
    dto: GenerateDiscoveryProposalDto,
    userId?: string,
  ) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const discovery = await this.latestDiscovery(tenantId, { dealId });
    const assessment = await this.latestAssessment(tenantId, { dealId });

    if (!discovery) {
      throw new BadRequestException(
        'Capture discovery details before generating a discovery-based proposal.',
      );
    }

    const context = this.contextText({
      entityType: 'deal',
      lead: deal.lead,
      deal,
      discovery,
      assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
    });

    let content: string;
    let fallbackUsed = false;
    let errorMessage: string | undefined;

    try {
      content = await this.aiService.generateDiscoveryProposal(context);
    } catch (error) {
      fallbackUsed = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Discovery proposal fell back: ${errorMessage}`);
      content = this.ruleProposal(deal.lead.company, discovery, assessment);
    }

    const generation = await this.aiMonitoringService.logGeneration({
      tenantId,
      createdBy: userId,
      sourceModule: 'sales_accelerator',
      promptKey: 'discovery_proposal',
      modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
      inputSource: {
        entityType: 'deal',
        dealId,
        discoverySessionId: discovery.id,
      },
      generatedOutput: { content },
      fallbackUsed,
      status: fallbackUsed ? 'fallback' : 'success',
      errorMessage,
      clientVisible: true,
    });

    const proposal = await this.proposalsService.create(
      tenantId,
      {
        title:
          dto.title?.trim() ||
          `Security Services Proposal - ${deal.lead.company}`,
        content,
        status: 'draft',
        leadId: deal.leadId,
        dealId,
        clientId: dto.clientId?.trim() || deal.clientId || undefined,
      },
      userId,
    );

    return {
      proposal,
      aiGenerationId: generation?.id ?? null,
      fallbackUsed,
    };
  }

  async createDealFollowUp(
    tenantId: string,
    dealId: string,
    dto: CreateFollowUpTaskDto,
    userId?: string,
  ) {
    const deal = await this.getDealOrThrow(tenantId, dealId);
    const assessment = await this.latestAssessment(tenantId, { dealId });
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : this.tomorrow();
    const subject =
      dto.subject?.trim() ||
      assessment?.recommendedNextAction ||
      `Follow up on ${deal.name}`;

    const activity = await this.activitiesService.create({
      type: 'task',
      subject,
      description:
        dto.description?.trim() ||
        [
          assessment?.summary,
          assessment?.riskProfile ? `Risk profile: ${assessment.riskProfile}` : null,
          assessment?.proposalAngle ? `Proposal angle: ${assessment.proposalAngle}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      dueDate,
      dealId,
      tenantId,
      userId,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE_FOLLOW_UP',
      entityType: 'Deal',
      entityId: dealId,
      details: `Created Sales Accelerator follow-up task: ${activity.subject}`,
    });

    return activity;
  }

  private async generateDiscoveryGuide(
    tenantId: string,
    userId: string | undefined,
    context: string,
    inputSource: Record<string, unknown>,
  ) {
    let guide: AiDiscoveryGuideDraft;
    let fallbackUsed = false;
    let errorMessage: string | undefined;

    try {
      guide = await this.aiService.generateDiscoveryGuide(context);
    } catch (error) {
      fallbackUsed = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Discovery guide fell back: ${errorMessage}`);
      guide = this.ruleDiscoveryGuide();
    }

    const generation = await this.aiMonitoringService.logGeneration({
      tenantId,
      createdBy: userId,
      sourceModule: 'sales_accelerator',
      promptKey: 'discovery_guide',
      modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
      inputSource,
      generatedOutput: guide,
      fallbackUsed,
      status: fallbackUsed ? 'fallback' : 'success',
      errorMessage,
      clientVisible: false,
    });

    return {
      guide,
      aiGenerationId: generation?.id ?? null,
      fallbackUsed,
    };
  }

  private async generateOutreachPlan(
    tenantId: string,
    userId: string | undefined,
    context: string,
    inputSource: Record<string, unknown>,
  ) {
    let outreach: AiOutreachDraft;
    let fallbackUsed = false;
    let errorMessage: string | undefined;

    try {
      outreach = await this.aiService.generateOutreachPlan(context);
    } catch (error) {
      fallbackUsed = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Outreach plan fell back: ${errorMessage}`);
      outreach = this.ruleOutreachPlan();
    }

    const generation = await this.aiMonitoringService.logGeneration({
      tenantId,
      createdBy: userId,
      sourceModule: 'sales_accelerator',
      promptKey: 'outreach_plan',
      modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
      inputSource,
      generatedOutput: outreach,
      fallbackUsed,
      status: fallbackUsed ? 'fallback' : 'success',
      errorMessage,
      clientVisible: false,
    });

    return {
      outreach,
      aiGenerationId: generation?.id ?? null,
      fallbackUsed,
    };
  }

  private async analyzeDiscoveryCall(
    tenantId: string,
    userId: string | undefined,
    context: string,
    transcript: string,
    inputSource: Record<string, unknown>,
  ) {
    const transcriptText = transcript.trim();

    if (transcriptText.length < 20) {
      throw new BadRequestException(
        'Add at least 20 characters of call notes before analyzing.',
      );
    }

    let intelligence: AiDiscoveryCallIntelligenceDraft;
    let fallbackUsed = false;
    let errorMessage: string | undefined;

    try {
      intelligence = await this.aiService.generateDiscoveryCallIntelligence(
        context,
        transcriptText,
      );
    } catch (error) {
      fallbackUsed = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Discovery call intelligence fell back: ${errorMessage}`);
      intelligence = this.ruleDiscoveryCallIntelligence(transcriptText);
    }

    const generation = await this.aiMonitoringService.logGeneration({
      tenantId,
      createdBy: userId,
      sourceModule: 'sales_accelerator',
      promptKey: 'discovery_call_intelligence',
      modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
      inputSource: {
        ...inputSource,
        transcriptLength: transcriptText.length,
      },
      generatedOutput: intelligence,
      fallbackUsed,
      status: fallbackUsed ? 'fallback' : 'success',
      errorMessage,
      clientVisible: false,
    });

    return {
      intelligence,
      aiGenerationId: generation?.id ?? null,
      fallbackUsed,
    };
  }

  private async createAssessment(
    tenantId: string,
    userId: string | undefined,
    context: SalesEntityContext,
    ids: {
      leadId: string | null;
      dealId: string | null;
      discoverySessionId: string | null;
    },
  ) {
    const contextText = this.contextText(context);
    const heuristic = this.ruleAssessment(context);
    let draft = heuristic;
    let fallbackUsed = false;
    let errorMessage: string | undefined;

    try {
      draft = await this.aiService.generateSalesAssessment(contextText);
    } catch (error) {
      fallbackUsed = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Sales assessment fell back: ${errorMessage}`);
    }

    draft = this.mergeAssessmentDefaults(draft, heuristic);

    const generation = await this.aiMonitoringService.logGeneration({
      tenantId,
      createdBy: userId,
      sourceModule: 'sales_accelerator',
      promptKey: 'sales_assessment',
      modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
      inputSource: {
        entityType: context.entityType,
        leadId: ids.leadId,
        dealId: ids.dealId,
        discoverySessionId: ids.discoverySessionId,
      },
      generatedOutput: draft,
      fallbackUsed,
      status: fallbackUsed ? 'fallback' : 'success',
      errorMessage,
      clientVisible: false,
    });

    const assessment = await this.prisma.salesAssessment.create({
      data: {
        tenantId,
        leadId: ids.leadId || undefined,
        dealId: ids.dealId || undefined,
        discoverySessionId: ids.discoverySessionId || undefined,
        assessmentType: context.entityType === 'deal' ? 'deal_assessment' : 'lead_assessment',
        leadScore: draft.leadScore,
        priorityTier: draft.priorityTier,
        closeReadinessScore: draft.closeReadinessScore,
        discoveryQualityScore: draft.discoveryQualityScore,
        riskProfile: draft.riskProfile,
        proposalAngle: draft.proposalAngle,
        recommendedNextAction: draft.recommendedNextAction,
        missingQuestions: draft.missingQuestions,
        objectionRisks: draft.objectionRisks,
        summary: draft.summary,
        generatedOutput: draft as unknown as Prisma.InputJsonValue,
        aiGenerationId: generation?.id ?? undefined,
        createdBy: userId,
      },
    });

    return {
      assessment,
      aiGenerationId: generation?.id ?? null,
      fallbackUsed,
    };
  }

  private async getLeadOrThrow(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      include: {
        notes: { orderBy: { createdAt: 'desc' }, take: 8 },
        proposals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { title: true, status: true, createdAt: true },
        },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private async getDealOrThrow(tenantId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      include: {
        lead: {
          include: {
            notes: { orderBy: { createdAt: 'desc' }, take: 8 },
            proposals: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: { title: true, status: true, createdAt: true },
            },
          },
        },
        notes: { orderBy: { createdAt: 'desc' }, take: 8 },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            subject: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
        },
        proposals: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { title: true, status: true, createdAt: true },
        },
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private latestDiscovery(
    tenantId: string,
    where: { leadId?: string; dealId?: string },
  ) {
    return this.prisma.discoverySession.findFirst({
      where: {
        tenantId,
        ...(where.dealId ? { dealId: where.dealId } : { leadId: where.leadId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private latestAssessment(
    tenantId: string,
    where: { leadId?: string; dealId?: string },
  ) {
    return this.prisma.salesAssessment.findFirst({
      where: {
        tenantId,
        ...(where.dealId ? { dealId: where.dealId } : { leadId: where.leadId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assessmentHistory(
    tenantId: string,
    where: { leadId?: string; dealId?: string },
  ) {
    return this.prisma.salesAssessment.findMany({
      where: {
        tenantId,
        ...(where.dealId ? { dealId: where.dealId } : { leadId: where.leadId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        leadScore: true,
        priorityTier: true,
        closeReadinessScore: true,
        discoveryQualityScore: true,
        recommendedNextAction: true,
        summary: true,
        createdAt: true,
      },
    });
  }

  private discoveryData(dto: SaveDiscoveryDto) {
    return {
      propertyType: this.cleanString(dto.propertyType),
      buyerRole: this.cleanString(dto.buyerRole),
      currentProvider: this.cleanString(dto.currentProvider),
      guardCount: dto.guardCount,
      serviceHours: this.cleanString(dto.serviceHours),
      painPoints: this.cleanList(dto.painPoints),
      riskConcerns: this.cleanList(dto.riskConcerns),
      decisionTimeline: this.cleanString(dto.decisionTimeline),
      budgetSensitivity: this.cleanString(dto.budgetSensitivity),
      objections: this.cleanList(dto.objections),
      notes: this.cleanString(dto.notes),
    };
  }

  private contextText(context: SalesEntityContext) {
    const discovery = context.discovery;
    const deal = context.deal;
    const leadNotes = context.lead.notes?.map((note) => note.content).join(' | ') || 'None';
    const dealNotes = deal?.notes?.map((note) => note.content).join(' | ') || 'None';
    const proposals =
      [
        ...(context.lead.proposals || []),
        ...(deal?.proposals || []),
      ]
        .map((proposal) => `${proposal.title} (${proposal.status})`)
        .join(' | ') || 'None';

    return [
      `Entity type: ${context.entityType}`,
      `Lead: ${context.lead.name} at ${context.lead.company}`,
      `Lead status: ${context.lead.status}`,
      `Deal: ${deal ? `${deal.name} (${deal.stage})` : 'No deal yet'}`,
      `Client: ${deal?.client ? deal.client.companyName || deal.client.name : 'No client linked'}`,
      `Property type: ${discovery?.propertyType || 'Unknown'}`,
      `Buyer role: ${discovery?.buyerRole || 'Unknown'}`,
      `Current provider: ${discovery?.currentProvider || 'Unknown'}`,
      `Guard count: ${discovery?.guardCount ?? 'Unknown'}`,
      `Service hours: ${discovery?.serviceHours || 'Unknown'}`,
      `Pain points: ${this.displayList(discovery?.painPoints)}`,
      `Risk concerns: ${this.displayList(discovery?.riskConcerns)}`,
      `Decision timeline: ${discovery?.decisionTimeline || 'Unknown'}`,
      `Budget sensitivity: ${discovery?.budgetSensitivity || 'Unknown'}`,
      `Objections: ${this.displayList(discovery?.objections)}`,
      `Discovery notes: ${discovery?.notes || 'None'}`,
      `Lead notes: ${leadNotes}`,
      `Deal notes: ${dealNotes}`,
      `Existing proposals: ${proposals}`,
      context.assessment
        ? `Latest assessment: ${context.assessment.summary}. Next action: ${context.assessment.recommendedNextAction}`
        : 'Latest assessment: None',
    ].join('\n');
  }

  private async entityObjectionPatterns(
    tenantId: string,
    discovery?: DiscoverySnapshot | null,
    assessment?: { objectionRisks: string[] } | null,
  ) {
    const sourceTexts = [
      ...(discovery?.objections || []),
      ...(assessment?.objectionRisks || []),
    ];
    const keys = Array.from(
      new Set(
        sourceTexts
          .map((text) => this.objectionDefinition(text).key)
          .filter(Boolean),
      ),
    );

    if (keys.length === 0) return [];

    const [discoveryObjections, assessmentObjections] = await Promise.all([
      this.prisma.discoverySession.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          objections: true,
          lead: {
            select: { id: true, name: true, company: true, status: true },
          },
          deal: {
            select: {
              id: true,
              name: true,
              stage: true,
              lead: { select: { company: true } },
            },
          },
        },
      }),
      this.prisma.salesAssessment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          objectionRisks: true,
          lead: {
            select: { id: true, name: true, company: true, status: true },
          },
          deal: {
            select: {
              id: true,
              name: true,
              stage: true,
              lead: { select: { company: true } },
            },
          },
        },
      }),
    ]);

    return this.buildObjectionPatterns(discoveryObjections, assessmentObjections, {
      keys,
      limit: 4,
    });
  }

  private buildObjectionPatterns(
    discoveryRecords: Array<{
      objections: string[];
      lead?: {
        id: string;
        name: string;
        company: string;
        status: string;
      } | null;
      deal?: {
        id: string;
        name: string;
        stage: string;
        lead?: { company: string } | null;
      } | null;
    }>,
    assessmentRecords: Array<{
      objectionRisks: string[];
      lead?: {
        id: string;
        name: string;
        company: string;
        status: string;
      } | null;
      deal?: {
        id: string;
        name: string;
        stage: string;
        lead?: { company: string } | null;
      } | null;
    }>,
    options: { keys?: string[]; limit?: number } = {},
  ): ObjectionPattern[] {
    const buckets = new Map<string, ObjectionPattern>();
    const allowedKeys = options.keys ? new Set(options.keys) : null;

    const ensureBucket = (text: string) => {
      const definition = this.objectionDefinition(text);
      if (allowedKeys && !allowedKeys.has(definition.key)) return null;

      if (!buckets.has(definition.key)) {
        buckets.set(definition.key, {
          key: definition.key,
          label: definition.label,
          count: 0,
          severity: 'low',
          examples: [],
          recommendedResponse: definition.recommendedResponse,
          playbook: definition.playbook,
          relatedLeads: [],
          relatedDeals: [],
        });
      }

      return buckets.get(definition.key) ?? null;
    };

    const addRelated = (
      pattern: ObjectionPattern,
      source: {
        lead?: {
          id: string;
          name: string;
          company: string;
          status: string;
        } | null;
        deal?: {
          id: string;
          name: string;
          stage: string;
          lead?: { company: string } | null;
        } | null;
      },
    ) => {
      if (
        source.lead &&
        pattern.relatedLeads.length < 3 &&
        !pattern.relatedLeads.some((lead) => lead.id === source.lead?.id)
      ) {
        pattern.relatedLeads.push(source.lead);
      }

      if (
        source.deal &&
        pattern.relatedDeals.length < 3 &&
        !pattern.relatedDeals.some((deal) => deal.id === source.deal?.id)
      ) {
        pattern.relatedDeals.push({
          id: source.deal.id,
          name: source.deal.name,
          stage: source.deal.stage,
          company: source.deal.lead?.company || source.lead?.company || 'Unknown',
        });
      }
    };

    const addText = (
      text: string,
      source: {
        lead?: {
          id: string;
          name: string;
          company: string;
          status: string;
        } | null;
        deal?: {
          id: string;
          name: string;
          stage: string;
          lead?: { company: string } | null;
        } | null;
      },
    ) => {
      const cleaned = text.trim();
      if (!cleaned) return;

      const pattern = ensureBucket(cleaned);
      if (!pattern) return;

      pattern.count += 1;
      if (
        pattern.examples.length < 3 &&
        !pattern.examples.some(
          (example) => example.toLowerCase() === cleaned.toLowerCase(),
        )
      ) {
        pattern.examples.push(cleaned);
      }
      addRelated(pattern, source);
    };

    discoveryRecords.forEach((record) => {
      record.objections.forEach((objection) => addText(objection, record));
    });
    assessmentRecords.forEach((record) => {
      record.objectionRisks.forEach((objection) => addText(objection, record));
    });

    return Array.from(buckets.values())
      .map((pattern) => ({
        ...pattern,
        severity: this.objectionSeverity(pattern.key, pattern.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, options.limit ?? 6);
  }

  private objectionDefinition(text: string) {
    const normalized = text.toLowerCase();
    const definitions = [
      {
        key: 'price_budget',
        label: 'Price and Budget',
        test: /(price|cost|budget|expensive|cheap|rate|hourly|fee|quote|bid|lowest|afford)/,
        recommendedResponse:
          'Reframe the conversation from hourly rate to risk exposure, supervision quality, reporting, and avoided incident cost.',
        playbook: [
          'Ask what risk or incident would be most costly if coverage fails.',
          'Compare scope, supervision, reporting, and escalation instead of only rate.',
          'Offer options that protect the must-have coverage while separating nice-to-have add-ons.',
        ],
      },
      {
        key: 'incumbent_provider',
        label: 'Current Provider',
        test: /(current provider|existing provider|vendor|contract|incumbent|already have|satisfied|using someone)/,
        recommendedResponse:
          'Do not attack the incumbent. Identify coverage gaps, reporting friction, and service consistency issues the buyer would still improve.',
        playbook: [
          'Ask what they would change about the current provider if switching were easy.',
          'Look for missed posts, poor reporting, turnover, or slow escalation.',
          'Offer a benchmark review or site walkthrough before asking for a full switch.',
        ],
      },
      {
        key: 'timing_urgency',
        label: 'Timing and Urgency',
        test: /(timing|timeline|later|not now|delay|start date|soon|urgent|wait|quarter|next month|next year)/,
        recommendedResponse:
          'Tie the timeline to a concrete event, risk window, contract date, or operational trigger.',
        playbook: [
          'Ask what happens if the coverage decision slips by 30 days.',
          'Confirm the real start date and any board, procurement, or event deadlines.',
          'Set a dated next step even if the final start date is later.',
        ],
      },
      {
        key: 'decision_authority',
        label: 'Decision Authority',
        test: /(decision|approve|approval|owner|board|committee|manager|corporate|procurement|legal|need to ask|sign off)/,
        recommendedResponse:
          'Map the buying group and equip the champion with risk-based language for the approver.',
        playbook: [
          'Ask who signs the agreement and who can block the decision.',
          'Confirm what each stakeholder cares about: risk, cost, tenant experience, or compliance.',
          'Send a short decision summary the champion can forward internally.',
        ],
      },
      {
        key: 'service_quality',
        label: 'Service Quality and Trust',
        test: /(quality|reliable|reliability|no show|turnover|training|supervision|trust|accountability|professional|experience|poor service)/,
        recommendedResponse:
          'Use proof of supervision, hiring standards, reporting cadence, and escalation controls to reduce trust concerns.',
        playbook: [
          'Ask what service failure would break trust fastest.',
          'Explain supervisor checks, post orders, guard training, and incident reporting.',
          'Offer a 30/60/90-day service review plan with measurable checkpoints.',
        ],
      },
      {
        key: 'coverage_scope',
        label: 'Coverage Scope',
        test: /(guard|coverage|hours|shift|post|patrol|staff|staffing|scope|site|entrance|parking|access)/,
        recommendedResponse:
          'Clarify scope by mapping guard posts, patrol zones, operating hours, and escalation needs to actual property risk.',
        playbook: [
          'Confirm the highest-risk shifts, entrances, assets, and tenant touchpoints.',
          'Separate fixed posts from patrols and supervisor coverage.',
          'Use a site walkthrough to validate guard count and hours.',
        ],
      },
      {
        key: 'compliance_contract',
        label: 'Compliance and Contract',
        test: /(insurance|license|compliance|contract|terms|legal|sla|indemnity|certificate|policy)/,
        recommendedResponse:
          'Reduce friction by preparing compliance proof, insurance details, service terms, and approval documents early.',
        playbook: [
          'Ask which documents procurement or legal needs before approval.',
          'Share licenses, insurance, service levels, and reporting commitments.',
          'Confirm contract review steps before proposal delivery.',
        ],
      },
      {
        key: 'risk_value',
        label: 'Risk and Value',
        test: /(need|why|value|risk|incident|liability|roi|worth|benefit|problem|concern)/,
        recommendedResponse:
          'Make the business case around reduced incidents, liability control, tenant confidence, and management visibility.',
        playbook: [
          'Ask which risk the buyer most wants removed.',
          'Connect each guard recommendation to a risk, location, or operating window.',
          'Summarize value in operational outcomes, not only guard presence.',
        ],
      },
    ];
    const definition =
      definitions.find((item) => item.test.test(normalized)) ||
      {
        key: 'general_objection',
        label: 'General Objection',
        recommendedResponse:
          'Clarify the concern, quantify impact, and connect the response back to property risk and buyer priorities.',
        playbook: [
          'Ask what would need to be true for the buyer to move forward.',
          'Restate the concern in business terms before answering.',
          'Agree on the next proof point or decision step.',
        ],
      };

    return {
      key: definition.key,
      label: definition.label,
      recommendedResponse: definition.recommendedResponse,
      playbook: definition.playbook,
    };
  }

  private objectionSeverity(
    key: string,
    count: number,
  ): ObjectionPattern['severity'] {
    if (count >= 5) return 'high';
    if (
      count >= 3 &&
      ['price_budget', 'decision_authority', 'service_quality'].includes(key)
    ) {
      return 'high';
    }
    if (count >= 2) return 'medium';
    return 'low';
  }

  private dealForecast(
    deal: { stage: string; createdAt: Date },
    assessments: AssessmentSnapshot[],
    momentum?: DealMomentum | null,
  ): DealForecast {
    const stage = deal.stage.toLowerCase();
    const sorted = [...assessments].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const latest = sorted[0] ?? null;
    const previous = sorted[1] ?? null;
    const currentReadiness = latest?.closeReadinessScore ?? null;
    const previousReadiness = previous?.closeReadinessScore ?? null;
    const readinessChange =
      typeof currentReadiness === 'number' &&
      typeof previousReadiness === 'number'
        ? currentReadiness - previousReadiness
        : null;
    const trend = this.readinessTrend(readinessChange);
    const history = sorted
      .slice(0, 6)
      .reverse()
      .map((assessment) => ({
        id: assessment.id,
        score: assessment.closeReadinessScore,
        discoveryQualityScore: assessment.discoveryQualityScore,
        createdAt: assessment.createdAt,
      }));

    if (/lost|closed lost/.test(stage)) {
      return {
        status: 'closed_lost',
        label: 'Closed Lost',
        confidence: 100,
        probability: 0,
        currentReadiness,
        previousReadiness,
        readinessChange,
        trend,
        history,
        reasons: ['Deal is in a lost stage.'],
        recommendedAction: 'Capture loss reason and feed it back into future discovery.',
      };
    }

    if (/won|closed won/.test(stage)) {
      return {
        status: 'closed_won',
        label: 'Closed Won',
        confidence: 100,
        probability: 100,
        currentReadiness,
        previousReadiness,
        readinessChange,
        trend,
        history,
        reasons: ['Deal is in a won stage.'],
        recommendedAction: 'Hand off confirmed scope and risk context to operations.',
      };
    }

    if (!latest || typeof currentReadiness !== 'number') {
      return {
        status: 'unscored',
        label: 'Unscored',
        confidence: 0,
        probability: 0,
        currentReadiness: null,
        previousReadiness,
        readinessChange,
        trend: 'unknown',
        history,
        reasons: ['No close-readiness assessment has been generated yet.'],
        recommendedAction: 'Run Sales Accelerator scoring after discovery is captured.',
      };
    }

    const discoveryQuality = latest.discoveryQualityScore ?? 0;
    const reasons: string[] = [];
    let probability = currentReadiness;
    let confidence = 40 + Math.min(24, sorted.length * 6);

    if (trend === 'improving') {
      probability += 6;
      confidence += 8;
      reasons.push(`Readiness improved by ${readinessChange} points.`);
    } else if (trend === 'declining') {
      probability -= 10;
      confidence -= 6;
      reasons.push(`Readiness declined by ${Math.abs(readinessChange ?? 0)} points.`);
    } else if (trend === 'flat') {
      reasons.push('Readiness is stable against the previous assessment.');
    } else {
      reasons.push('Only one readiness assessment exists so trend confidence is limited.');
    }

    if (discoveryQuality >= 75) {
      confidence += 12;
      reasons.push('Discovery quality is strong.');
    } else if (discoveryQuality >= 50) {
      confidence += 5;
      reasons.push('Discovery quality is usable but can improve.');
    } else {
      probability -= 8;
      confidence -= 8;
      reasons.push('Discovery quality is weak.');
    }

    if (momentum?.status === 'healthy') {
      probability += 5;
      confidence += 6;
      reasons.push('Deal momentum is healthy.');
    } else if (momentum?.status === 'watch') {
      probability -= 4;
      reasons.push('Deal momentum needs watching.');
    } else if (momentum?.status === 'stalled') {
      probability -= 12;
      confidence -= 8;
      reasons.push('Deal momentum is stalled.');
    } else if (momentum?.status === 'urgent') {
      probability -= 18;
      confidence -= 12;
      reasons.push('Deal momentum is urgent.');
    }

    const forecastProbability = this.clamp(probability);
    const forecastConfidence = this.clamp(confidence);
    const status = this.forecastStatus(
      forecastProbability,
      forecastConfidence,
    );

    return {
      status,
      label: this.forecastLabel(status),
      confidence: forecastConfidence,
      probability: forecastProbability,
      currentReadiness,
      previousReadiness,
      readinessChange,
      trend,
      history,
      reasons,
      recommendedAction: this.forecastAction(
        status,
        trend,
        latest.recommendedNextAction,
      ),
    };
  }

  private readinessTrend(
    readinessChange: number | null,
  ): DealForecast['trend'] {
    if (typeof readinessChange !== 'number') return 'unknown';
    if (readinessChange >= 5) return 'improving';
    if (readinessChange <= -5) return 'declining';
    return 'flat';
  }

  private forecastStatus(
    probability: number,
    confidence: number,
  ): DealForecast['status'] {
    if (probability >= 80 && confidence >= 70) return 'commit';
    if (probability >= 65 && confidence >= 55) return 'likely';
    if (probability >= 45) return 'watch';
    return 'at_risk';
  }

  private forecastLabel(status: DealForecast['status']) {
    const labels: Record<DealForecast['status'], string> = {
      commit: 'Commit',
      likely: 'Likely',
      watch: 'Watch',
      at_risk: 'At Risk',
      unscored: 'Unscored',
      closed_won: 'Closed Won',
      closed_lost: 'Closed Lost',
    };
    return labels[status];
  }

  private forecastAction(
    status: DealForecast['status'],
    trend: DealForecast['trend'],
    nextAction?: string | null,
  ) {
    if (status === 'closed_won') {
      return 'Send confirmed scope, buyer priorities, and risk context to operations.';
    }
    if (status === 'closed_lost') {
      return 'Capture loss reason and compare it with objection patterns.';
    }
    if (status === 'unscored') {
      return 'Run close-readiness scoring after discovery is captured.';
    }
    if (trend === 'declining') {
      return nextAction || 'Revisit discovery gaps and confirm the approval path.';
    }
    if (status === 'commit') {
      return nextAction || 'Confirm final decision date and prepare handoff details.';
    }
    if (status === 'likely') {
      return nextAction || 'Lock the next buyer meeting and validate remaining risks.';
    }
    if (status === 'watch') {
      return nextAction || 'Improve discovery quality before treating this as forecastable.';
    }
    return nextAction || 'Create a recovery action tied to buyer risk and timeline.';
  }

  private dealMomentum(
    deal: DealMomentumContext,
    assessment?: DealMomentumAssessment | null,
  ): DealMomentum {
    const now = new Date();
    const stage = deal.stage.toLowerCase();
    const activities = deal.activities || [];
    const pendingActivities = activities.filter(
      (activity) => activity.status.toLowerCase() !== 'completed',
    );
    const overdueActivities = pendingActivities.filter(
      (activity) => activity.dueDate && activity.dueDate.getTime() < now.getTime(),
    );
    const lastActivity =
      [...activities].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null;
    const nextActivity =
      [...pendingActivities].sort(
        (a, b) =>
          (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER),
      )[0] ?? null;
    const daysOpen = this.daysBetween(deal.createdAt, now);
    const daysSinceActivity = lastActivity
      ? this.daysBetween(lastActivity.createdAt, now)
      : null;
    const isClosed = /(won|lost|closed)/.test(stage);
    const reasons: string[] = [];

    if (isClosed) {
      return {
        status: 'closed',
        score: 100,
        daysOpen,
        daysSinceActivity,
        overdueActivityCount: overdueActivities.length,
        pendingActivityCount: pendingActivities.length,
        nextActivity,
        lastActivity,
        reasons: ['Deal is in a closed stage.'],
        recommendedAction: 'No sales momentum action required.',
      };
    }

    let score = 100;

    if (daysSinceActivity === null) {
      const penalty = daysOpen >= 7 ? 30 : 15;
      score -= penalty;
      reasons.push('No sales activity has been logged on this deal.');
    } else if (daysSinceActivity > 14) {
      score -= 35;
      reasons.push(`No logged activity for ${daysSinceActivity} days.`);
    } else if (daysSinceActivity > 7) {
      score -= 25;
      reasons.push(`No logged activity for ${daysSinceActivity} days.`);
    } else if (daysSinceActivity > 3) {
      score -= 10;
      reasons.push(`Last logged activity was ${daysSinceActivity} days ago.`);
    } else {
      reasons.push('Recent sales activity is logged.');
    }

    if (overdueActivities.length > 0) {
      score -= Math.min(35, overdueActivities.length * 15);
      reasons.push(
        `${overdueActivities.length} follow-up ${
          overdueActivities.length === 1 ? 'task is' : 'tasks are'
        } overdue.`,
      );
    }

    if (pendingActivities.length === 0) {
      score -= 15;
      reasons.push('No pending next-step activity is scheduled.');
    }

    if (!deal.discoverySessions?.length) {
      score -= 10;
      reasons.push('No discovery session is captured for this deal.');
    }

    if ((assessment?.closeReadinessScore ?? 100) < 50) {
      score -= 20;
      reasons.push('Close readiness is below 50%.');
    } else if ((assessment?.closeReadinessScore ?? 100) < 70) {
      score -= 10;
      reasons.push('Close readiness is still below 70%.');
    }

    if ((assessment?.discoveryQualityScore ?? 100) < 50) {
      score -= 8;
      reasons.push('Discovery quality is below 50%.');
    }

    const momentumScore = this.clamp(score);
    let status: DealMomentum['status'] = 'healthy';

    if (
      momentumScore < 35 ||
      overdueActivities.length >= 2 ||
      ((daysSinceActivity ?? 0) > 14 && pendingActivities.length === 0)
    ) {
      status = 'urgent';
    } else if (
      momentumScore < 55 ||
      overdueActivities.length > 0 ||
      (daysSinceActivity ?? 0) > 10
    ) {
      status = 'stalled';
    } else if (
      momentumScore < 75 ||
      pendingActivities.length === 0 ||
      (daysSinceActivity ?? 0) > 5
    ) {
      status = 'watch';
    }

    return {
      status,
      score: momentumScore,
      daysOpen,
      daysSinceActivity,
      overdueActivityCount: overdueActivities.length,
      pendingActivityCount: pendingActivities.length,
      nextActivity,
      lastActivity,
      reasons: reasons.length ? reasons : ['Deal momentum is healthy.'],
      recommendedAction: this.momentumAction(
        status,
        overdueActivities.length,
        pendingActivities.length,
        daysSinceActivity,
        nextActivity,
        assessment,
      ),
    };
  }

  private momentumAction(
    status: DealMomentum['status'],
    overdueActivityCount: number,
    pendingActivityCount: number,
    daysSinceActivity: number | null,
    nextActivity: ActivitySnapshot | null,
    assessment?: DealMomentumAssessment | null,
  ) {
    if (status === 'closed') return 'No sales momentum action required.';
    if (overdueActivityCount > 0) {
      return `Complete or reschedule ${overdueActivityCount} overdue follow-up ${
        overdueActivityCount === 1 ? 'task' : 'tasks'
      }.`;
    }
    if (pendingActivityCount === 0) {
      return (
        assessment?.recommendedNextAction ||
        'Create a dated follow-up task tied to the buyer decision timeline.'
      );
    }
    if (daysSinceActivity === null) {
      return 'Log the first buyer touch and confirm the decision process.';
    }
    if (daysSinceActivity > 7) {
      return (
        assessment?.recommendedNextAction ||
        'Restart the conversation with a risk-framed follow-up and confirm the next meeting.'
      );
    }
    if ((assessment?.closeReadinessScore ?? 100) < 70) {
      return (
        assessment?.recommendedNextAction ||
        'Fill the close-readiness gaps before sending another proposal update.'
      );
    }
    if (nextActivity) {
      return `Prepare for next activity: ${nextActivity.subject}.`;
    }

    return 'Keep the next step dated and tied to the buyer approval path.';
  }

  private ruleAssessment(context: SalesEntityContext): AiSalesAssessmentDraft {
    const discovery = context.discovery;
    const missingQuestions = this.missingQuestions(discovery);
    const filled = 10 - missingQuestions.length;
    const discoveryQualityScore = Math.max(10, Math.min(100, filled * 10));
    const riskSignal =
      (discovery?.painPoints?.length || 0) * 6 +
      (discovery?.riskConcerns?.length || 0) * 8;
    const guardSignal = discovery?.guardCount ? Math.min(15, discovery.guardCount * 3) : 0;
    const buyerSignal = discovery?.buyerRole ? 10 : 0;
    const timelineSignal = this.timelineSignal(discovery?.decisionTimeline);
    const budgetPenalty = this.budgetPenalty(discovery?.budgetSensitivity);
    const objectionPenalty = Math.min(15, (discovery?.objections?.length || 0) * 5);
    const baseScore =
      25 +
      discoveryQualityScore * 0.25 +
      riskSignal +
      guardSignal +
      buyerSignal +
      timelineSignal -
      budgetPenalty;
    const leadScore = this.clamp(baseScore);
    const closeReadinessScore = this.clamp(
      leadScore + (context.entityType === 'deal' ? 8 : 0) - objectionPenalty,
    );
    const priorityTier = this.priorityTier(leadScore);
    const topRisk =
      discovery?.riskConcerns?.[0] ||
      discovery?.painPoints?.[0] ||
      'security exposure needs more discovery';

    return {
      leadScore,
      priorityTier,
      closeReadinessScore,
      discoveryQualityScore,
      riskProfile: `${context.lead.company} appears to be driven by ${topRisk}.`,
      proposalAngle:
        'Position the service around risk reduction, accountable coverage, and operational visibility instead of hourly guard cost.',
      recommendedNextAction:
        missingQuestions.length > 0
          ? `Ask: ${missingQuestions[0]}`
          : context.entityType === 'deal'
            ? 'Generate a risk-framed proposal and confirm the decision timeline.'
            : 'Convert this lead to a deal once the buyer confirms scope and timeline.',
      missingQuestions,
      objectionRisks:
        discovery?.objections && discovery.objections.length > 0
          ? discovery.objections
          : budgetPenalty > 0
            ? ['Budget sensitivity may create price pressure unless risk is quantified.']
            : [],
      summary:
        `${priorityTier.toUpperCase()} priority with ${discoveryQualityScore}% discovery completeness and ${closeReadinessScore}% close readiness.`,
    };
  }

  private mergeAssessmentDefaults(
    draft: AiSalesAssessmentDraft,
    fallback: AiSalesAssessmentDraft,
  ): AiSalesAssessmentDraft {
    return {
      leadScore: this.clamp(draft.leadScore ?? fallback.leadScore),
      priorityTier: ['high', 'medium', 'low'].includes(draft.priorityTier)
        ? draft.priorityTier
        : fallback.priorityTier,
      closeReadinessScore: this.clamp(
        draft.closeReadinessScore ?? fallback.closeReadinessScore,
      ),
      discoveryQualityScore: this.clamp(
        draft.discoveryQualityScore ?? fallback.discoveryQualityScore,
      ),
      riskProfile: draft.riskProfile?.trim() || fallback.riskProfile,
      proposalAngle: draft.proposalAngle?.trim() || fallback.proposalAngle,
      recommendedNextAction:
        draft.recommendedNextAction?.trim() || fallback.recommendedNextAction,
      missingQuestions: this.cleanList(draft.missingQuestions).length
        ? this.cleanList(draft.missingQuestions)
        : fallback.missingQuestions,
      objectionRisks: this.cleanList(draft.objectionRisks),
      summary: draft.summary?.trim() || fallback.summary,
    };
  }

  private assessmentDraftFromRecord(record: {
    leadScore: number | null;
    priorityTier: string | null;
    closeReadinessScore: number | null;
    discoveryQualityScore: number | null;
    riskProfile: string | null;
    proposalAngle: string | null;
    recommendedNextAction: string | null;
    missingQuestions: string[];
    objectionRisks: string[];
    summary: string | null;
  }): AiSalesAssessmentDraft {
    return {
      leadScore: record.leadScore ?? 0,
      priorityTier:
        record.priorityTier === 'high' ||
        record.priorityTier === 'medium' ||
        record.priorityTier === 'low'
          ? record.priorityTier
          : 'medium',
      closeReadinessScore: record.closeReadinessScore ?? 0,
      discoveryQualityScore: record.discoveryQualityScore ?? 0,
      riskProfile: record.riskProfile || '',
      proposalAngle: record.proposalAngle || '',
      recommendedNextAction: record.recommendedNextAction || '',
      missingQuestions: record.missingQuestions,
      objectionRisks: record.objectionRisks,
      summary: record.summary || '',
    };
  }

  private missingQuestions(discovery?: DiscoverySnapshot | null) {
    const questions: string[] = [];
    if (!discovery?.propertyType) questions.push('What type of property needs coverage?');
    if (!discovery?.buyerRole) questions.push('Who is the decision maker and what is their role?');
    if (!discovery?.guardCount) questions.push('How many guards or posts are required?');
    if (!discovery?.serviceHours) questions.push('Which days and hours need coverage?');
    if (!discovery?.riskConcerns?.length) questions.push('What risks or incidents are driving the security need?');
    if (!discovery?.decisionTimeline) questions.push('When does the client need service to start?');
    if (!discovery?.budgetSensitivity) questions.push('How sensitive is the buyer to price versus risk reduction?');
    if (!discovery?.currentProvider) questions.push('Are they using a current security provider?');
    if (!discovery?.painPoints?.length) questions.push('What is not working with their current security approach?');
    if (!discovery?.notes) questions.push('What success criteria should the proposal address?');
    return questions;
  }

  private ruleDiscoveryGuide(): AiDiscoveryGuideDraft {
    return {
      questions: [
        'What incidents, risks, or complaints triggered this security review?',
        'Which shifts, entrances, parking areas, or assets need the most coverage?',
        'Who approves the scope, budget, and start date?',
        'What would make the first 90 days of service successful?',
      ],
      talkingPoints: [
        'Frame the conversation around liability reduction and operational visibility.',
        'Tie every staffing recommendation to a property risk or coverage gap.',
        'Explain how reporting and escalation reduce management workload.',
      ],
      followUpAngles: [
        'Offer a site walkthrough to validate post orders and coverage windows.',
        'Send a proposal that maps risks to guard coverage and supervision controls.',
      ],
      qualificationChecklist: [
        'Decision maker identified',
        'Coverage hours confirmed',
        'Primary risks documented',
        'Timeline confirmed',
      ],
    };
  }

  private ruleOutreachPlan(): AiOutreachDraft {
    return {
      callOpener:
        'Hi, I am calling with a quick security coverage question. Are you the person who handles guard services or property risk?',
      talkingPoints: [
        'Lead with recent incidents, access-control gaps, or management workload.',
        'Ask about coverage windows and current provider pain before discussing guard count.',
        'Position a site walkthrough as the next low-friction step.',
      ],
      voicemailScript:
        'Hi, I am calling about security coverage and risk at your property. I wanted to ask a few quick questions about current guard needs and whether a short coverage review would help. I will send a brief email as well.',
      emailSubject: 'Security coverage question',
      emailBody:
        'Hi,\n\nI wanted to reach out about your security coverage needs. We help properties connect guard staffing, reporting, and escalation procedures to actual site risk and operating hours.\n\nWould a short coverage review or site walkthrough be useful?\n\nBest regards,',
      gatekeeperStrategy:
        'Ask for facilities, property operations, risk, or vendor management. Keep the reason simple: a security coverage review.',
      bestCallWindow:
        'Try mid-morning first, then send a short same-day email if the buyer is unavailable.',
      followUpPlan: [
        'Make one focused call with the risk-based opener.',
        'Send a concise email summarizing the coverage review offer.',
        'Follow up with a walkthrough or discovery-call request.',
      ],
    };
  }

  private ruleDiscoveryCallIntelligence(
    transcript: string,
  ): AiDiscoveryCallIntelligenceDraft {
    const summary =
      transcript
        .split(/\r?\n|[.!?]+/)
        .map((item) => item.trim())
        .find((item) => item.length > 20)
        ?.slice(0, 220) ||
      'Call notes captured. Confirm scope, buyer authority, risks, and next step before proposal.';
    const buyingSignals = this.callSnippets(
      transcript,
      /(interested|need|start|walkthrough|proposal|quote|approve|timeline|soon|urgent)/i,
      ['Buyer interest exists, but urgency and next step should be confirmed.'],
    );
    const riskSignals = this.callSnippets(
      transcript,
      /(incident|risk|liability|theft|trespass|complaint|access|parking|after hours|break-in|vandal)/i,
      ['Security risk drivers need more detail before final scope.'],
    );
    const objections = this.callSnippets(
      transcript,
      /(price|budget|cost|current provider|already have|approval|not now|contract|legal|procurement)/i,
    );
    const decisionMakers = this.callSnippets(
      transcript,
      /(owner|board|manager|director|committee|procurement|approval|approver|decision|sign off)/i,
    );
    const guardMatch = transcript.match(
      /(\d+)\s+(?:armed\s+|unarmed\s+)?guards?/i,
    );
    const propertyMatch = transcript.match(
      /\b(apartment|warehouse|office|retail|construction|hospital|school|parking|mall|industrial|commercial|residential|hotel)\b/i,
    );
    const roleMatch = transcript.match(
      /\b(owner|property manager|facilities manager|operations manager|director|procurement|board member|general manager)\b/i,
    );

    return {
      summary,
      discovery: {
        propertyType: propertyMatch?.[0] ?? null,
        buyerRole: roleMatch?.[0] ?? null,
        currentProvider: null,
        guardCount: guardMatch ? Number(guardMatch[1]) : null,
        serviceHours:
          this.callSnippets(
            transcript,
            /(24\/7|overnight|after hours|business hours|weekend|weekday|shift|hours|evening|night)/i,
          )[0] ?? null,
        painPoints: this.callSnippets(
          transcript,
          /(problem|pain|issue|missed|no show|turnover|complaint|poor|unreliable|slow)/i,
        ),
        riskConcerns: riskSignals,
        decisionTimeline:
          this.callSnippets(
            transcript,
            /(asap|urgent|start|timeline|deadline|next week|next month|quarter|renewal|contract end)/i,
          )[0] ?? null,
        budgetSensitivity:
          this.callSnippets(
            transcript,
            /(budget|price|cost|rate|expensive|quote|bid|pricing)/i,
          )[0] ?? null,
        objections,
        notes: summary,
      },
      buyingSignals,
      riskSignals,
      unansweredQuestions: [
        'Who signs off on the final scope and budget?',
        'What coverage hours and guard count are required?',
        'What start date or decision deadline should we plan around?',
      ],
      objections,
      decisionMakers,
      recommendedNextAction:
        'Confirm missing scope details, decision authority, and timeline before drafting the proposal.',
      confidenceScore: transcript.length > 700 ? 55 : transcript.length > 250 ? 45 : 35,
    };
  }

  private ruleProposal(
    company: string,
    discovery: DiscoverySnapshot,
    assessment: { proposalAngle: string | null; riskProfile: string | null } | null,
  ) {
    return `
# Security Services Proposal - ${company}

## Executive Summary
This proposal recommends a security guard program built around ${discovery.propertyType || 'the property'} risk reduction and accountable coverage.

## Risk Profile
${assessment?.riskProfile || this.displayList(discovery.riskConcerns) || 'The risk profile should be validated through final discovery.'}

## Recommended Scope
- Coverage need: ${discovery.serviceHours || 'To be confirmed'}
- Guard count: ${discovery.guardCount ?? 'To be confirmed'}
- Primary concerns: ${this.displayList(discovery.riskConcerns)}
- Current pain points: ${this.displayList(discovery.painPoints)}

## Staffing and Deployment Approach
The deployment should align guard posts, patrols, escalation procedures, and reporting cadence to the highest-risk hours and areas.

## Operational Controls
Recommended controls include post orders, supervisor review, incident escalation, daily reporting, and regular client checkpoints.

## Value Justification
${assessment?.proposalAngle || 'The service should be framed around reduced liability, better visibility, and consistent site control rather than guard hours alone.'}

## Next Steps
Confirm final coverage hours, decision timeline, and approval stakeholders, then finalize pricing and launch plan.
    `.trim();
  }

  private timelineSignal(value?: string | null) {
    const normalized = value?.toLowerCase() || '';
    if (!normalized) return 0;
    if (/(urgent|asap|immediate|week|30)/.test(normalized)) return 12;
    if (/(month|quarter|60|90)/.test(normalized)) return 7;
    return 4;
  }

  private budgetPenalty(value?: string | null) {
    const normalized = value?.toLowerCase() || '';
    if (/(high|price|tight|low|cheap|budget)/.test(normalized)) return 10;
    if (/(medium|some)/.test(normalized)) return 4;
    return 0;
  }

  private priorityTier(score: number): 'high' | 'medium' | 'low' {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  private clamp(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private daysBetween(start: Date, end: Date) {
    return Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private cleanString(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private cleanList(values?: string[] | null) {
    return Array.from(
      new Set(
        (values || [])
          .flatMap((value) => value.split('\n'))
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ).slice(0, 12);
  }

  private displayList(values?: string[] | null) {
    return values && values.length > 0 ? values.join(', ') : 'None captured';
  }

  private callSnippets(
    transcript: string,
    pattern: RegExp,
    fallback: string[] = [],
  ) {
    const snippets = transcript
      .split(/\r?\n|[.!?]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 8 && pattern.test(item))
      .map((item) => item.slice(0, 180));

    const unique = Array.from(new Set(snippets)).slice(0, 5);
    return unique.length ? unique : fallback;
  }

  private average(values: Array<number | null>) {
    const numeric = values.filter(
      (value): value is number => typeof value === 'number',
    );
    if (numeric.length === 0) return null;

    return this.clamp(
      numeric.reduce((sum, value) => sum + value, 0) / numeric.length,
    );
  }

  private tomorrow() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date;
  }
}
