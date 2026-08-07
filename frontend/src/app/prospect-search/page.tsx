'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import DashboardLayout from '@/components/DashboardLayout';
import ProspectDetailsDrawer from '@/components/ProspectDetailsDrawer';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ProspectCompany,
  ProspectCompanyInsight,
  ProspectSearchHistoryEntry,
  SavedProspectSearchEntry,
  deleteSavedProspectSearch,
  getProspectSearchHistory,
  getProspectSearchJobStatus,
  getSavedProspectSearches,
  renameSavedProspectSearch,
  saveProspectSearch,
  searchProspects,
} from '@/lib/prospect-search';
import {
  AlertTriangle,
  Bookmark,
  Clock,
  Loader2,
  Pencil,
  Radar,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';

// Per BlackPearl: generation typically takes 10-15 minutes; poll every
// 15-30s and allow up to 30 minutes before giving up.
const JOB_POLL_INTERVAL_MS = 20_000;
const JOB_MAX_POLL_MS = 30 * 60 * 1000;

// A single 503 (or a run of them) is a confirmed-transient condition per
// BlackPearl - the job keeps running server-side. Back off exponentially
// between retries instead of polling at the normal cadence, capped so a
// long outage still leaves room for several more attempts before
// JOB_MAX_POLL_MS is reached; reset to the normal cadence the moment a
// non-503 response comes back.
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function isTransient503(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 503;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <Radar className="mb-4 text-slate-600" size={48} aria-hidden="true" />
      <p className="max-w-sm text-sm font-semibold text-slate-400">
        Enter a company name above to generate an AI sales playbook.
      </p>
    </div>
  );
}

export default function ProspectSearchPage() {
  const { can } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<ProspectCompany | null>(null);
  const [insightCache, setInsightCache] = useState<Record<string, ProspectCompanyInsight>>({});
  const [history, setHistory] = useState<ProspectSearchHistoryEntry[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedProspectSearchEntry[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchGenerationRef = useRef(0);

  const loadHistoryAndSaved = useCallback(async () => {
    try {
      const [historyData, savedData] = await Promise.all([
        getProspectSearchHistory(5),
        getSavedProspectSearches(),
      ]);
      setHistory(historyData);
      setSavedSearches(savedData);
    } catch {
      // History/saved searches are a convenience layer - a failure here
      // should not block the core search experience.
    }
  }, []);

  useEffect(() => {
    void loadHistoryAndSaved();
  }, [loadHistoryAndSaved]);

  const handleCloseDetails = useCallback(() => {
    setSelectedCompany(null);
  }, []);

  const handleInsightCached = useCallback((companyId: string, insight: ProspectCompanyInsight) => {
    setInsightCache((current) => ({ ...current, [companyId]: insight }));
  }, []);

  const pollJobStatus = useCallback(
    async (jobId: string, generation: number) => {
      const startedAt = Date.now();
      let consecutive503s = 0;

      for (;;) {
        if (searchGenerationRef.current !== generation) return;

        if (Date.now() - startedAt > JOB_MAX_POLL_MS) {
          setError('Playbook generation is taking longer than expected. Please try again later.');
          setLoading(false);
          return;
        }

        // Same jobId every iteration - a 503 backs off and retries the
        // status check, it never triggers a new playbook submission.
        const waitMs =
          consecutive503s === 0
            ? JOB_POLL_INTERVAL_MS
            : Math.min(JOB_POLL_INTERVAL_MS * 2 ** consecutive503s, MAX_BACKOFF_MS);

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        if (searchGenerationRef.current !== generation) return;

        try {
          const status = await getProspectSearchJobStatus(jobId);
          if (searchGenerationRef.current !== generation) return;
          consecutive503s = 0;

          if (status.status === 'pending') {
            setProgress(status.progress);
            continue;
          }

          if (status.status === 'completed') {
            const company: ProspectCompany = { id: status.companyName, name: status.companyName };
            setInsightCache((current) => ({ ...current, [company.id]: status.insight }));
            setSelectedCompany(company);
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
            // Confirmed transient by BlackPearl: keep the loading state,
            // don't surface an error, just back off and retry the same job.
            consecutive503s += 1;
            console.warn(
              `Prospect search: transient 503 checking job ${jobId} (consecutive: ${consecutive503s}); retrying.`,
            );
            continue;
          }

          setError(getApiErrorMessage(err, 'Could not check playbook status. Please try again.'));
          setLoading(false);
          return;
        }
      }
    },
    [loadHistoryAndSaved],
  );

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;

    setLoading(true);
    setError('');
    setProgress(null);

    try {
      const result = await searchProspects(trimmed);
      if (searchGenerationRef.current !== generation) return;
      setCompanyName(trimmed);

      if (result.status === 'completed') {
        const company: ProspectCompany = { id: result.companyName, name: result.companyName };
        setInsightCache((current) => ({ ...current, [company.id]: result.insight }));
        setSelectedCompany(company);
        setLoading(false);
        void loadHistoryAndSaved();
        return;
      }

      void pollJobStatus(result.jobId, generation);
    } catch (err) {
      if (searchGenerationRef.current !== generation) return;
      setError(getApiErrorMessage(err, 'Prospect search failed. Please try again.'));
      setLoading(false);
    }
  }, [loadHistoryAndSaved, pollJobStatus]);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (loading) return;
      void runSearch(companyName);
    },
    [loading, companyName, runSearch],
  );

  const handleRunAgain = useCallback(
    (value: string) => {
      setCompanyName(value);
      if (!loading) void runSearch(value);
    },
    [loading, runSearch],
  );

  const handleSaveSearch = useCallback(async () => {
    if (!selectedCompany) return;

    const name = window.prompt('Name this search:', selectedCompany.name.slice(0, 60));
    if (!name || !name.trim()) return;

    try {
      await saveProspectSearch(name.trim(), selectedCompany.name);
      await loadHistoryAndSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this search.'));
    }
  }, [selectedCompany, loadHistoryAndSaved]);

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

  return (
    <DashboardLayout requiredPermissions="prospect_search.view">
      <div className="mb-6 sm:mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Radar className="text-indigo-300" size={30} aria-hidden="true" />
          AI Prospect Search
        </h2>
        <p className="mt-2 text-slate-400">
          Enter a company name to generate an AI-powered sales playbook.
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
        <label htmlFor="prospect-search-company-name" className="sr-only">
          Company name
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="prospect-search-company-name"
            ref={inputRef}
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            disabled={loading}
            placeholder="e.g. Acme Corp"
            className="min-h-11 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 disabled:opacity-60"
          />
          <div className="flex gap-2">
            {selectedCompany && can('prospect_search.manage') && (
              <button
                type="button"
                onClick={() => void handleSaveSearch()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Bookmark size={16} aria-hidden="true" />
                Save Search
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !companyName.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <Search size={18} aria-hidden="true" />
              )}
              {loading ? 'Generating...' : 'Search with AI'}
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
          {progress !== null
            ? `Generating playbook... ${progress}% (typically 10-15 minutes)`
            : 'Generating playbook — this typically takes 10-15 minutes...'}
        </div>
      )}

      {!loading && <EmptyState />}

      <ProspectDetailsDrawer
        company={selectedCompany}
        searchPrompt={selectedCompany?.name ?? ''}
        onClose={handleCloseDetails}
        canImportLeads={can('leads.create')}
        insightCache={insightCache}
        onInsightCached={handleInsightCached}
      />
    </DashboardLayout>
  );
}
