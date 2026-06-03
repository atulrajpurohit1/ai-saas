import api from './api';
import { AiInsightMetric, AiRecommendation, AiRiskLevel } from './ai-insights';
import { BasePrediction } from './ai-predictions';

export type BusinessHealthStatus = 'Excellent' | 'Good' | 'Warning' | 'Critical';

export interface BusinessHealthComponent {
  key:
    | 'revenue'
    | 'retention'
    | 'incidentRisk'
    | 'staffingCoverage'
    | 'paymentStatus'
    | 'contractHealth';
  label: string;
  score: number;
  status: BusinessHealthStatus;
  detail: string;
}

export interface BusinessHealthOverview {
  score: number;
  status: BusinessHealthStatus;
  summary: string;
  components: BusinessHealthComponent[];
  metrics: AiInsightMetric[];
}

export interface ExecutiveRiskItem {
  id: string;
  entityType: 'client' | 'site' | 'guard' | 'invoice' | 'contract';
  name: string;
  category: 'client_risk' | 'site_risk' | 'guard_risk' | 'payment_risk' | 'renewal_risk';
  riskScore: number;
  riskLevel: AiRiskLevel;
  detail: string;
  indicators: string[];
  recommendation: string;
  targetEntityId?: string | null;
}

export interface ExecutiveOpportunityItem {
  id: string;
  entityType: 'client' | 'contract' | 'revenue' | 'staffing';
  name: string;
  category:
    | 'high_value_client'
    | 'renewal_opportunity'
    | 'revenue_growth'
    | 'staffing_optimization';
  opportunityScore: number;
  estimatedValue?: number | null;
  detail: string;
  indicators: string[];
  recommendation: string;
  targetEntityId?: string | null;
}

export interface RevenueGrowthOverview {
  monthlyGrowthRate: number;
  nextMonthRevenue: number;
  quarterlyForecast: number;
  annualForecast: number;
  expectedCollections: number;
  outstandingAmount: number;
  confidence: string;
  metrics: AiInsightMetric[];
}

export interface ClientRiskValueOverview {
  highValueClients: ExecutiveOpportunityItem[];
  atRiskClients: ExecutiveRiskItem[];
  metrics: AiInsightMetric[];
}

export interface OperationsRiskOverview {
  highRiskSites: ExecutiveRiskItem[];
  staffingRisks: ExecutiveRiskItem[];
  incidentRisks: ExecutiveRiskItem[];
  metrics: AiInsightMetric[];
}

export interface WorkforcePerformanceRow {
  guardId: string;
  name: string;
  performanceScore: number;
  attendanceRate: number | null;
  missedShifts: number;
  lateCheckIns: number;
  incidentCount: number;
  status: 'best' | 'watchlist';
  indicators: string[];
}

export interface WorkforcePerformanceOverview {
  bestGuards: WorkforcePerformanceRow[];
  watchlistGuards: WorkforcePerformanceRow[];
  metrics: AiInsightMetric[];
}

export interface ForecastsPredictionsOverview {
  metrics: AiInsightMetric[];
  topPredictions: BasePrediction[];
  revenueForecast: RevenueGrowthOverview;
}

export interface AiExecutiveCenterDashboard {
  aiGenerationId?: string;
  generatedAt: string;
  source: 'ai_assisted' | 'rule_based';
  executiveSummary: string;
  businessHealth: BusinessHealthOverview;
  revenueGrowth: RevenueGrowthOverview;
  clientRiskValue: ClientRiskValueOverview;
  operationsRisk: OperationsRiskOverview;
  workforcePerformance: WorkforcePerformanceOverview;
  forecastsPredictions: ForecastsPredictionsOverview;
  risks: ExecutiveRiskItem[];
  opportunities: ExecutiveOpportunityItem[];
  recommendations: AiRecommendation[];
}

export async function getExecutiveCenterDashboard() {
  const response = await api.get<AiExecutiveCenterDashboard>('ai-executive-center');
  return response.data;
}

export async function getExecutiveCenterSummary() {
  const response = await api.get<Pick<AiExecutiveCenterDashboard, 'generatedAt' | 'source' | 'executiveSummary' | 'businessHealth'>>('ai-executive-center/summary');
  return response.data;
}

export async function getExecutiveCenterRisks() {
  const response = await api.get<{
    generatedAt: string;
    risks: ExecutiveRiskItem[];
    operationsRisk: OperationsRiskOverview;
    clientRiskValue: ClientRiskValueOverview;
  }>('ai-executive-center/risks');
  return response.data;
}

export async function getExecutiveCenterOpportunities() {
  const response = await api.get<{
    generatedAt: string;
    opportunities: ExecutiveOpportunityItem[];
    clientRiskValue: ClientRiskValueOverview;
  }>('ai-executive-center/opportunities');
  return response.data;
}

export async function getExecutiveCenterRecommendations() {
  const response = await api.get<{
    generatedAt: string;
    recommendations: AiRecommendation[];
  }>('ai-executive-center/recommendations');
  return response.data;
}
