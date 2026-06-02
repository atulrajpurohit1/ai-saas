import api from './api';

export interface CreateAiFeedbackPayload {
  aiGenerationId?: string;
  recommendationId?: string;
  actionId?: string;
  rating: number;
  feedbackText?: string;
  isUseful: boolean;
  isAccurate: boolean;
}

export interface AiFeedback {
  id: string;
  tenantId: string;
  aiGenerationId: string;
  recommendationId?: string | null;
  actionId?: string | null;
  rating: number;
  feedbackText?: string | null;
  isUseful: boolean;
  isAccurate: boolean;
  createdBy: string;
  createdAt: string;
  aiGeneration?: {
    id: string;
    sourceModule: string;
    modelUsed: string;
    promptVersion: string;
    status: string;
    fallbackUsed: boolean;
    createdAt: string;
  };
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
  statusBreakdown: Record<string, number>;
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

export async function submitAiFeedback(payload: CreateAiFeedbackPayload) {
  const response = await api.post<AiFeedback>('ai-feedback', payload);
  return response.data;
}

export async function getAiFeedback() {
  const response = await api.get<AiFeedback[]>('ai-feedback');
  return response.data;
}

export async function getAiMonitoring() {
  const response = await api.get<AiMonitoringMetrics>('ai-monitoring');
  return response.data;
}
