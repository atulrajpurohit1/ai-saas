'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  activatePromptVersion,
  createPromptVersion,
  deactivatePromptVersion,
  getPromptRegistry,
  PromptRegistryEntry,
} from '@/lib/ai-governance';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const statusClass = {
  active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  inactive: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

export default function AiPromptsPage() {
  const [registry, setRegistry] = useState<PromptRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [version, setVersion] = useState('');
  const [promptText, setPromptText] = useState('');
  const [activateNow, setActivateNow] = useState(true);

  const targets = useMemo(
    () =>
      registry.map((entry) => ({
        value: `${entry.moduleName}::${entry.promptKey}`,
        label: `${entry.label} - ${entry.promptKey}`,
      })),
    [registry],
  );

  const selectedEntry = useMemo(
    () =>
      registry.find(
        (entry) => `${entry.moduleName}::${entry.promptKey}` === selectedTarget,
      ) || null,
    [registry, selectedTarget],
  );

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const data = await getPromptRegistry();
      setRegistry(data);
      setSelectedTarget((current) => current || (data[0] ? `${data[0].moduleName}::${data[0].promptKey}` : ''));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI prompts.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEntry) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await createPromptVersion({
        moduleName: selectedEntry.moduleName,
        promptKey: selectedEntry.promptKey,
        version,
        promptText,
        status: activateNow ? 'active' : 'inactive',
      });
      setVersion('');
      setPromptText('');
      setSuccess('Prompt version saved.');
      await loadPrompts();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save prompt version.'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, action: 'activate' | 'deactivate') => {
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      if (action === 'activate') {
        await activatePromptVersion(id);
        setSuccess('Prompt version activated.');
      } else {
        await deactivatePromptVersion(id);
        setSuccess('Prompt version deactivated.');
      }
      await loadPrompts();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update prompt status.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileText className="text-indigo-300" size={30} />
            AI Prompts
          </h2>
          <p className="mt-2 text-slate-400">Prompt registry, active versions, and module mappings.</p>
        </div>
        <button
          type="button"
          onClick={loadPrompts}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-300">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-bold text-white">Registered AI Modules</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-semibold">Module</th>
                  <th className="px-5 py-4 font-semibold">Prompt</th>
                  <th className="px-5 py-4 font-semibold">Active Version</th>
                  <th className="px-5 py-4 font-semibold">Versions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">
                      Loading prompt registry...
                    </td>
                  </tr>
                ) : registry.map((entry) => (
                  <tr key={`${entry.moduleName}-${entry.promptKey}`} className="align-top text-sm text-slate-300">
                    <td className="px-5 py-4" data-label="Module">
                      <div className="font-bold text-white">{entry.label}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{entry.moduleName}</div>
                      <div className="mt-2 max-w-md text-xs leading-5 text-slate-500">{entry.description}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-300" data-label="Prompt">
                      {entry.promptKey}
                    </td>
                    <td className="px-5 py-4" data-label="Active Version">
                      {entry.activeVersion ? (
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${statusClass.active}`}>
                          <ShieldCheck size={14} />
                          {entry.activeVersion.version}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Fallback {entry.defaultVersion}</span>
                      )}
                    </td>
                    <td className="px-5 py-4" data-label="Versions">
                      <div className="space-y-3">
                        {entry.versions.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 whitespace-nowrap">
                            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusClass[item.status]}`}>
                              {item.status}
                            </span>
                            <span className="font-bold text-white shrink-0">{item.version}</span>
                            <span className="text-xs text-slate-500 shrink-0">{new Date(item.createdAt).toLocaleString()}</span>
                            {item.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'deactivate')}
                                disabled={busyId === item.id}
                                className="inline-flex shrink-0 min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60 whitespace-nowrap"
                              >
                                {busyId === item.id ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.id, 'activate')}
                                disabled={busyId === item.id}
                                className="inline-flex shrink-0 min-h-9 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
                              >
                                {busyId === item.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                Activate
                              </button>
                            )}
                          </div>
                        ))}
                        {entry.versions.length === 0 && (
                          <div className="text-xs text-slate-500">No custom versions.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <form onSubmit={handleCreate} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex items-center gap-3">
            <Plus className="text-indigo-300" size={21} />
            <h3 className="text-lg font-bold text-white">New Prompt Version</h3>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">AI module</span>
              <select
                value={selectedTarget}
                onChange={(event) => setSelectedTarget(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 text-sm font-semibold text-white outline-none transition focus:border-indigo-400"
              >
                {targets.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">Version</span>
              <input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                required
                maxLength={60}
                placeholder="v5-phase-8"
                className="min-h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 text-sm font-semibold text-white outline-none transition focus:border-indigo-400"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">Prompt text</span>
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                required
                rows={12}
                placeholder="Use {{context}} for the module input."
                className="w-full resize-y rounded-xl border border-white/10 bg-[#111827] px-4 py-3 font-mono text-sm leading-6 text-white outline-none transition focus:border-indigo-400"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={activateNow}
                onChange={(event) => setActivateNow(event.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Activate immediately
            </label>

            <button
              type="submit"
              disabled={saving || !selectedEntry}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
              Save Version
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
