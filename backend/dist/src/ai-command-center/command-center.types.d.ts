import { AiInsightMetric, AiRecommendation, AiRiskLevel, SchedulingOverview } from '../ai-insights/ai-insights.types';
export interface CommandCenterOverview {
    activeClients: number;
    totalClients: number;
    activeSites: number;
    guardsOnDuty: number;
    totalGuards: number;
    openIncidents: number;
    outstandingInvoices: number;
    outstandingAmount: number;
    revenueForecast: number;
    revenueForecastLabel: string;
    staffingAlerts: number;
    coverageGaps: number;
    metrics: AiInsightMetric[];
}
export type CommandCenterRiskEntityType = 'site' | 'client' | 'contract' | 'guard';
export interface CommandCenterRiskItem {
    id: string;
    entityType: CommandCenterRiskEntityType;
    name: string;
    relatedName?: string | null;
    riskScore: number;
    riskLevel: AiRiskLevel;
    incidentCount: number;
    indicators: string[];
}
export interface CommandCenterRiskCenter {
    sites: CommandCenterRiskItem[];
    clients: CommandCenterRiskItem[];
    contracts: CommandCenterRiskItem[];
    totalHighRisk: number;
    totalCritical: number;
}
export interface WorkforceInsightRow {
    guardId: string;
    name: string;
    scheduledShifts: number;
    attendanceRate: number | null;
    lateCheckIns: number;
    missedShifts: number;
    incidentCount: number;
}
export interface WorkforceHealth {
    totalGuards: number;
    overallAttendanceRate: number | null;
    totalLateCheckIns: number;
    totalMissedShifts: number;
    guards: WorkforceInsightRow[];
    recommendations: string[];
    metrics: AiInsightMetric[];
}
export interface FinancialHealthOverview {
    forecastedRevenue: number;
    quarterlyForecast: number;
    annualForecast: number;
    outstandingBalance: number;
    disputedAmount: number;
    disputedInvoiceCount: number;
    paidAmount: number;
    collectionRate: number | null;
    averagePaymentDays: number | null;
    monthlyGrowthRate: number;
    expectedCollections: number;
    metrics: AiInsightMetric[];
}
export interface DailySummary {
    date: string;
    incidentSummary: string;
    attendanceSummary: string;
    staffingSummary: string;
    financeSummary: string;
    topRecommendations: string[];
    aiNarrative: string;
    source: 'ai_assisted' | 'rule_based';
}
export interface CommandCenterDashboard {
    aiGenerationId?: string;
    generatedAt: string;
    source: 'ai_assisted' | 'rule_based';
    overview: CommandCenterOverview;
    risks: CommandCenterRiskCenter;
    workforce: WorkforceHealth;
    financial: FinancialHealthOverview;
    scheduling: SchedulingOverview;
    recommendations: AiRecommendation[];
    dailySummary: DailySummary;
}
