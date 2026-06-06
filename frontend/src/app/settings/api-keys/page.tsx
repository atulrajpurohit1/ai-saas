'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ApiKeyRecord,
  PublicApiPermission,
  createApiKey,
  getApiKeyPermissions,
  getApiKeys,
  regenerateApiKey,
  revokeApiKey,
  updateApiKey,
} from '@/lib/integrations';
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
} from 'lucide-react';

type ApiKeyForm = {
  name: string;
  permissions: string[];
  expiresAt: string;
  rateLimit: number;
};

const emptyForm: ApiKeyForm = {
  name: '',
  permissions: [],
  expiresAt: '',
  rateLimit: 120,
};

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function ApiKeysSettingsPage() {
  const { can } = useAuth();
  const canManage = can('api_keys.manage');
  const [permissions, setPermissions] = useState<PublicApiPermission[]>([]);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [form, setForm] = useState<ApiKeyForm>(emptyForm);
  const [newSecret, setNewSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedKey = keys.find((key) => key.id === selectedKeyId) || null;

  const permissionsByGroup = useMemo(() => {
    return permissions.reduce<Record<string, PublicApiPermission[]>>((acc, permission) => {
      acc[permission.group] = acc[permission.group] || [];
      acc[permission.group].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [permissionData, keyData] = await Promise.all([
        getApiKeyPermissions(),
        getApiKeys(),
      ]);
      setPermissions(permissionData);
      setKeys(keyData);
      if (!selectedKeyId && keyData[0]) {
        selectKey(keyData[0]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load API keys.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectKey = (key: ApiKeyRecord) => {
    setSelectedKeyId(key.id);
    setForm({
      name: key.name,
      permissions: key.permissions,
      expiresAt: key.expires_at ? key.expires_at.slice(0, 10) : '',
      rateLimit: key.rate_limit_per_minute,
    });
    setError('');
  };

  const startCreate = () => {
    setSelectedKeyId('');
    setForm(emptyForm);
    setNewSecret('');
    setError('');
  };

  const togglePermission = (permissionKey: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionKey)
        ? current.permissions.filter((item) => item !== permissionKey)
        : [...current.permissions, permissionKey],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNewSecret('');
    try {
      const payload = {
        name: form.name.trim(),
        permissions: form.permissions,
        expires_at: form.expiresAt || undefined,
        rate_limit_per_minute: Number(form.rateLimit),
      };
      const saved = selectedKey
        ? await updateApiKey(selectedKey.id, payload)
        : await createApiKey(payload);
      if (saved.api_key) {
        setNewSecret(saved.api_key);
      }
      await loadData();
      setSelectedKeyId(saved.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save API key.'));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (key: ApiKeyRecord) => {
    if (!confirm(`Revoke ${key.name}?`)) return;
    setSaving(true);
    setError('');
    try {
      await revokeApiKey(key.id);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke API key.'));
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async (key: ApiKeyRecord) => {
    if (!confirm(`Regenerate ${key.name}?`)) return;
    setSaving(true);
    setError('');
    try {
      const updated = await regenerateApiKey(key.id);
      setNewSecret(updated.api_key || '');
      await loadData();
      setSelectedKeyId(updated.id);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not regenerate API key.'));
    } finally {
      setSaving(false);
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
  };

  return (
    <DashboardLayout requiredPermissions="api_keys.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <KeyRound className="text-indigo-300" size={28} />
            API Keys
          </h2>
          <p className="mt-2 text-muted-foreground">Public API access</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
          >
            <Plus size={18} />
            New Key
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          {error}
        </div>
      )}

      {newSecret && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="mb-2 text-sm font-black uppercase tracking-widest text-emerald-300">New API Key</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-950/70 px-3 py-2 text-sm text-emerald-100">
              {newSecret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Copy size={16} />
              Copy
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading API keys...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            {keys.map((key) => (
              <button
                key={key.id}
                type="button"
                onClick={() => selectKey(key)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedKeyId === key.id
                    ? 'border-indigo-400/60 bg-indigo-500/10'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{key.name}</div>
                    <div className="mt-1 truncate text-sm text-slate-400">{key.masked_key}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                    key.status === 'active'
                      ? 'bg-emerald-400/10 text-emerald-300'
                      : 'bg-rose-400/10 text-rose-300'
                  }`}>
                    {key.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <span>{key.permissions.length} permissions</span>
                  <span>{key.requests_last_24h} requests</span>
                  <span>{key.rate_limit_per_minute}/min</span>
                  <span>{formatDate(key.last_used_at)}</span>
                </div>
              </button>
            ))}
            {keys.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                No API keys.
              </div>
            )}
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_180px_180px_auto]">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Expires</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Rate / min</label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={form.rateLimit}
                  onChange={(event) => setForm({ ...form, rateLimit: Number(event.target.value) })}
                  disabled={!canManage}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                />
              </div>
              {canManage && (
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !form.name.trim() || form.permissions.length === 0}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                    Save
                  </button>
                  {selectedKey && (
                    <>
                      <button
                        type="button"
                        onClick={() => regenerate(selectedKey)}
                        disabled={saving}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 text-sky-300 transition hover:bg-sky-400/20"
                        aria-label="Regenerate API key"
                      >
                        <RefreshCw size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => revoke(selectedKey)}
                        disabled={saving || selectedKey.status === 'revoked'}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
                        aria-label="Revoke API key"
                      >
                        <Ban size={17} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-5">
              {Object.entries(permissionsByGroup).map(([group, groupPermissions]) => (
                <div key={group} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                  <div className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">
                    {group}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {groupPermissions.map((permission) => {
                      const checked = form.permissions.includes(permission.key);
                      return (
                        <button
                          key={permission.key}
                          type="button"
                          onClick={() => canManage && togglePermission(permission.key)}
                          disabled={!canManage}
                          className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                            checked
                              ? 'border-indigo-400/40 bg-indigo-500/10'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked ? 'border-indigo-300 bg-indigo-400 text-slate-950' : 'border-white/20'
                          }`}>
                            {checked && <Check size={14} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-white">{permission.name}</span>
                            <span className="block truncate text-xs text-slate-500">{permission.key}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
