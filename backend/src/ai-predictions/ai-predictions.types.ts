import { AiInsightMetric, AiRecommendation } from '../ai-insights/ai-insights.types';

export type PredictionRiskLevel = 'low' | 'medium' | 'high';

export type PredictionCategory =
  | 'staffing'
  | 'incidents'
  | 'churn'
  | 'payment'
  | 'renewal';

export interface PredictionSupportingData {
  label: string;
  value: string | number;
  detail?: string;
}

export interface BasePrediction {
  id: string;
  category: PredictionCategory;
  entityType: 'site' | 'client' | 'contract' | 'shift' | 'pattern';
  entityId?: string | null;
  title: string;
  summary: string;
  riskLevel: PredictionRiskLevel;
  riskScore: number;
  probability: number;
  confidenceScore: number;
  explanation: string;
  supportingData: PredictionSupportingData[];
  recommendations: string[];
  timeframe: string;
}

export interface StaffingPrediction extends BasePrediction {
  category: 'staffing';
  shortageSlots: number;
  affectedShifts: number;
  conflictCount: number;
}

export interface IncidentPrediction extends BasePrediction {
  category: 'incidents';
  expectedTrend: 'increasing' | 'stable' | 'decreasing';
  escalationProbability: number;
}

export interface ChurnPrediction extends BasePrediction {
  category: 'churn';
  churnScore: PredictionRiskLevel;
}

export interface PaymentRiskPrediction extends BasePrediction {
  category: 'payment';
  paymentRiskScore: PredictionRiskLevel;
}

export interface RenewalRiskPrediction extends BasePrediction {
  category: 'renewal';
  nonRenewalProbability: number;
  renewalLikelihood: number;
  contractHealthTrend: 'improving' | 'stable' | 'declining';
}

export interface PredictionSection<T extends BasePrediction> {
  generatedAt: string;
  summary: AiInsightMetric[];
  predictions: T[];
}

export interface PredictionDashboard {
  aiGenerationId?: string;
  generatedAt: string;
  source: 'rule_based' | 'ai_assisted';
  summary: AiInsightMetric[];
  staffing: PredictionSection<StaffingPrediction>;
  incidents: PredictionSection<IncidentPrediction>;
  churn: PredictionSection<ChurnPrediction>;
  payments: PredictionSection<PaymentRiskPrediction>;
  renewals: PredictionSection<RenewalRiskPrediction>;
  recommendations: AiRecommendation[];
  methodology: string[];
}
