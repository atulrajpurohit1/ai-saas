'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ProspectDetailsDrawer from '@/components/ProspectDetailsDrawer';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ProspectCompany,
  ProspectCompanyInsight,
  ProspectSearchHistoryEntry,
  ProspectSearchResult,
  SavedProspectSearchEntry,
  deleteSavedProspectSearch,
  getProspectSearchHistory,
  getSavedProspectSearches,
  renameSavedProspectSearch,
  saveProspectSearch,
  searchProspects,
} from '@/lib/prospect-search';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  AlertTriangle,
  ArrowUpDown,
  Bookmark,
  Clock,
  DollarSign,
  Globe,
  Loader2,
  MapPin,
  Pencil,
  Radar,
  RotateCcw,
  Search,
  SearchX,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SortOption = 'match' | 'alphabetical' | 'employees';

interface EmployeeBucket {
  key: string;
  label: string;
  min: number;
  max: number;
}

const EMPLOYEE_BUCKETS: EmployeeBucket[] = [
  { key: 'all', label: 'All sizes', min: 0, max: Infinity },
  { key: 'small', label: '1-50 employees', min: 0, max: 50 },
  { key: 'medium', label: '51-200 employees', min: 51, max: 200 },
  { key: 'large', label: '201-500 employees', min: 201, max: 500 },
  { key: 'enterprise', label: '501+ employees', min: 501, max: Infinity },
];

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: 'match', label: 'Match Score' },
  { key: 'alphabetical', label: 'Alphabetical' },
  { key: 'employees', label: 'Employees' },
];

function matchScoreClass(score: number) {
  if (score >= 85) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (score >= 70) return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
  if (score >= 50) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
}

function locationLabel(company: ProspectCompany) {
  return `${company.city}, ${company.state}`;
}

const CompanyCard = React.memo(function CompanyCard({
  company,
  onViewDetails,
}: {
  company: ProspectCompany;
  onViewDetails: (company: ProspectCompany) => void;
}) {
  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-indigo-400/30">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-white">{company.name}</h3>
            <span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
              {company.industry}
            </span>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-bold',
              matchScoreClass(company.matchScore),
            )}
            aria-label={`${company.matchScore} percent match`}
          >
            {company.matchScore}% Match
          </span>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div className="flex min-w-0 items-center gap-2 text-slate-400">
            <MapPin size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{locationLabel(company)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-slate-400">
            <Users size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{company.employeeCount.toLocaleString()} Employees</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-slate-400">
            <DollarSign size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{company.revenueRange}</span>
          </div>
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 text-indigo-300 transition hover:text-indigo-200"
          >
            <Globe size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">Website</span>
          </a>
        </dl>

        <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-400">{company.description}</p>
      </div>

      <button
        type="button"
        onClick={() => onViewDetails(company)}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
      >
        View Details
      </button>
    </article>
  );
});

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5" aria-hidden="true">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="w-2/3">
          <div className="h-5 w-3/4 rounded bg-white/10" />
          <div className="mt-2 h-4 w-1/3 rounded-full bg-white/10" />
        </div>
        <div className="h-6 w-16 shrink-0 rounded-full bg-white/10" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-4 w-full rounded bg-white/10" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-5/6 rounded bg-white/10" />
        <div className="h-3 w-2/3 rounded bg-white/10" />
      </div>
      <div className="mt-4 h-10 w-full rounded-xl bg-white/10" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <Radar className="mb-4 text-slate-600" size={48} aria-hidden="true" />
      <p className="max-w-sm text-sm font-semibold text-slate-400">
        Describe the companies you&apos;re looking for to begin your search.
      </p>
    </div>
  );
}

function NoResultsState({
  filtered,
  onModifySearch,
  onResetFilters,
}: {
  filtered: boolean;
  onModifySearch: () => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <SearchX className="mb-4 text-slate-600" size={48} aria-hidden="true" />
      <p className="mb-5 max-w-sm text-sm font-semibold text-slate-400">
        {filtered ? 'No companies match your current filters.' : 'No matching companies found.'}
      </p>
      <button
        type="button"
        onClick={filtered ? onResetFilters : onModifySearch}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
      >
        {filtered ? 'Reset Filters' : 'Modify Search'}
      </button>
    </div>
  );
}

export default function ProspectSearchPage() {
  const { can } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [searchResult, setSearchResult] = useState<ProspectSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [employeeBucketKey, setEmployeeBucketKey] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [selectedCompany, setSelectedCompany] = useState<ProspectCompany | null>(null);
  const [insightCache, setInsightCache] = useState<Record<string, ProspectCompanyInsight>>({});
  const [history, setHistory] = useState<ProspectSearchHistoryEntry[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedProspectSearchEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleViewDetails = useCallback((company: ProspectCompany) => {
    setSelectedCompany(company);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedCompany(null);
  }, []);

  const handleInsightCached = useCallback((companyId: string, insight: ProspectCompanyInsight) => {
    setInsightCache((current) => ({ ...current, [companyId]: insight }));
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const result = await searchProspects(trimmed);
      setSearchResult(result);
      setIndustryFilter('all');
      setLocationFilter('all');
      setEmployeeBucketKey('all');
      setSortBy('match');
      setPrompt(trimmed);
      void loadHistoryAndSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Prospect search failed. Please try again.'));
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }, [loadHistoryAndSaved]);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (loading) return;
      void runSearch(prompt);
    },
    [loading, prompt, runSearch],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!loading) void runSearch(prompt);
      }
    },
    [loading, prompt, runSearch],
  );

  const handleModifySearch = useCallback(() => {
    setSearchResult(null);
    setError('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleResetFilters = useCallback(() => {
    setIndustryFilter('all');
    setLocationFilter('all');
    setEmployeeBucketKey('all');
  }, []);

  const handleRunAgain = useCallback(
    (value: string) => {
      setPrompt(value);
      if (!loading) void runSearch(value);
    },
    [loading, runSearch],
  );

  const handleSaveSearch = useCallback(async () => {
    if (!searchResult) return;

    const name = window.prompt('Name this search:', searchResult.prompt.slice(0, 60));
    if (!name || !name.trim()) return;

    try {
      await saveProspectSearch(name.trim(), searchResult.prompt, searchResult.filters);
      await loadHistoryAndSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this search.'));
    }
  }, [searchResult, loadHistoryAndSaved]);

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

  const industries = useMemo(() => {
    if (!searchResult) return [];
    return Array.from(new Set(searchResult.results.map((company) => company.industry))).sort();
  }, [searchResult]);

  const locations = useMemo(() => {
    if (!searchResult) return [];
    return Array.from(new Set(searchResult.results.map(locationLabel))).sort();
  }, [searchResult]);

  const filteredSortedResults = useMemo(() => {
    if (!searchResult) return [];

    const employeeBucket = EMPLOYEE_BUCKETS.find((bucket) => bucket.key === employeeBucketKey);

    const filtered = searchResult.results.filter((company) => {
      if (industryFilter !== 'all' && company.industry !== industryFilter) return false;
      if (locationFilter !== 'all' && locationLabel(company) !== locationFilter) return false;
      if (employeeBucket && employeeBucket.key !== 'all') {
        if (company.employeeCount < employeeBucket.min || company.employeeCount > employeeBucket.max) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'employees') {
      sorted.sort((a, b) => b.employeeCount - a.employeeCount);
    } else {
      sorted.sort((a, b) => b.matchScore - a.matchScore);
    }

    return sorted;
  }, [searchResult, industryFilter, locationFilter, employeeBucketKey, sortBy]);

  const hasRawResults = (searchResult?.results.length ?? 0) > 0;
  const hasFiltersApplied =
    industryFilter !== 'all' || locationFilter !== 'all' || employeeBucketKey !== 'all';

  return (
    <DashboardLayout requiredPermissions="prospect_search.view">
      <div className="mb-6 sm:mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Radar className="text-indigo-300" size={30} aria-hidden="true" />
          AI Prospect Search
        </h2>
        <p className="mt-2 text-slate-400">
          Search and discover companies using natural language powered by AI.
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
        <label htmlFor="prospect-search-prompt" className="sr-only">
          Describe the companies you&apos;re looking for
        </label>
        <textarea
          id="prospect-search-prompt"
          ref={textareaRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={loading}
          placeholder="Find security companies in Texas with 50-200 employees..."
          aria-describedby="prospect-search-hint"
          className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 disabled:opacity-60"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p id="prospect-search-hint" className="text-xs text-slate-500">
            Press Ctrl/Cmd + Enter to search
          </p>
          <div className="flex gap-2">
            {searchResult && can('prospect_search.manage') && (
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
              disabled={loading || !prompt.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <Search size={18} aria-hidden="true" />
              )}
              {loading ? 'Searching...' : 'Search with AI'}
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
          AI is analyzing your request...
        </div>
      )}

      {!loading && searchResult && hasRawResults && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            AI Search Filters
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              aria-label="Filter by industry"
              value={industryFilter}
              onChange={(event) => setIndustryFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
            >
              <option value="all">All industries</option>
              {industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by location"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
            >
              <option value="all">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by employee size"
              value={employeeBucketKey}
              onChange={(event) => setEmployeeBucketKey(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
            >
              {EMPLOYEE_BUCKETS.map((bucket) => (
                <option key={bucket.key} value={bucket.key}>
                  {bucket.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white">
              <ArrowUpDown size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
              <select
                aria-label="Sort results"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key} className="bg-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : !searchResult ? (
        <EmptyState />
      ) : filteredSortedResults.length === 0 ? (
        <NoResultsState
          filtered={hasRawResults && hasFiltersApplied}
          onModifySearch={handleModifySearch}
          onResetFilters={handleResetFilters}
        />
      ) : (
        <>
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Sparkles size={16} className="text-indigo-300" aria-hidden="true" />
              AI Prospect Search Results
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {filteredSortedResults.length} of {searchResult.totalMatches} compan
              {searchResult.totalMatches === 1 ? 'y' : 'ies'} shown
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSortedResults.map((company) => (
              <CompanyCard key={company.id} company={company} onViewDetails={handleViewDetails} />
            ))}
          </div>
        </>
      )}

      <ProspectDetailsDrawer
        company={selectedCompany}
        searchPrompt={searchResult?.prompt ?? prompt}
        onClose={handleCloseDetails}
        canImportLeads={can('leads.create')}
        insightCache={insightCache}
        onInsightCached={handleInsightCached}
      />
    </DashboardLayout>
  );
}
