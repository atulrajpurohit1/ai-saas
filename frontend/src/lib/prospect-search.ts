import api from '@/lib/api';

export interface ProspectSearchFilters {
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  employeeMin: number | null;
  employeeMax: number | null;
  revenueRange: string | null;
  keywords: string[];
}

export interface ProspectCompany {
  id: string;
  name: string;
  industry: string;
  website: string;
  city: string;
  state: string;
  country: string;
  employeeCount: number;
  revenueRange: string;
  description: string;
  matchScore: number;
}

export interface ProspectSearchResult {
  prompt: string;
  filters: ProspectSearchFilters;
  results: ProspectCompany[];
  totalMatches: number;
}

export interface ProspectCompanyInsight {
  whyMatch: string;
  opportunity: string;
  outreachStrategy: string;
  securityNeeds: string;
  nextConversation: string;
}

export interface DuplicateLeadSummary {
  id: string;
  name: string;
  company: string;
}

export interface ImportedLeadSummary {
  id: string;
  name: string;
  company: string;
  email: string | null;
  status: string;
}

export type ImportProspectResult =
  | { duplicate: true; existingLead: DuplicateLeadSummary }
  | { duplicate: false; lead: ImportedLeadSummary };

export interface ProspectSearchHistoryEntry {
  id: string;
  prompt: string;
  filters: ProspectSearchFilters;
  provider: string;
  resultCount: number;
  searchedAt: string;
}

export interface SavedProspectSearchEntry {
  id: string;
  name: string;
  prompt: string;
  filters: ProspectSearchFilters;
  createdAt: string;
  updatedAt: string;
}

export async function searchProspects(prompt: string) {
  const res = await api.post<ProspectSearchResult>('prospect-search/search', { prompt });
  return res.data;
}

export async function recordProspectView(companyId: string, companyName: string) {
  const res = await api.post<{ ok: true }>('prospect-search/view', {
    companyId,
    companyName,
  });
  return res.data;
}

export async function getProspectCompanyInsight(company: ProspectCompany, prompt?: string) {
  const res = await api.post<ProspectCompanyInsight>('prospect-search/insights', {
    company,
    prompt,
  });
  return res.data;
}

export async function importProspectAsLead(company: ProspectCompany, force = false) {
  const res = await api.post<ImportProspectResult>('prospect-search/import', {
    company,
    force,
  });
  return res.data;
}

export async function getProspectSearchHistory(limit = 10) {
  const res = await api.get<ProspectSearchHistoryEntry[]>('prospect-search/history', {
    params: { limit },
  });
  return res.data;
}

export async function getSavedProspectSearches() {
  const res = await api.get<SavedProspectSearchEntry[]>('prospect-search/saved-searches');
  return res.data;
}

export async function saveProspectSearch(
  name: string,
  prompt: string,
  filters: ProspectSearchFilters,
) {
  const res = await api.post<SavedProspectSearchEntry>('prospect-search/saved-searches', {
    name,
    prompt,
    filters,
  });
  return res.data;
}

export async function renameSavedProspectSearch(id: string, name: string) {
  const res = await api.patch<SavedProspectSearchEntry>(
    `prospect-search/saved-searches/${id}`,
    { name },
  );
  return res.data;
}

export async function deleteSavedProspectSearch(id: string) {
  const res = await api.delete<{ success: true }>(`prospect-search/saved-searches/${id}`);
  return res.data;
}
