import api from '@/lib/api';

export interface KnowledgeEntry {
  id: string;
  tenantId: string;
  title: string;
  category: string;
  sourceType?: string | null;
  sourceId?: string | null;
  summary: string;
  detailedContent: string;
  keywords: string[];
  tags: string[];
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  relevanceScore?: number;
}

export interface KnowledgeEntryPayload {
  title: string;
  category: string;
  sourceType?: string;
  sourceId?: string;
  summary: string;
  detailedContent: string;
  keywords?: string[];
  tags?: string[];
}

export async function getKnowledgeCategories() {
  const res = await api.get<string[]>('knowledge-base/categories');
  return res.data;
}

export async function getKnowledgeEntries(filters?: {
  category?: string;
  tag?: string;
  includeArchived?: boolean;
}) {
  const res = await api.get<KnowledgeEntry[]>('knowledge-base', {
    params: {
      category: filters?.category || undefined,
      tag: filters?.tag || undefined,
      include_archived: filters?.includeArchived ? 'true' : undefined,
    },
  });
  return res.data;
}

export async function searchKnowledgeEntries(filters: {
  q?: string;
  category?: string;
  tag?: string;
}) {
  const res = await api.get<KnowledgeEntry[]>('knowledge-base/search', {
    params: {
      q: filters.q || undefined,
      category: filters.category || undefined,
      tag: filters.tag || undefined,
    },
  });
  return res.data;
}

export async function createKnowledgeEntry(data: KnowledgeEntryPayload) {
  const res = await api.post<KnowledgeEntry>('knowledge-base', data);
  return res.data;
}

export async function updateKnowledgeEntry(id: string, data: Partial<KnowledgeEntryPayload>) {
  const res = await api.patch<KnowledgeEntry>(`knowledge-base/${id}`, data);
  return res.data;
}

export async function archiveKnowledgeEntry(id: string) {
  const res = await api.post<KnowledgeEntry>(`knowledge-base/${id}/archive`);
  return res.data;
}
