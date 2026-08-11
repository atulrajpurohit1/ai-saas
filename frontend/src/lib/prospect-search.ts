import api from '@/lib/api';

export interface ProspectCompany {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  employeeCount?: number;
  revenueRange?: string;
  description?: string;
}

export interface ProspectSearchResult {
  companyName: string;
  insight: ProspectCompanyInsight;
}

/**
 * BlackPearl playbook generation is asynchronous and commonly takes
 * minutes, so a search either resolves immediately (cache hit) or returns a
 * job to poll via getProspectSearchJobStatus().
 */
export type ProspectSearchSubmission =
  | { status: 'completed'; companyName: string; insight: ProspectCompanyInsight }
  | { status: 'pending'; jobId: string; companyName: string };

export type ProspectSearchJobStatus =
  | { status: 'pending'; progress: number | null }
  | { status: 'completed'; companyName: string; insight: ProspectCompanyInsight }
  | { status: 'failed'; message: string };

export interface ProspectCompanyPersona {
  name: string;
  title?: string;
  description?: string;
}

export interface ProspectCompanyObjection {
  objection: string;
  response: string;
}

/** Mirrors BlackPearl's actual playbook result schema. Only companyName is guaranteed. */
export interface ProspectCompanyInsight {
  companyName: string;
  domain?: string;
  website?: string;
  businessSummary?: string;
  businessObjective?: string;
  valueProps: string[];
  salesAngles: string[];
  keyPersonas: ProspectCompanyPersona[];
  potentialObjections: ProspectCompanyObjection[];
  meetingNoteExample?: string;
  contactOverview?: string;
  readinessLevel?: string;
  documentUrl?: string;
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
  provider: string;
  resultCount: number;
  searchedAt: string;
}

export interface SavedProspectSearchEntry {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}

export async function searchProspects(companyName: string) {
  const res = await api.post<ProspectSearchSubmission>('prospect-search/search', { companyName });
  return res.data;
}

export async function getProspectSearchJobStatus(jobId: string) {
  const res = await api.get<ProspectSearchJobStatus>(`prospect-search/search/${jobId}`);
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

export async function saveProspectSearch(name: string, prompt: string) {
  const res = await api.post<SavedProspectSearchEntry>('prospect-search/saved-searches', {
    name,
    prompt,
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

/**
 * Real, multi-company/multi-contact prospect discovery (BlackPearl's
 * Prospecting capability) - the primary Prospect Search experience. Distinct
 * from searchProspects() above, which only ever researches one already-named
 * company.
 */
export interface DiscoverProspectsRequest {
  objective: string;
  locations?: string[];
  industries?: string[];
  jobTitles?: string[];
  keywords?: string[];
  companyHeadcountMin?: number;
  companyHeadcountMax?: number;
  limit?: number;
}

export interface DiscoveredProspectContact {
  fullName?: string;
  jobTitle?: string;
  headline?: string;
  location?: string;
  profileUrl?: string;
  email?: string;
}

export interface DiscoveredProspectSignal {
  label: string;
  snippet?: string;
}

export interface DiscoveredProspect {
  id: string;
  companyName?: string;
  companyDomain?: string;
  companyIndustry?: string;
  companyHeadcount?: number;
  companyLocation?: string;
  companyDescription?: string;
  contact: DiscoveredProspectContact;
  qualificationScore: number;
  qualificationReason?: string;
  signals: DiscoveredProspectSignal[];
}

export interface ProspectDiscoveryResult {
  query: string;
  discoveredCount: number;
  qualifiedCount: number;
  prospects: DiscoveredProspect[];
}

export type ProspectDiscoverySubmission =
  | { status: 'completed'; query: string; result: ProspectDiscoveryResult }
  | { status: 'pending'; jobId: string; query: string };

export type ProspectDiscoveryJobStatus =
  | { status: 'pending'; progress: number | null; stageLabel: string | null }
  | { status: 'completed'; query: string; result: ProspectDiscoveryResult }
  | { status: 'failed'; message: string };

export async function discoverProspects(request: DiscoverProspectsRequest) {
  const res = await api.post<ProspectDiscoverySubmission>('prospect-search/discover', request);
  return res.data;
}

/**
 * POST rather than GET - polling needs the original search criteria back to
 * label the result and match the server's cache key, and that criteria can
 * include several filter arrays that aren't practical to round-trip through
 * a query string.
 */
export async function getProspectDiscoveryJobStatus(
  jobId: string,
  request: DiscoverProspectsRequest,
) {
  const res = await api.post<ProspectDiscoveryJobStatus>(
    `prospect-search/discover/${jobId}`,
    request,
  );
  return res.data;
}
