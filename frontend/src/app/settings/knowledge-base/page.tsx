'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  KnowledgeEntry,
  KnowledgeEntryPayload,
  archiveKnowledgeEntry,
  createKnowledgeEntry,
  getKnowledgeCategories,
  getKnowledgeEntries,
  searchKnowledgeEntries,
  updateKnowledgeEntry,
} from '@/lib/knowledge-base';
import { useAuth } from '@/context/AuthContext';
import { Archive, BookOpen, Loader2, Plus, RotateCcw, Save, Search } from 'lucide-react';

type FormState = {
  title: string;
  category: string;
  sourceType: string;
  sourceId: string;
  summary: string;
  detailedContent: string;
  keywords: string;
  tags: string;
};

const emptyForm: FormState = {
  title: '',
  category: '',
  sourceType: 'manual',
  sourceId: '',
  summary: '',
  detailedContent: '',
  keywords: '',
  tags: '',
};

function formatDate(value?: string | null) {
  if (!value) return 'Active';
  return new Date(value).toLocaleString();
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPayload(form: FormState): KnowledgeEntryPayload {
  return {
    title: form.title.trim(),
    category: form.category,
    sourceType: form.sourceType.trim() || 'manual',
    sourceId: form.sourceId.trim() || undefined,
    summary: form.summary.trim(),
    detailedContent: form.detailedContent.trim(),
    keywords: splitList(form.keywords),
    tags: splitList(form.tags),
  };
}

function toForm(entry: KnowledgeEntry): FormState {
  return {
    title: entry.title,
    category: entry.category,
    sourceType: entry.sourceType || 'manual',
    sourceId: entry.sourceId || '',
    summary: entry.summary,
    detailedContent: entry.detailedContent,
    keywords: entry.keywords.join(', '),
    tags: entry.tags.join(', '),
  };
}

export default function KnowledgeBaseSettingsPage() {
  const { can } = useAuth();
  const canManage = can('knowledge.manage');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) || null,
    [entries, selectedId],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryData, entryData] = await Promise.all([
        getKnowledgeCategories(),
        query.trim()
          ? searchKnowledgeEntries({ q: query.trim(), category: categoryFilter, tag: tagFilter })
          : getKnowledgeEntries({ category: categoryFilter, tag: tagFilter, includeArchived }),
      ]);
      setCategories(categoryData);
      setEntries(entryData);
      setForm((current) => ({
        ...current,
        category: current.category || categoryData[0] || '',
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load knowledge base.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refresh = async () => {
    setMessage('');
    await load();
  };

  const startNew = () => {
    setSelectedId('');
    setForm({ ...emptyForm, category: categories[0] || '' });
    setError('');
    setMessage('');
  };

  const selectEntry = (entry: KnowledgeEntry) => {
    setSelectedId(entry.id);
    setForm(toForm(entry));
    setError('');
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = toPayload(form);
      const saved = selectedEntry
        ? await updateKnowledgeEntry(selectedEntry.id, payload)
        : await createKnowledgeEntry(payload);
      await load();
      setSelectedId(saved.id);
      setForm(toForm(saved));
      setMessage(selectedEntry ? 'Knowledge entry updated.' : 'Knowledge entry created.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save knowledge entry.'));
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!selectedEntry || !confirm(`Archive ${selectedEntry.title}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await archiveKnowledgeEntry(selectedEntry.id);
      await load();
      startNew();
      setMessage('Knowledge entry archived.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not archive knowledge entry.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="knowledge.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BookOpen className="text-indigo-300" size={28} />
            Knowledge Base
          </h2>
          <p className="mt-2 text-muted-foreground">Operational knowledge used by AI recommendations and copilots</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
          >
            <Plus size={18} />
            New Entry
          </button>
        )}
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}
      {message && <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}

      <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search knowledge"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{labelize(category)}</option>
            ))}
          </select>
          <input
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="Tag"
            className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950"
            />
            Archived
          </label>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-bold text-sky-300 transition hover:bg-sky-400/20"
          >
            {loading ? <Loader2 className="animate-spin" size={17} /> : <RotateCcw size={17} />}
            Refresh
          </button>
        </div>
      </section>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading knowledge base...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-3">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectEntry(entry)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedId === entry.id ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-2 font-bold text-white">{entry.title}</div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-widest text-indigo-300">{labelize(entry.category)}</div>
                  </div>
                  {entry.archivedAt && (
                    <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                      Archived
                    </span>
                  )}
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-400">{entry.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">{tag}</span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-500">{formatDate(entry.updatedAt)}</div>
              </button>
            ))}
            {entries.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">No knowledge entries.</div>}
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Category
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{labelize(category)}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Source Type
                <input
                  value={form.sourceType}
                  onChange={(event) => setForm({ ...form, sourceType: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                Source ID
                <input
                  value={form.sourceId}
                  onChange={(event) => setForm({ ...form, sourceId: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                Summary
                <textarea
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                  disabled={!canManage}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                Detailed Content
                <textarea
                  value={form.detailedContent}
                  onChange={(event) => setForm({ ...form, detailedContent: event.target.value })}
                  disabled={!canManage}
                  rows={10}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Keywords
                <input
                  value={form.keywords}
                  onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Tags
                <input
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {canManage && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !form.title.trim() || !form.summary.trim() || !form.detailedContent.trim() || !form.category}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                  Save
                </button>
              )}
              {canManage && selectedEntry && !selectedEntry.archivedAt && (
                <button
                  type="button"
                  onClick={archive}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm font-bold text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-60"
                >
                  <Archive size={17} />
                  Archive
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
