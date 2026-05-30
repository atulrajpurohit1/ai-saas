import api from './api';
import { AiRecommendation, AiInsightMetric, AiRiskLevel } from './ai-insights';

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
  generatedAt: string;
  source: 'ai_assisted' | 'rule_based';
  overview: CommandCenterOverview;
  risks: CommandCenterRiskCenter;
  workforce: WorkforceHealth;
  financial: FinancialHealthOverview;
  recommendations: AiRecommendation[];
  dailySummary: DailySummary;
}

export async function getCommandCenterDashboard() {
  const response = await api.get<CommandCenterDashboard>('ai-command-center');
  return response.data;
}

export async function getCommandCenterSummary() {
  const response = await api.get<DailySummary>('ai-command-center/summary');
  return response.data;
}

export async function getCommandCenterRecommendations() {
  const response = await api.get<AiRecommendation[]>('ai-command-center/recommendations');
  return response.data;
}

export async function getCommandCenterRisks() {
  const response = await api.get<CommandCenterRiskCenter>('ai-command-center/risks');
  return response.data;
}
