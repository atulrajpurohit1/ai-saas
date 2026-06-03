import api from './api';

export type CopilotIntent =
  | 'incidents'
  | 'billing'
  | 'staffing'
  | 'revenue'
  | 'clients'
  | 'sites'
  | 'guards'
  | 'reports'
  | 'general';

export interface CopilotSourceReference {
  type: string;
  id?: string | null;
  title: string;
  url?: string;
  snippet?: string;
}

export interface CopilotActionLink {
  label: string;
  type: 'site' | 'invoice' | 'incident' | 'client' | 'guard' | 'report' | 'dashboard';
  url: string;
}

export interface CopilotAnswer {
  conversationId: string;
  question: string;
  answer: string;
  confidenceScore: number;
  source: 'ai_assisted' | 'rule_based';
  intent: CopilotIntent;
  sources: CopilotSourceReference[];
  actions: CopilotActionLink[];
  suggestedQuestions: string[];
  createdAt: string;
}

export interface AiConversationRecord {
  id: string;
  tenantId: string;
  userId: string | null;
  question: string;
  answer: string;
  confidenceScore: number;
  sourcesUsed: CopilotSourceReference[];
  createdAt: string;
}

export async function askCopilot(question: string) {
  const response = await api.post<CopilotAnswer>('ai-copilot/ask', { question });
  return response.data;
}

export async function getCopilotHistory(limit = 20) {
  const response = await api.get<AiConversationRecord[]>('ai-copilot/history', {
    params: { limit },
  });
  return response.data;
}

export async function getCopilotSuggestedQuestions() {
  const response = await api.get<string[]>('ai-copilot/suggested-questions');
  return response.data;
}
