import api from './api';

export type KnowledgeCategory =
  | 'incidents'
  | 'operations'
  | 'staffing'
  | 'contracts'
  | 'billing'
  | 'client_management'
  | 'scheduling';

export interface KnowledgeEntry {
  id: string;
  tenantId: string;
  title: string;
  category: KnowledgeCategory;
  sourceType: string | null;
  sourceId: string | null;
  summary: string;
  detailedContent: string;
  keywords: string[];
  tags: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  relevanceScore?: number;
}

export interface KnowledgeEntryInput {
  title: string;
  category: KnowledgeCategory;
  sourceType?: string;
  sourceId?: string;
  summary: string;
  detailedContent: string;
  keywords?: string[];
  tags?: string[];
}

export const knowledgeCategories: KnowledgeCategory[] = [
  'incidents',
  'operations',
  'staffing',
  'contracts',
  'billing',
  'client_management',
  'scheduling',
];

export async function getKnowledgeEntries(params?: {
  category?: KnowledgeCategory;
  tag?: string;
  includeArchived?: boolean;
}) {
  const response = await api.get<KnowledgeEntry[]>('knowledge', { params });
  return response.data;
}

export async function searchKnowledge(params: {
  q?: string;
  category?: KnowledgeCategory;
  tag?: string;
}) {
  const response = await api.get<KnowledgeEntry[]>('knowledge/search', { params });
  return response.data;
}

export async function getKnowledgeEntry(id: string) {
  const response = await api.get<KnowledgeEntry>(`knowledge/${id}`);
  return response.data;
}

export async function createKnowledgeEntry(input: KnowledgeEntryInput) {
  const response = await api.post<KnowledgeEntry>('knowledge', input);
  return response.data;
}

export async function updateKnowledgeEntry(id: string, input: Partial<KnowledgeEntryInput>) {
  const response = await api.patch<KnowledgeEntry>(`knowledge/${id}`, input);
  return response.data;
}

export async function archiveKnowledgeEntry(id: string) {
  const response = await api.post<KnowledgeEntry>(`knowledge/${id}/archive`);
  return response.data;
}
