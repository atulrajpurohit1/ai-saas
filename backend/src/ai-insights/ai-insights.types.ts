export type AiInsightCategory =
  | 'operations'
  | 'clients'
  | 'guards'
  | 'sites'
  | 'billing'
  | 'incidents';

export type AiInsightSeverity = 'positive' | 'info' | 'warning' | 'critical';

export type AiRecommendationPriority = 'high' | 'medium' | 'low';

export type AiRecommendationSource = 'rule' | 'ai';

export type AiRiskEntityType = 'site' | 'client' | 'guard';

export type AiRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AiInsightMetric {
  label: string;
  value: string | number;
  detail?: string;
  tone?: AiInsightSeverity;
}

export interface AiInsightItem {
  id: string;
  category: AiInsightCategory;
  severity: AiInsightSeverity;
  title: string;
  message: string;
  subject?: string;
  metricLabel?: string;
  metricValue?: string | number;
}

export interface AiRecommendation {
  id: string;
  category: AiInsightCategory;
  priority: AiRecommendationPriority;
  title: string;
  action: string;
  reason: string;
  source: AiRecommendationSource;
}

export interface ClientInsightRow {
  clientId: string;
  name: string;
  active: boolean;
  revenue: number;
  revenueShare: number;
  incidentCount: number;
  contractActivity: number;
  siteCount: number;
}

export interface GuardInsightRow {
  guardId: string;
  name: string;
  scheduledShifts: number;
  attendanceRecords: number;
  attendanceRate: number | null;
  lateCheckIns: number;
  missedShifts: number;
  incidentCount: number;
}

export interface SiteInsightRow {
  siteId: string;
  name: string;
  clientName: string | null;
  scheduledShifts: number;
  incidentCount: number;
  incidentRate: number;
  coverageIssues: number;
  shortageSlots: number;
  attendanceRate: number | null;
}

export interface BillingClientRow {
  clientId: string;
  name: string;
  revenue: number;
  paidAmount: number;
  outstandingAmount: number;
  disputedAmount: number;
  invoiceCount: number;
}

export interface IncidentSeverityBreakdown {
  severity: string;
  count: number;
  percent: number;
}

export interface IncidentRiskRow {
  entityId: string;
  entityType: AiRiskEntityType;
  name: string;
  relatedName?: string | null;
  riskScore: number;
  riskLevel: AiRiskLevel;
  incidentCount: number;
  criticalCount: number;
  highCount: number;
  recent7DayCount: number;
  repeatedIncidentTypes: number;
  lastIncidentAt: string | null;
  indicators: string[];
}

export interface IncidentTrendRow {
  id: string;
  label: string;
  type: 'incident_type' | 'day_pattern' | 'time_pattern';
  count: number;
  riskScore: number;
  detail: string;
}

export interface AiInsightsSection<T> {
  generatedAt: string;
  summary: AiInsightMetric[];
  insights: AiInsightItem[];
  rows: T[];
}

export type ClientInsightsResponse = AiInsightsSection<ClientInsightRow>;
export type GuardInsightsResponse = AiInsightsSection<GuardInsightRow>;
export type SiteInsightsResponse = AiInsightsSection<SiteInsightRow>;
export type BillingInsightsResponse = AiInsightsSection<BillingClientRow>;

export interface IncidentInsightsResponse {
  generatedAt: string;
  source: 'ai_assisted' | 'rule_based';
  summary: AiInsightMetric[];
  aiSummary: string;
  insights: AiInsightItem[];
  severityBreakdown: IncidentSeverityBreakdown[];
  highRiskSites: IncidentRiskRow[];
  clientRisks: IncidentRiskRow[];
  guardRisks: IncidentRiskRow[];
  recurringIncidentTypes: IncidentTrendRow[];
  timePatterns: IncidentTrendRow[];
  recommendations: AiRecommendation[];
}

export interface AiInsightsOverview {
  summary: AiInsightMetric[];
  insights: AiInsightItem[];
}

export interface AiInsightsDashboard {
  generatedAt: string;
  source: 'ai_assisted' | 'rule_based';
  overview: AiInsightsOverview;
  clients: ClientInsightsResponse;
  guards: GuardInsightsResponse;
  sites: SiteInsightsResponse;
  billing: BillingInsightsResponse;
  recommendations: AiRecommendation[];
}
