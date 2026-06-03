'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  archiveKnowledgeEntry,
  createKnowledgeEntry,
  getKnowledgeEntries,
  KnowledgeCategory,
  KnowledgeEntry,
  knowledgeCategories,
  searchKnowledge,
  updateKnowledgeEntry,
} from '@/lib/knowledge-base';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Edit3,
  FileWarning,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  X,
} from 'lucide-react';

const sectionFilters: Array<{ label: string; value: KnowledgeCategory | 'all' }> = [
  { label: 'All Knowledge', value: 'all' },
  { label: 'Incident Knowledge', value: 'incidents' },
  { label: 'Operations Knowledge', value: 'operations' },
  { label: 'Billing Knowledge', value: 'billing' },
  { label: 'Scheduling Knowledge', value: 'scheduling' },
];

const emptyForm = {
  title: '',
  category: 'operations' as KnowledgeCategory,
  sourceType: '',
  sourceId: '',
  summary: '',
  detailedContent: '',
  keywords: '',
  tags: '',
};

function labelForCategory(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[]) {
  return value.join(', ');
}

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedSection, setSelectedSection] = useState<KnowledgeCategory | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<KnowledgeCategory | ''>('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeCategory = selectedSection === 'all'
    ? categoryFilter || undefined
    : selectedSection;

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = query.trim() || tag.trim()
        ? await searchKnowledge({
            q: query.trim() || undefined,
            tag: tag.trim() || undefined,
            category: activeCategory,
          })
        : await getKnowledgeEntries({
            category: activeCategory,
            tag: tag.trim() || undefined,
          });
      setEntries(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the knowledge base.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [selectedSection, categoryFilter]);

  const counts = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc[entry.category] = (acc[entry.category] || 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>,
    );
  }, [entries]);

  const startCreate = () => {
    setForm({ ...emptyForm, category: activeCategory || 'operations' });
    setEditingId(null);
    setShowEditor(true);
    setSuccess('');
  };

  const startEdit = (entry: KnowledgeEntry) => {
    setForm({
      title: entry.title,
      category: entry.category,
      sourceType: entry.sourceType || '',
      sourceId: entry.sourceId || '',
      summary: entry.summary,
      detailedContent: entry.detailedContent,
      keywords: joinList(entry.keywords),
      tags: joinList(entry.tags),
    });
    setEditingId(entry.id);
    setShowEditor(true);
    setSuccess('');
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      title: form.title.trim(),
      category: form.category,
      sourceType: form.sourceType.trim() || undefined,
      sourceId: form.sourceId.trim() || undefined,
      summary: form.summary.trim(),
      detailedContent: form.detailedContent.trim(),
      keywords: splitList(form.keywords),
      tags: splitList(form.tags),
    };

    try {
      if (editingId) {
        await updateKnowledgeEntry(editingId, payload);
        setSuccess('Knowledge entry updated.');
      } else {
        await createKnowledgeEntry(payload);
        setSuccess('Knowledge entry created.');
      }
      closeEditor();
      await loadEntries();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this knowledge entry.'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (entry: KnowledgeEntry) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await archiveKnowledgeEntry(entry.id);
      setSuccess('Knowledge entry archived.');
      await loadEntries();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not archive this knowledge entry.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BookOpen className="text-sky-300" size={30} />
            AI Knowledge Base
          </h2>
          <p className="mt-2 text-slate-400">Organizational memory for incidents, operations, billing, scheduling, and decisions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadEntries}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
            Refresh
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
          >
            <Plus size={17} />
            New Entry
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {sectionFilters.map((section) => {
          const active = selectedSection === section.value;
          return (
            <button
              key={section.value}
              type="button"
              onClick={() => {
                setSelectedSection(section.value);
                setCategoryFilter('');
              }}
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold transition ${
                active
                  ? 'bg-primary text-white shadow-lg shadow-indigo-500/30'
                  : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadEntries();
            }}
            className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/60 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
            placeholder="Search titles, summaries, keywords, or decisions"
          />
        </div>
        <select
          value={selectedSection === 'all' ? categoryFilter : selectedSection}
          onChange={(event) => {
            const next = event.target.value as KnowledgeCategory | '';
            if (selectedSection === 'all') {
              setCategoryFilter(next);
            }
          }}
          disabled={selectedSection !== 'all'}
          className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-indigo-400 disabled:opacity-60"
        >
          <option value="">All categories</option>
          {knowledgeCategories.map((category) => (
            <option key={category} value={category}>{labelForCategory(category)}</option>
          ))}
        </select>
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') loadEntries();
          }}
          className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
          placeholder="Tag"
        />
        <button
          type="button"
          onClick={loadEntries}
          disabled={loading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
          Search
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-300">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm font-semibold text-slate-400">Visible entries</div>
          <div className="mt-3 text-3xl font-black text-white">{counts.total || 0}</div>
        </div>
        {sectionFilters.slice(1).map((section) => (
          <div key={section.value} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm font-semibold text-slate-400">{section.label.replace(' Knowledge', '')}</div>
            <div className="mt-3 text-3xl font-black text-white">{counts[section.value] || 0}</div>
          </div>
        ))}
      </div>

      {showEditor && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="flex items-center gap-2 text-xl font-bold text-white">
              {editingId ? <Edit3 size={20} className="text-indigo-300" /> : <Plus size={20} className="text-indigo-300" />}
              {editingId ? 'Edit Knowledge' : 'New Knowledge'}
            </h3>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close editor"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
              placeholder="Title"
              required
            />
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as KnowledgeCategory }))}
              className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition focus:border-indigo-400"
            >
              {knowledgeCategories.map((category) => (
                <option key={category} value={category}>{labelForCategory(category)}</option>
              ))}
            </select>
            <input
              value={form.sourceType}
              onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}
              className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
              placeholder="Source type"
            />
            <input
              value={form.sourceId}
              onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))}
              className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
              placeholder="Source ID"
            />
            <textarea
              value={form.summary}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              className="min-h-28 resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 lg:col-span-2"
              placeholder="Summary"
              required
            />
            <textarea
              value={form.detailedContent}
              onChange={(event) => setForm((current) => ({ ...current, detailedContent: event.target.value }))}
              className="min-h-40 resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 lg:col-span-2"
              placeholder="Detailed content"
              required
            />
            <input
              value={form.keywords}
              onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
              className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
              placeholder="Keywords, comma separated"
            />
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              className="h-12 rounded-xl border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
              placeholder="Tags, comma separated"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              Save
            </button>
          </div>
        </form>
      )}

      {loading && entries.length === 0 ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 animate-spin text-sky-300" size={28} />
          Loading knowledge...
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-200">
                    {labelForCategory(entry.category)}
                  </span>
                  {entry.sourceType && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      {entry.sourceType}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Edit knowledge entry"
                    title="Edit"
                  >
                    <Edit3 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(entry)}
                    disabled={saving}
                    className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-60"
                    aria-label="Archive knowledge entry"
                    title="Archive"
                  >
                    <Archive size={17} />
                  </button>
                </div>
              </div>

              <h3 className="break-words text-xl font-black text-white">{entry.title}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{entry.summary}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.tags.slice(0, 5).map((item) => (
                  <span key={item} className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300">
                    {item}
                  </span>
                ))}
                {entry.keywords.slice(0, 5).map((item) => (
                  <span key={item} className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={14} />
                  Updated {new Date(entry.updatedAt).toLocaleString()}
                </span>
                {entry.relevanceScore !== undefined && (
                  <span className="inline-flex items-center gap-1">
                    <FileWarning size={14} />
                    Relevance {entry.relevanceScore}
                  </span>
                )}
              </div>
            </article>
          ))}
          {entries.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-slate-500 xl:col-span-2">
              No knowledge entries found.
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
