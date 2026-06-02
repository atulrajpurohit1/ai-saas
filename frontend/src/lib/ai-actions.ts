import api from './api';

export type RecommendationActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export type RecommendationActionType =
  | 'create_follow_up_task'
  | 'notify_admin'
  | 'flag_client_risk'
  | 'flag_site_risk'
  | 'suggest_guard_reassignment'
  | 'create_invoice_followup';

export interface RecommendationAction {
  id: string;
  tenantId: string;
  aiGenerationId?: string | null;
  recommendationId: string;
  actionType: RecommendationActionType;
  title: string;
  description: string;
  status: RecommendationActionStatus;
  targetModule: string;
  targetEntityId?: string | null;
  createdAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  failureReason?: string | null;
}

export type RecommendationActionSummary = Record<RecommendationActionStatus, number>;

export interface RecommendationActionsResponse {
  generatedAt: string;
  summary: RecommendationActionSummary;
  actions: RecommendationAction[];
}

export async function getAiActions(status?: RecommendationActionStatus) {
  const response = await api.get<RecommendationActionsResponse>('ai-actions', {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function getAiAction(id: string) {
  const response = await api.get<RecommendationAction>(`ai-actions/${id}`);
  return response.data;
}

export async function approveAiAction(id: string) {
  const response = await api.post<RecommendationAction>(`ai-actions/${id}/approve`);
  return response.data;
}

export async function rejectAiAction(id: string) {
  const response = await api.post<RecommendationAction>(`ai-actions/${id}/reject`);
  return response.data;
}

export async function executeAiAction(id: string) {
  const response = await api.post<RecommendationAction>(`ai-actions/${id}/execute`);
  return response.data;
}
