import { AiRecommendation } from '../ai-insights/ai-insights.types';

export type AiGenerationStatus = 'success' | 'failed' | 'fallback';

export interface LogAiGenerationInput {
  tenantId: string;
  createdBy?: string;
  promptVersion?: string;
  promptKey?: string;
  inputSource?: unknown;
  modelUsed?: string;
  sourceModule: string;
  generatedOutput: unknown;
  clientVisible?: boolean;
  fallbackUsed: boolean;
  status: AiGenerationStatus;
  errorMessage?: string;
}

export interface FeedbackPromptSummary {
  averageRating: number | null;
  totalFeedback: number;
  usefulCount: number;
  accurateCount: number;
  summaryText: string | null;
  rejectedActionTypes: string[];
}

export interface AiMonitoringMetrics {
  generatedAt: string;
  totals: {
    totalAiGenerations: number;
    totalFeedback: number;
    acceptedRecommendations: number;
    rejectedRecommendations: number;
    executedAiActions: number;
    failedAiActions: number;
    averageFeedbackRating: number | null;
    aiSuccessCount: number;
    aiFailureCount: number;
    fallbackUsageCount: number;
  };
  quality: {
    accuracyRate: number;
    usefulnessRate: number;
    actionApprovalRate: number;
    actionExecutionSuccessRate: number;
    fallbackDependencyRate: number;
  };
  statusBreakdown: Record<AiGenerationStatus, number>;
  actionStatusBreakdown: Record<string, number>;
  sourceModuleBreakdown: Array<{
    sourceModule: string;
    total: number;
    success: number;
    failed: number;
    fallback: number;
    fallbackUsed: number;
  }>;
  recentFeedback: Array<{
    id: string;
    rating: number;
    feedbackText: string | null;
    isUseful: boolean;
    isAccurate: boolean;
    recommendationId: string | null;
    actionId: string | null;
    sourceModule: string;
    createdAt: string;
  }>;
}

export type FeedbackAwareRecommendation = AiRecommendation & {
  aiGenerationId?: string;
};
