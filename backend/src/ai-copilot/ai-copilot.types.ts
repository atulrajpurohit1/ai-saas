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

export type CopilotSourceReference = {
  type: string;
  id?: string | null;
  title: string;
  url?: string;
  snippet?: string;
};

export type CopilotActionLink = {
  label: string;
  type: 'site' | 'invoice' | 'incident' | 'client' | 'guard' | 'report' | 'dashboard';
  url: string;
};

export type CopilotAnswer = {
  conversationId?: string;
  question: string;
  answer: string;
  confidenceScore: number;
  source: 'ai_assisted' | 'rule_based';
  intent: CopilotIntent;
  sources: CopilotSourceReference[];
  actions: CopilotActionLink[];
  suggestedQuestions: string[];
  createdAt: string;
};

export type CopilotStructuredResult = {
  intent: CopilotIntent;
  answer: string;
  confidenceScore: number;
  sources: CopilotSourceReference[];
  actions: CopilotActionLink[];
  knowledgeQuery: string;
  context: Record<string, unknown>;
};

export type AiConversationRecord = {
  id: string;
  tenantId: string;
  userId: string | null;
  question: string;
  answer: string;
  confidenceScore: number;
  sourcesUsed: CopilotSourceReference[];
  createdAt: Date;
};
