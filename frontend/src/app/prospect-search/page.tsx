'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import ProspectDetailsDrawer from '@/components/ProspectDetailsDrawer';
import ProspectDiscoveryResultCard from '@/components/ProspectDiscoveryResultCard';
import ProspectSearchFilterChip from '@/components/ProspectSearchFilterChip';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { getCrmConnectorStatus } from '@/lib/integrations';
import {
  DiscoverProspectsRequest,
  ProspectCompany,
  ProspectCompanyInsight,
  ProspectDiscoveryResult,
  ProspectSearchHistoryEntry,
  SavedProspectSearchEntry,
  deleteSavedProspectSearch,
  discoverProspects,
  getProspectDiscoveryJobStatus,
  getProspectSearchHistory,
  getSavedProspectSearches,
  renameSavedProspectSearch,
  saveProspectSearch,
  searchProspects,
  getProspectSearchJobStatus,
} from '@/lib/prospect-search';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Briefcase,
  Building2,
  Clock,
  Factory,
  Loader2,
  MapPin,
  Pencil,
  Radar,
  RotateCcw,
  Tags,
  Trash2,
  Users,
} from 'lucide-react';

const DISCOVERY_PROVIDER = 'blackpearl_prospecting';

type FilterKey = 'company' | 'location' | 'industry' | 'jobTitle' | 'headcount' | 'keywords';

// Two honest presets for the real `limit` sent to BlackPearl - not a
// separate BlackPearl "mode", just how many prospects we ask for. Preview
// keeps a quick look cheap; Full uses our full app-level cap (BlackPearl's
// own per-request max is 100 - see docs/features/03-sales-tools.md).
const SEARCH_MODE_LIMITS = { preview: 5, full: 20 } as const;
type SearchMode = keyof typeof SEARCH_MODE_LIMITS;

// Our own live testing showed turbo-mode prospecting jobs typically complete
// in about a minute - poll modestly and don't wait unreasonably long.
const JOB_POLL_INTERVAL_MS = 5_000;
const JOB_MAX_POLL_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60_000;

// The separate single-company deep-research flow (BlackPearl Playbooks)
// takes much longer, per BlackPearl's own guidance.
const DEEP_RESEARCH_POLL_INTERVAL_MS = 20_000;
const DEEP_RESEARCH_MAX_POLL_MS = 30 * 60 * 1000;

function isTransient503(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 503;
}

function parseList(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <Radar className="mb-4 text-slate-600" size={48} aria-hidden="true" />
      <p className="max-w-sm text-sm font-semibold text-slate-400">
        Describe who you&apos;re looking for to discover real, matching companies and contacts.
      </p>
      <p className="mt-2 max-w-sm text-xs text-slate-500">
        e.g. &ldquo;Marketing agencies in India&rdquo; or &ldquo;SaaS companies in California with 50-500 employees&rdquo;
      </p>
    </div>
  );
}

export default function ProspectSearchPage() {
  const { can } = useAuth();

  // --- Primary discovery search state ---
  const [objective, setObjective] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [companyNamesText, setCompanyNamesText] = useState('');
  const [locationsText, setLocationsText] = useState('');
  const [industriesText, setIndustriesText] = useState('');
  const [jobTitlesText, setJobTitlesText] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [headcountMin, setHeadcountMin] = useState('');
  const [headcountMax, setHeadcountMax] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('full');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProspectDiscoveryResult | null>(null);

  const [history, setHistory] = useState<ProspectSearchHistoryEntry[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedProspectSearchEntry[]>([]);

  const searchGenerationRef = useRef(0);

  // --- Secondary single-company deep-research state (BlackPearl Playbooks) ---
  // The drawer only ever opens once a real result (or error) is ready - it
  // never opens mid-poll, so ProspectDetailsDrawer's own "fetch if missing"
  // effect never races with this page's own, much longer BlackPearl poll.
  const [deepResearchCompany, setDeepResearchCompany] = useState<ProspectCompany | null>(null);
  const [deepResearchPendingName, setDeepResearchPendingName] = useState<string | null>(null);
  const [deepResearchProgress, setDeepResearchProgress] = useState<number | null>(null);
  const [deepResearchError, setDeepResearchError] = useState('');
  const [insightCache, setInsightCache] = useState<Record<string, ProspectCompanyInsight>>({});
  const deepResearchGenerationRef = useRef(0);
  const [ghlConnected, setGhlConnected] = useState(false);

  useEffect(() => {
    getCrmConnectorStatus()
      .then((status) => setGhlConnected(Boolean(status.ghl?.connected)))
      .catch(() => {
        // Non-critical - "Import to GHL" simply stays disabled if this fails.
      });
  }, []);

  const loadHistoryAndSaved = useCallback(async () => {
    try {
      const [historyData, savedData] = await Promise.all([
        getProspectSearchHistory(8),
        getSavedProspectSearches(),
      ]);
      setHistory(historyData.filter((entry) => entry.provider === DISCOVERY_PROVIDER));
      setSavedSearches(savedData);
    } catch {
      // History/saved searches are a convenience layer - a failure here
      // should not block the core search experience.
    }
  }, []);

  useEffect(() => {
    void loadHistoryAndSaved();
  }, [loadHistoryAndSaved]);

  const buildRequest = useCallback(
    (objectiveValue: string): DiscoverProspectsRequest => ({
      objective: objectiveValue,
      companyNames: parseList(companyNamesText),
      locations: parseList(locationsText),
      industries: parseList(industriesText),
      jobTitles: parseList(jobTitlesText),
      keywords: parseList(keywordsText),
      companyHeadcountMin: headcountMin ? Number(headcountMin) : undefined,
      companyHeadcountMax: headcountMax ? Number(headcountMax) : undefined,
      limit: SEARCH_MODE_LIMITS[searchMode],
    }),
    [
      companyNamesText,
      locationsText,
      industriesText,
      jobTitlesText,
      keywordsText,
      headcountMin,
      headcountMax,
      searchMode,
    ],
  );

  const pollDiscoveryJob = useCallback(
    async (jobId: string, request: DiscoverProspectsRequest, generation: number) => {
      const startedAt = Date.now();
      let consecutive503s = 0;

      for (;;) {
        if (searchGenerationRef.current !== generation) return;

        if (Date.now() - startedAt > JOB_MAX_POLL_MS) {
          setError('This search is taking longer than expected. Please try again.');
          setLoading(false);
          return;
        }

        const waitMs =
          consecutive503s === 0
            ? JOB_POLL_INTERVAL_MS
            : Math.min(JOB_POLL_INTERVAL_MS * 2 ** consecutive503s, MAX_BACKOFF_MS);

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        if (searchGenerationRef.current !== generation) return;

        try {
          const status = await getProspectDiscoveryJobStatus(jobId, request);
          if (searchGenerationRef.current !== generation) return;
          consecutive503s = 0;

          if (status.status === 'pending') {
            setProgress(status.progress);
            setStageLabel(status.stageLabel);
            continue;
          }

          if (status.status === 'completed') {
            setResult(status.result);
            setLoading(false);
            void loadHistoryAndSaved();
            return;
          }

          setError(status.message);
          setLoading(false);
          return;
        } catch (err) {
          if (searchGenerationRef.current !== generation) return;

          if (isTransient503(err)) {
            consecutive503s += 1;
            continue;
          }

          setError(getApiErrorMessage(err, 'Could not check search status. Please try again.'));
          setLoading(false);
          return;
        }
      }
    },
    [loadHistoryAndSaved],
  );

  const runSearch = useCallback(
    async (objectiveValue: string) => {
      const trimmed = objectiveValue.trim();
      if (!trimmed) return;

      const generation = searchGenerationRef.current + 1;
      searchGenerationRef.current = generation;

      setLoading(true);
      setError('');
      setProgress(null);
      setStageLabel(null);
      setResult(null);

      const request = buildRequest(trimmed);

      try {
        const submission = await discoverProspects(request);
        if (searchGenerationRef.current !== generation) return;
        setObjective(trimmed);

        if (submission.status === 'completed') {
          setResult(submission.result);
          setLoading(false);
          void loadHistoryAndSaved();
          return;
        }

        void pollDiscoveryJob(submission.jobId, request, generation);
      } catch (err) {
        if (searchGenerationRef.current !== generation) return;
        setError(getApiErrorMessage(err, 'Prospect search failed. Please try again.'));
        setLoading(false);
      }
    },
    [buildRequest, loadHistoryAndSaved, pollDiscoveryJob],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (loading) return;
      void runSearch(objective);
    },
    [loading, objective, runSearch],
  );

  const handleRunAgain = useCallback(
    (value: string) => {
      setObjective(value);
      if (!loading) void runSearch(value);
    },
    [loading, runSearch],
  );

  const handleSaveSearch = useCallback(async () => {
    if (!objective.trim()) return;

    const name = window.prompt('Name this search:', objective.slice(0, 60));
    if (!name || !name.trim()) return;

    try {
      await saveProspectSearch(name.trim(), objective.trim());
      await loadHistoryAndSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this search.'));
    }
  }, [objective, loadHistoryAndSaved]);

  const handleRenameSaved = useCallback(
    async (entry: SavedProspectSearchEntry) => {
      const name = window.prompt('Rename saved search:', entry.name);
      if (!name || !name.trim() || name.trim() === entry.name) return;

      try {
        await renameSavedProspectSearch(entry.id, name.trim());
        await loadHistoryAndSaved();
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not rename this saved search.'));
      }
    },
    [loadHistoryAndSaved],
  );

  const handleDeleteSaved = useCallback(
    async (entry: SavedProspectSearchEntry) => {
      if (!window.confirm(`Delete saved search "${entry.name}"?`)) return;

      try {
        await deleteSavedProspectSearch(entry.id);
        await loadHistoryAndSaved();
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not delete this saved search.'));
      }
    },
    [loadHistoryAndSaved],
  );

  // --- Secondary single-company deep-research flow ---

  const pollDeepResearchJob = useCallback(
    async (jobId: string, company: ProspectCompany, generation: number) => {
      const startedAt = Date.now();
      let consecutive503s = 0;

      for (;;) {
        if (deepResearchGenerationRef.current !== generation) return;

        if (Date.now() - startedAt > DEEP_RESEARCH_MAX_POLL_MS) {
          setDeepResearchError('Playbook generation is taking longer than expected. Please try again later.');
          setDeepResearchPendingName(null);
          return;
        }

        const waitMs =
          consecutive503s === 0
            ? DEEP_RESEARCH_POLL_INTERVAL_MS
            : Math.min(DEEP_RESEARCH_POLL_INTERVAL_MS * 2 ** consecutive503s, MAX_BACKOFF_MS * 5);

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        if (deepResearchGenerationRef.current !== generation) return;

        try {
          const status = await getProspectSearchJobStatus(jobId);
          if (deepResearchGenerationRef.current !== generation) return;
          consecutive503s = 0;

          if (status.status === 'pending') {
            setDeepResearchProgress(status.progress);
            continue;
          }

          if (status.status === 'completed') {
            setInsightCache((current) => ({ ...current, [status.companyName]: status.insight }));
            setDeepResearchPendingName(null);
            setDeepResearchCompany(company);
            return;
          }

          setDeepResearchError(status.message);
          setDeepResearchPendingName(null);
          return;
        } catch (err) {
          if (deepResearchGenerationRef.current !== generation) return;

          if (isTransient503(err)) {
            consecutive503s += 1;
            continue;
          }

          setDeepResearchError(getApiErrorMessage(err, 'Could not check playbook status. Please try again.'));
          setDeepResearchPendingName(null);
          return;
        }
      }
    },
    [],
  );

  const handleOpenDeepResearch = useCallback(
    (company: ProspectCompany) => {
      setDeepResearchError('');

      // Already researched this session - just reopen the drawer with the
      // cached insight, no new BlackPearl job needed.
      if (insightCache[company.name]) {
        setDeepResearchCompany(company);
        return;
      }

      const generation = deepResearchGenerationRef.current + 1;
      deepResearchGenerationRef.current = generation;
      setDeepResearchPendingName(company.name);
      setDeepResearchProgress(null);

      searchProspects(company.name)
        .then((submission) => {
          if (deepResearchGenerationRef.current !== generation) return;

          if (submission.status === 'completed') {
            setInsightCache((current) => ({
              ...current,
              [submission.companyName]: submission.insight,
            }));
            setDeepResearchPendingName(null);
            setDeepResearchCompany(company);
            return;
          }

          void pollDeepResearchJob(submission.jobId, company, generation);
        })
        .catch((err: unknown) => {
          if (deepResearchGenerationRef.current !== generation) return;
          setDeepResearchError(getApiErrorMessage(err, 'Full playbook generation failed. Please try again.'));
          setDeepResearchPendingName(null);
        });
    },
    [insightCache, pollDeepResearchJob],
  );

  const deepResearchAsProspectCompany = deepResearchCompany
    ? { ...deepResearchCompany, id: deepResearchCompany.name }
    : null;

  return (
    <DashboardLayout requiredPermissions="prospect_search.view">
      <div className="mb-6 sm:mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Radar className="text-indigo-300" size={30} aria-hidden="true" />
          AI Prospect Search
        </h2>
        <p className="mt-2 text-slate-400">
          Describe the companies and buyers you&apos;re looking for, in plain English.
        </p>
      </div>

      {(history.length > 0 || savedSearches.length > 0) && (
        <div className="mb-6 space-y-3 sm:mb-8">
          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex shrink-0 items-center gap-1 font-bold uppercase tracking-wide text-slate-500">
                <Clock size={13} aria-hidden="true" />
                Recent:
              </span>
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleRunAgain(entry.prompt)}
                  title={entry.prompt}
                  className="max-w-[220px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-slate-300 transition hover:bg-white/10"
                >
                  {entry.prompt}
                </button>
              ))}
            </div>
          )}

          {savedSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex shrink-0 items-center gap-1 font-bold uppercase tracking-wide text-slate-500">
                <Bookmark size={13} aria-hidden="true" />
                Saved:
              </span>
              {savedSearches.map((entry) => (
                <span
                  key={entry.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 font-semibold text-slate-300"
                >
                  <button
                    type="button"
                    onClick={() => handleRunAgain(entry.prompt)}
                    title={entry.prompt}
                    className="flex max-w-[160px] items-center gap-1 truncate transition hover:text-white"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    <span className="truncate">{entry.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRenameSaved(entry)}
                    aria-label={`Rename saved search "${entry.name}"`}
                    className="text-slate-500 transition hover:text-white"
                  >
                    <Pencil size={11} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSaved(entry)}
                    aria-label={`Delete saved search "${entry.name}"`}
                    className="text-slate-500 transition hover:text-rose-300"
                  >
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:mb-8 sm:p-5"
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <ProspectSearchFilterChip
            label="Company"
            icon={Building2}
            isActive={Boolean(companyNamesText.trim())}
            isOpen={activeFilter === 'company'}
            disabled={loading}
            onToggle={() => setActiveFilter((current) => (current === 'company' ? null : 'company'))}
            onClose={() => setActiveFilter(null)}
          >
            <label htmlFor="filter-company" className="mb-1 block text-xs font-semibold text-slate-500">
              Company name
            </label>
            <input
              id="filter-company"
              type="text"
              autoFocus
              value={companyNamesText}
              onChange={(event) => setCompanyNamesText(event.target.value)}
              placeholder="Acme Corp, Globex"
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
            />
          </ProspectSearchFilterChip>

          <ProspectSearchFilterChip
            label="Location"
            icon={MapPin}
            isActive={Boolean(locationsText.trim())}
            isOpen={activeFilter === 'location'}
            disabled={loading}
            onToggle={() => setActiveFilter((current) => (current === 'location' ? null : 'location'))}
            onClose={() => setActiveFilter(null)}
          >
            <label htmlFor="filter-locations" className="mb-1 block text-xs font-semibold text-slate-500">
              Locations
            </label>
            <input
              id="filter-locations"
              type="text"
              autoFocus
              value={locationsText}
              onChange={(event) => setLocationsText(event.target.value)}
              placeholder="India, Texas"
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
            />
          </ProspectSearchFilterChip>

          <ProspectSearchFilterChip
            label="Industry"
            icon={Factory}
            isActive={Boolean(industriesText.trim())}
            isOpen={activeFilter === 'industry'}
            disabled={loading}
            onToggle={() => setActiveFilter((current) => (current === 'industry' ? null : 'industry'))}
            onClose={() => setActiveFilter(null)}
          >
            <label htmlFor="filter-industries" className="mb-1 block text-xs font-semibold text-slate-500">
              Industries
            </label>
            <input
              id="filter-industries"
              type="text"
              autoFocus
              value={industriesText}
              onChange={(event) => setIndustriesText(event.target.value)}
              placeholder="Marketing, SaaS"
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
            />
          </ProspectSearchFilterChip>

          <ProspectSearchFilterChip
            label="Job title"
            icon={Briefcase}
            isActive={Boolean(jobTitlesText.trim())}
            isOpen={activeFilter === 'jobTitle'}
            disabled={loading}
            onToggle={() => setActiveFilter((current) => (current === 'jobTitle' ? null : 'jobTitle'))}
            onClose={() => setActiveFilter(null)}
          >
            <label htmlFor="filter-job-titles" className="mb-1 block text-xs font-semibold text-slate-500">
              Job titles
            </label>
            <input
              id="filter-job-titles"
              type="text"
              autoFocus
              value={jobTitlesText}
              onChange={(event) => setJobTitlesText(event.target.value)}
              placeholder="Founder, CEO"
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
            />
          </ProspectSearchFilterChip>

          <ProspectSearchFilterChip
            label="Headcount"
            icon={Users}
            isActive={Boolean(headcountMin || headcountMax)}
            isOpen={activeFilter === 'headcount'}
            disabled={loading}
            onToggle={() => setActiveFilter((current) => (current === 'headcount' ? null : 'headcount'))}
            onClose={() => setActiveFilter(null)}
          >
            <label className="mb-1 block text-xs font-semibold text-slate-500">Company headcount</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                autoFocus
                value={headcountMin}
                onChange={(event) => setHeadcountMin(event.target.value)}
                placeholder="Min"
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
              />
              <span className="text-slate-600">-</span>
              <input
                type="number"
                min={1}
                value={headcountMax}
                onChange={(event) => setHeadcountMax(event.target.value)}
                placeholder="Max"
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
              />
            </div>
          </ProspectSearchFilterChip>

          <ProspectSearchFilterChip
            label="Keywords"
            icon={Tags}
            isActive={Boolean(keywordsText.trim())}
            isOpen={activeFilter === 'keywords'}
            disabled={loading}
            onToggle={() => setActiveFilter((current) => (current === 'keywords' ? null : 'keywords'))}
            onClose={() => setActiveFilter(null)}
          >
            <label htmlFor="filter-keywords" className="mb-1 block text-xs font-semibold text-slate-500">
              Keywords
            </label>
            <input
              id="filter-keywords"
              type="text"
              autoFocus
              value={keywordsText}
              onChange={(event) => setKeywordsText(event.target.value)}
              placeholder="hiring, expanding"
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
            />
          </ProspectSearchFilterChip>
        </div>

        <label htmlFor="prospect-search-objective" className="sr-only">
          Describe who you&apos;re looking for
        </label>
        <textarea
          id="prospect-search-objective"
          rows={2}
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          disabled={loading}
          placeholder={"Describe what you're looking for... e.g. \"Marketing agencies in India\""}
          className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 disabled:opacity-60"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label="Search depth"
              className="inline-flex rounded-full border border-white/10 bg-slate-950/60 p-0.5 text-xs font-bold"
            >
              {(Object.keys(SEARCH_MODE_LIMITS) as SearchMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSearchMode(mode)}
                  disabled={loading}
                  aria-pressed={searchMode === mode}
                  className={`rounded-full px-3 py-1.5 capitalize transition disabled:cursor-not-allowed ${
                    searchMode === mode
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              Expected: up to {SEARCH_MODE_LIMITS[searchMode]} results &middot; ~1 min
            </span>
          </div>

          <div className="flex items-center gap-2">
            {objective.trim() && can('prospect_search.manage') && (
              <button
                type="button"
                onClick={() => void handleSaveSearch()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Bookmark size={16} aria-hidden="true" />
                Save
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !objective.trim()}
              aria-label={loading ? 'Searching' : 'Search'}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-6 flex items-center gap-3 text-sm font-semibold text-slate-300">
          <Loader2 className="animate-spin text-indigo-300" size={18} aria-hidden="true" />
          {stageLabel ?? 'Searching...'}
          {progress !== null && ` (${progress}%)`}
        </div>
      )}

      {!loading && !result && <EmptyState />}

      {!loading && result && (
        <div>
          <p className="mb-4 text-sm font-semibold text-slate-400">
            {result.prospects.length > 0
              ? `${result.qualifiedCount} of ${result.discoveredCount} discovered ${result.discoveredCount === 1 ? 'company' : 'companies'} qualified`
              : 'No qualifying prospects found for this search. Try broadening your criteria.'}
          </p>
          <div className="space-y-4">
            {result.prospects.map((prospect) => (
              <ProspectDiscoveryResultCard
                key={prospect.id}
                prospect={prospect}
                canImportLeads={can('leads.create')}
                ghlConnected={ghlConnected}
                onOpenDeepResearch={handleOpenDeepResearch}
              />
            ))}
          </div>
        </div>
      )}

      {deepResearchPendingName && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/10 bg-[#0f172a] px-5 py-3 text-sm font-semibold text-slate-300 shadow-2xl">
          <Loader2 className="animate-spin text-indigo-300" size={18} aria-hidden="true" />
          Generating full playbook for {deepResearchPendingName}
          {deepResearchProgress !== null ? ` (${deepResearchProgress}%)` : ''} - typically
          10-15 minutes...
        </div>
      )}

      {deepResearchError && !deepResearchPendingName && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-rose-500/20 bg-[#0f172a] px-5 py-3 text-sm font-semibold text-rose-300 shadow-2xl"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          {deepResearchError}
          <button
            type="button"
            onClick={() => setDeepResearchError('')}
            className="text-slate-500 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {deepResearchCompany && (
        <ProspectDetailsDrawer
          company={deepResearchAsProspectCompany}
          searchPrompt={deepResearchCompany.name}
          onClose={() => setDeepResearchCompany(null)}
          canImportLeads={can('leads.create')}
          ghlConnected={ghlConnected}
          insightCache={insightCache}
          onInsightCached={(companyId, insight) =>
            setInsightCache((current) => ({ ...current, [companyId]: insight }))
          }
        />
      )}
    </DashboardLayout>
  );
}
