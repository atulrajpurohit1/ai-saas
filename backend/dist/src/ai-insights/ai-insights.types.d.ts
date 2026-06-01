export type AiInsightCategory = 'operations' | 'clients' | 'guards' | 'sites' | 'billing' | 'incidents' | 'revenue' | 'contracts' | 'renewals';
export type AiInsightSeverity = 'positive' | 'info' | 'warning' | 'critical';
export type AiRecommendationPriority = 'high' | 'medium' | 'low';
export type AiRecommendationSource = 'rule' | 'ai';
export type AiRiskEntityType = 'site' | 'client' | 'guard';
export type AiRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RevenueInsightSource = 'ai_assisted' | 'rule_based';
export type RevenueForecastConfidence = 'high' | 'medium' | 'low';
export type RevenueForecastMonthType = 'actual' | 'forecast';
export type ContractHealthStatus = 'Excellent' | 'Good' | 'Warning' | 'High Risk';
export type RenewalOpportunityType = 'renewal_due' | 'inactive_client' | 'declining_revenue' | 'pricing_review';
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
    actionType?: 'create_follow_up_task' | 'notify_admin' | 'flag_client_risk' | 'flag_site_risk' | 'suggest_guard_reassignment' | 'create_invoice_followup';
    targetModule?: 'ai_insights' | 'client' | 'site' | 'guard' | 'shift' | 'invoice' | 'command_center' | 'operations' | 'billing' | 'revenue' | 'incident';
    targetEntityId?: string | null;
}
export interface GuardRecommendationMetrics {
    attendance_rate: number | null;
    site_shifts: number;
    late_check_ins: number;
    missed_shifts: number;
    incidents: number;
    upcoming_workload: number;
}
export interface GuardRecommendation {
    guard_id: string;
    guard_name: string;
    score: number;
    reasons: string[];
    warnings: string[];
    explanation: string;
    metrics: GuardRecommendationMetrics;
}
export interface SchedulingCoverageGap {
    shiftId: string;
    siteId: string;
    siteName: string;
    startTime: string;
    endTime: string;
    requiredGuards: number;
    assignedGuards: number;
    shortageSlots: number;
    status: string;
}
export interface SchedulingOverview {
    generatedAt: string;
    horizonDays: number;
    totalUpcomingShifts: number;
    fullyCoveredShifts: number;
    coverageGaps: number;
    shortageSlots: number;
    unassignedShifts: number;
    gaps: SchedulingCoverageGap[];
    recommendations: AiRecommendation[];
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
export interface RevenueForecastMonth {
    month: string;
    label: string;
    type: RevenueForecastMonthType;
    actualRevenue: number;
    paidRevenue: number;
    outstandingRevenue: number;
    forecastRevenue: number;
}
export interface RevenueForecastResponse {
    generatedAt: string;
    summary: AiInsightMetric[];
    insights: AiInsightItem[];
    months: RevenueForecastMonth[];
    nextMonthRevenue: number;
    monthlyGrowthRate: number;
    quarterlyForecast: number;
    annualForecast: number;
    expectedCollections: number;
    expectedCollectionsNext30Days: number;
    outstandingAmount: number;
    confidence: RevenueForecastConfidence;
    methodology: string;
}
export interface ContractHealthRow {
    clientId: string;
    name: string;
    healthScore: number;
    healthStatus: ContractHealthStatus;
    activeContract: boolean;
    contractStartDate: string | null;
    contractEndDate: string | null;
    daysUntilRenewal: number | null;
    invoiceCount: number;
    totalRevenue: number;
    outstandingAmount: number;
    averagePaymentDays: number | null;
    incidentCount: number;
    disputeCount: number;
    lastInvoiceAt: string | null;
    indicators: string[];
}
export interface ClientValueRow {
    clientId: string;
    name: string;
    totalRevenue: number;
    revenueShare: number;
    currentPeriodRevenue: number;
    previousPeriodRevenue: number;
    growthRate: number;
    invoiceCount: number;
    disputeCount: number;
    incidentCount: number;
    clientValueScore: number;
    retentionScore: number;
    growthPotentialScore: number;
    indicators: string[];
}
export interface RenewalOpportunityRow {
    id: string;
    clientId: string;
    name: string;
    type: RenewalOpportunityType;
    priority: AiRecommendationPriority;
    dueDate: string | null;
    daysUntilRenewal: number | null;
    estimatedRevenueAtRisk: number;
    recommendation: string;
    reason: string;
}
export type ContractIntelligenceResponse = AiInsightsSection<ContractHealthRow>;
export type ClientValueAnalysisResponse = AiInsightsSection<ClientValueRow>;
export type RenewalOpportunitiesResponse = AiInsightsSection<RenewalOpportunityRow>;
export interface FinancialRecommendationsResponse {
    generatedAt: string;
    source: RevenueInsightSource;
    summary: AiInsightMetric[];
    recommendations: AiRecommendation[];
    aiRecommendations: AiRecommendation[];
    ruleRecommendations: AiRecommendation[];
}
export interface RevenueInsightsDashboard {
    generatedAt: string;
    source: RevenueInsightSource;
    aiSummary: string;
    forecast: RevenueForecastResponse;
    clientValue: ClientValueAnalysisResponse;
    contracts: ContractIntelligenceResponse;
    renewals: RenewalOpportunitiesResponse;
    recommendations: FinancialRecommendationsResponse;
}
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
