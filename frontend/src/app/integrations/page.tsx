'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ApiKeyRecord,
  CrmConnectorStatus,
  IntegrationOverview,
  PublicApiPermissionDefinition,
  WebhookRecord,
  createApiKey,
  createWebhook,
  disconnectCrm,
  getApiKeyPermissions,
  getCrmConnectorStatus,
  getApiKeys,
  getIntegrationOverview,
  getWebhookEvents,
  getWebhooks,
  importCrmContacts,
  regenerateApiKey,
  retryFailedWebhookDeliveries,
  retryWebhookDelivery,
  revokeApiKey,
  revokeWebhook,
  rotateWebhookSecret,
} from '@/lib/integrations';
import LeadImportDialog from '@/components/LeadImportDialog';
import CrmConnectDialog from '@/components/CrmConnectDialog';
import {
  Ban,
  ChevronDown,
  Code2,
  Copy,
  FileUp,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  RotateCcw,
  Send,
  Unplug,
  Webhook,
} from 'lucide-react';

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function IntegrationsPage() {
  const { can } = useAuth();
  const canViewApiKeys = can('api_keys.view');
  const canManageApiKeys = can('api_keys.manage');
  const canManageWebhooks = can('webhooks.manage');
  const canManageCrm = can('integrations.manage') || can('crm.manage');
  const [overview, setOverview] = useState<IntegrationOverview | null>(null);
  const [crmStatus, setCrmStatus] = useState<CrmConnectorStatus | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showCrmConnect, setShowCrmConnect] = useState(false);
  /**
   * API keys, webhooks and the two log tables are only useful to someone
   * wiring up their own software. They stay collapsed so the common jobs
   * (connect a CRM, import a CSV) are the whole page for everyone else.
   */
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [apiKeyPermissions, setApiKeyPermissions] = useState<PublicApiPermissionDefinition[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    permissions: [] as string[],
    expiresAt: '',
    rateLimit: '120',
  });
  const [form, setForm] = useState({ eventType: '', endpointUrl: '' });
  const [newApiKey, setNewApiKey] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const [overviewData, crmData, eventData, webhookData, apiKeyPermissionData, apiKeyData] = await Promise.all([
        getIntegrationOverview(),
        getCrmConnectorStatus(),
        getWebhookEvents(),
        getWebhooks(),
        canViewApiKeys ? getApiKeyPermissions() : Promise.resolve([] as PublicApiPermissionDefinition[]),
        canViewApiKeys ? getApiKeys() : Promise.resolve([] as ApiKeyRecord[]),
      ]);
      setOverview(overviewData);
      setCrmStatus(crmData);
      setEvents(eventData);
      setWebhooks(webhookData);
      setApiKeyPermissions(apiKeyPermissionData);
      setApiKeys(apiKeyData);
      setForm((current) => ({
        ...current,
        eventType: current.eventType || eventData[0] || '',
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load integrations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleApiPermission = (permission: string) => {
    setApiKeyForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const submitApiKey = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    setNewApiKey('');
    try {
      const created = await createApiKey({
        name: apiKeyForm.name.trim(),
        permissions: apiKeyForm.permissions,
        expires_at: apiKeyForm.expiresAt ? new Date(`${apiKeyForm.expiresAt}T23:59:59.000Z`).toISOString() : undefined,
        rate_limit_per_minute: Number(apiKeyForm.rateLimit) || 120,
      });
      setNewApiKey(created.api_key || '');
      setApiKeyForm({ name: '', permissions: [], expiresAt: '', rateLimit: '120' });
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create API key.'));
    } finally {
      setSaving(false);
    }
  };

  const revokeKey = async (apiKey: ApiKeyRecord) => {
    if (!confirm(`Revoke ${apiKey.name}?`)) return;
    setSaving(true);
    setError('');
    try {
      await revokeApiKey(apiKey.id);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke API key.'));
    } finally {
      setSaving(false);
    }
  };

  const regenerateKey = async (apiKey: ApiKeyRecord) => {
    if (!confirm(`Regenerate ${apiKey.name}? The old key will stop working.`)) return;
    setSaving(true);
    setError('');
    setNewApiKey('');
    try {
      const updated = await regenerateApiKey(apiKey.id);
      setNewApiKey(updated.api_key || '');
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not regenerate API key.'));
    } finally {
      setSaving(false);
    }
  };

  const submitWebhook = async () => {
    setSaving(true);
    setError('');
    setNewSecret('');
    try {
      const created = await createWebhook({
        event_type: form.eventType,
        endpoint_url: form.endpointUrl.trim(),
      });
      setNewSecret(created.secret_key || '');
      setForm({ eventType: events[0] || '', endpointUrl: '' });
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create webhook.'));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (webhook: WebhookRecord) => {
    if (!confirm(`Revoke ${webhook.event_type}?`)) return;
    setSaving(true);
    setError('');
    try {
      await revokeWebhook(webhook.id);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke webhook.'));
    } finally {
      setSaving(false);
    }
  };

  const rotateSecret = async (webhook: WebhookRecord) => {
    setSaving(true);
    setError('');
    try {
      const updated = await rotateWebhookSecret(webhook.id);
      setNewSecret(updated.secret_key || '');
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not rotate webhook secret.'));
    } finally {
      setSaving(false);
    }
  };

  const retryFailed = async () => {
    setSaving(true);
    setError('');
    try {
      await retryFailedWebhookDeliveries();
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not retry failed deliveries.'));
    } finally {
      setSaving(false);
    }
  };

  const retryDelivery = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await retryWebhookDelivery(id);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not retry delivery.'));
    } finally {
      setSaving(false);
    }
  };

  const syncProvider = async (providerId: string, label: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await importCrmContacts(providerId);
      await loadData();
      setNotice(`${label} import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`);
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not import ${label} contacts.`));
    } finally {
      setSaving(false);
    }
  };

  const disconnectProvider = async (providerId: string, label: string) => {
    if (!confirm(`Disconnect ${label}? Existing imported leads will remain.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await disconnectCrm(providerId);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not disconnect ${label}.`));
    } finally {
      setSaving(false);
    }
  };

  /**
   * The connected CRMs, in a stable order so cards don't jump around as the
   * status object's key order changes between loads.
   */
  const connectedProviders = Object.entries(crmStatus || {})
    .filter(([, status]) => status.connected)
    .sort(([a], [b]) => a.localeCompare(b));

  const copySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
  };

  const copyApiKey = async () => {
    if (!newApiKey) return;
    await navigator.clipboard.writeText(newApiKey);
  };

  const permissionGroups = apiKeyPermissions.reduce<Record<string, PublicApiPermissionDefinition[]>>(
    (groups, permission) => {
      const group = permission.group || 'General';
      groups[group] = [...(groups[group] || []), permission];
      return groups;
    },
    {},
  );

  return (
    <DashboardLayout requiredPermissions="integrations.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Plug className="text-indigo-300" size={28} />
            Integrations
          </h2>
          <p className="mt-2 text-muted-foreground">
            Connect AegisLead to the other tools you already use.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          {notice}
        </div>
      )}

      {newApiKey && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="mb-1 text-sm font-black uppercase tracking-widest text-emerald-300">Your new API key</div>
          <p className="mb-3 text-sm text-emerald-100/80">
            Copy it now and store it somewhere safe &mdash; for your security we cannot show
            it again. If you lose it, use the refresh button on the key to issue a new one.
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-950/70 px-3 py-2 text-sm text-emerald-100">
              {newApiKey}
            </code>
            <button
              type="button"
              onClick={copyApiKey}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Copy size={16} />
              Copy
            </button>
          </div>
        </div>
      )}

      {newSecret && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="mb-1 text-sm font-black uppercase tracking-widest text-emerald-300">Your webhook secret</div>
          <p className="mb-3 text-sm text-emerald-100/80">
            Give this to your developer &mdash; it proves the notifications really came from
            AegisLead. Copy it now; we cannot show it again.
          </p>
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
          Loading integrations...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {(overview?.active_integrations || []).map((item) => (
              <div key={item.type} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-sm font-semibold text-slate-400">{item.label}</div>
                <div className="mt-2 text-3xl font-black text-white">{item.active}</div>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <Plug className="text-indigo-300" size={22} />
                  <h3 className="text-xl font-bold">Connect your CRM</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sync contacts both ways with HubSpot, GoHighLevel, Salesforce, Pipedrive,
                  Zoho, Close, Freshsales or Copper. Using something else? Import a CSV
                  export instead &mdash; it works with any CRM.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                {canManageCrm && (
                  <button
                    type="button"
                    onClick={() => setShowCrmConnect(true)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
                  >
                    <Plug size={17} />
                    Connect CRM
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCsvImport(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                >
                  <FileUp size={17} />
                  Import CSV
                </button>
              </div>
            </div>
          </section>

          <LeadImportDialog open={showCsvImport} onOpenChange={setShowCsvImport} />
          <CrmConnectDialog
            open={showCrmConnect}
            onOpenChange={setShowCrmConnect}
            onConnected={loadData}
            onImportCsv={() => setShowCsvImport(true)}
          />

          {/*
            Only CRMs this tenant has actually connected get a card. Providers
            we support but that are not connected live in the picker, so the
            page never shows a dead "Not Configured" card for something the
            tenant cannot act on.
          */}
          {connectedProviders.map(([providerKey, status]) => (
            <section key={providerKey} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <Plug className="text-orange-300" size={22} />
                    <h3 className="text-xl font-bold">{status.label || providerKey}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Import contacts into leads and push prospects back to this CRM.
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${
                  status.last_error
                    ? 'bg-rose-400/10 text-rose-300'
                    : 'bg-emerald-400/10 text-emerald-300'
                }`}>
                  {status.last_error ? 'Connection Error' : 'Connected'}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">Account</div>
                    <div className="mt-2 truncate font-bold text-white">
                      {status.external_account_name || status.portal_id || 'Connected'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">Last Sync</div>
                    <div className="mt-2 font-bold text-white">{formatDate(status.last_sync_at)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">Scopes</div>
                    <div className="mt-2 truncate font-bold text-white">
                      {(status.scopes || []).join(', ') || 'Full access'}
                    </div>
                  </div>
                </div>

                {canManageCrm && (
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => syncProvider(providerKey, status.label || providerKey)}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
                      Import Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => disconnectProvider(providerKey, status.label || providerKey)}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-bold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-60"
                    >
                      <Unplug size={17} />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

              {status.last_error && (
                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {status.last_error}
                </div>
              )}
            </section>
          ))}

          {/*
            Everything below is for tenants wiring up their own software.
            One disclosure, closed by default, so the page reads as "connect
            a CRM or import a CSV" unless someone goes looking for more.
          */}
          <section className="rounded-xl border border-white/10 bg-white/[0.04]">
            <button
              type="button"
              onClick={() => setShowDeveloper((current) => !current)}
              aria-expanded={showDeveloper}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] sm:p-6"
            >
              <Code2 className="shrink-0 text-slate-400" size={22} />
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-bold">Developer tools</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Optional. Only needed if a developer is connecting your own software to
                  AegisLead. Most accounts never open this.
                </span>
              </span>
              <ChevronDown
                className={`shrink-0 text-slate-400 transition-transform ${showDeveloper ? 'rotate-180' : ''}`}
                size={20}
              />
            </button>
          </section>

          {showDeveloper && canViewApiKeys && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-2 flex items-center gap-3">
                <KeyRound className="text-amber-300" size={22} />
                <h3 className="text-xl font-bold">API keys</h3>
              </div>
              <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
                An API key is a password for another program. It lets software you
                control &mdash; your website, your accounting system &mdash; read or add
                AegisLead records without anyone logging in. Share a key only with people
                you trust; anyone holding it can do whatever you tick below.
              </p>

              {canManageApiKeys && (
                <div className="mb-6 rounded-xl border border-white/10 bg-slate-950/20 p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_170px_190px]">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-white">Name</span>
                      <input
                        value={apiKeyForm.name}
                        onChange={(event) => setApiKeyForm({ ...apiKeyForm, name: event.target.value })}
                        placeholder="e.g. Website contact form"
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="mt-1.5 block text-xs text-slate-500">
                        So you can tell your keys apart later.
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-white">Requests per minute</span>
                      <input
                        value={apiKeyForm.rateLimit}
                        onChange={(event) => setApiKeyForm({ ...apiKeyForm, rateLimit: event.target.value })}
                        type="number"
                        min="1"
                        max="5000"
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="mt-1.5 block text-xs text-slate-500">
                        Leave at 120 unless advised.
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-white">Expires</span>
                      <input
                        value={apiKeyForm.expiresAt}
                        onChange={(event) => setApiKeyForm({ ...apiKeyForm, expiresAt: event.target.value })}
                        type="date"
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="mt-1.5 block text-xs text-slate-500">
                        Optional. Blank means it never expires.
                      </span>
                    </label>
                  </div>

                  <div className="mt-5">
                    <div className="text-sm font-bold text-white">What may this key do?</div>
                    <p className="mt-1 text-xs text-slate-500">
                      Tick at least one. Choose the fewest that get the job done &mdash;
                      &ldquo;read&rdquo; only looks at records, &ldquo;write&rdquo; can also create them.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(permissionGroups).map(([group, permissions]) => (
                      <div key={group} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">{group}</div>
                        <div className="space-y-2">
                          {permissions.map((permission) => (
                            <label key={permission.key} className="flex items-start gap-3 rounded-lg p-2 transition hover:bg-white/5">
                              <input
                                type="checkbox"
                                checked={apiKeyForm.permissions.includes(permission.key)}
                                onChange={() => toggleApiPermission(permission.key)}
                                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950"
                              />
                              <span>
                                <span className="block text-sm font-bold text-white">{permission.name}</span>
                                <span className="block text-xs text-slate-500">{permission.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={submitApiKey}
                      disabled={saving || !apiKeyForm.name.trim() || apiKeyForm.permissions.length === 0}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />}
                      Create key
                    </button>
                    {/* Say why the button is dim, rather than leaving it dead. */}
                    {(!apiKeyForm.name.trim() || apiKeyForm.permissions.length === 0) && (
                      <span className="text-xs text-slate-500">
                        {!apiKeyForm.name.trim() && apiKeyForm.permissions.length === 0
                          ? 'Add a name and tick at least one permission to continue.'
                          : !apiKeyForm.name.trim()
                            ? 'Add a name to continue.'
                            : 'Tick at least one permission to continue.'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white">{apiKey.name}</span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                            apiKey.status === 'active'
                              ? 'bg-emerald-400/10 text-emerald-300'
                              : 'bg-rose-400/10 text-rose-300'
                          }`}>
                            {apiKey.status}
                          </span>
                        </div>
                        <div className="mt-2 font-mono text-sm text-indigo-200">{apiKey.masked_key}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {apiKey.permissions.map((permission) => (
                            <span key={permission} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                              {permission}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {apiKey.requests_last_24h} requests in 24h | last used {formatDate(apiKey.last_used_at)} | expires {formatDate(apiKey.expires_at)}
                        </div>
                      </div>
                      {canManageApiKeys && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => regenerateKey(apiKey)}
                            disabled={saving}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 text-sky-300 transition hover:bg-sky-400/20"
                            aria-label="Regenerate API key"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeKey(apiKey)}
                            disabled={saving || apiKey.status === 'revoked'}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
                            aria-label="Revoke API key"
                          >
                            <Ban size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {apiKeys.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                    No API keys yet &mdash; and you only need one if a developer is
                    connecting your own software to AegisLead.
                  </div>
                )}
              </div>
            </section>
          )}

          {showDeveloper && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-2 flex items-center gap-3">
                <Webhook className="text-indigo-300" size={22} />
                <h3 className="text-xl font-bold">Webhooks</h3>
              </div>
              <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
                A webhook is an automatic notification. Pick something that happens in
                AegisLead &mdash; an incident approved, an invoice paid &mdash; and we send
                the details straight to a web address you choose, the moment it happens.
                Your developer will tell you what address to use.
              </p>

              {canManageWebhooks && (
              <div className="mb-6 grid gap-4 rounded-xl border border-white/10 bg-slate-950/20 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white">When this happens</span>
                <select
                  value={form.eventType}
                  onChange={(event) => setForm({ ...form, eventType: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {events.map((eventType) => (
                    <option key={eventType} value={eventType} className="bg-[#0e0e1a]">
                      {eventType}
                    </option>
                  ))}
                </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white">Send it to this address</span>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={form.endpointUrl}
                      onChange={(event) => setForm({ ...form, endpointUrl: event.target.value })}
                      placeholder="https://example.com/webhooks/ai-saas"
                      className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <button
                      type="button"
                      onClick={submitWebhook}
                      disabled={saving || !form.eventType || !form.endpointUrl.trim()}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                      Add webhook
                    </button>
                  </div>
                </label>
              </div>
              )}

            <div className="grid gap-3">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white">{webhook.event_type}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                          webhook.status === 'active'
                            ? 'bg-emerald-400/10 text-emerald-300'
                            : 'bg-rose-400/10 text-rose-300'
                        }`}>
                          {webhook.status}
                        </span>
                      </div>
                      <div className="mt-2 break-all text-sm text-slate-400">{webhook.endpoint_url}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {webhook.delivery_count} deliveries | latest {formatDate(webhook.latest_delivery?.created_at)}
                      </div>
                    </div>
                    {canManageWebhooks && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => rotateSecret(webhook)}
                          disabled={saving}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 text-sky-300 transition hover:bg-sky-400/20"
                          aria-label="Rotate webhook secret"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => revoke(webhook)}
                          disabled={saving || webhook.status === 'revoked'}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
                          aria-label="Revoke webhook"
                        >
                          <Ban size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {webhooks.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                  No webhooks yet. Once you add one, its delivery history appears here.
                </div>
              )}
            </div>
          </section>
          )}

          {showDeveloper && (
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold">Webhook delivery history</h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Every notification we tried to send, and whether it arrived. Failures are
                  usually the receiving address being offline.
                </p>
              </div>
              {canManageWebhooks && (overview?.failures_last_24h || 0) > 0 && (
                <button
                  type="button"
                  onClick={retryFailed}
                  disabled={saving}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-bold text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={17} /> : <RotateCcw size={18} />}
                  Retry all failed ({overview?.failures_last_24h})
                </button>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="responsive-table w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Retries</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(overview?.delivery_logs || []).map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="px-4 py-4" data-label="Event">
                        <div className="font-semibold text-white">{delivery.event_type}</div>
                        <div className="max-w-md truncate text-xs text-slate-500">{delivery.endpoint_url}</div>
                      </td>
                      <td className="px-4 py-4" data-label="Status">
                        <span className={delivery.success ? 'text-emerald-300' : 'text-rose-300'}>
                          {delivery.success ? 'Success' : delivery.last_error || 'Failed'}
                        </span>
                        {delivery.response_status && (
                          <div className="text-xs text-slate-500">HTTP {delivery.response_status}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400" data-label="Retries">{delivery.retry_count}</td>
                      <td className="px-4 py-4 text-sm text-slate-400" data-label="Created">{formatDate(delivery.created_at)}</td>
                      <td className="px-4 py-4" data-label="Actions">
                        {!delivery.success && canManageWebhooks && (
                          <button
                            type="button"
                            onClick={() => retryDelivery(delivery.id)}
                            disabled={saving}
                            className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 text-xs font-bold text-sky-300 transition hover:bg-sky-400/20"
                          >
                            <RotateCcw size={14} />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(overview?.delivery_logs || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        Nothing sent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {showDeveloper && canViewApiKeys && (
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <h3 className="text-xl font-bold">API request history</h3>
            <p className="mb-5 mt-1 max-w-2xl text-sm text-muted-foreground">
              The last requests other software made with your API keys
              {typeof overview?.api_usage.requests_last_24h === 'number'
                ? ` — ${overview.api_usage.requests_last_24h} in the past 24 hours.`
                : '.'}
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="responsive-table w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(overview?.request_logs || []).map((request) => (
                    <tr key={request.id}>
                      <td className="px-4 py-4" data-label="Key">
                        <div className="font-semibold text-white">{request.api_key_name}</div>
                        <div className="text-xs text-slate-500">{request.key_prefix}...</div>
                      </td>
                      <td className="px-4 py-4" data-label="Request">
                        <div className="font-semibold text-white">{request.method}</div>
                        <div className="max-w-md truncate text-xs text-slate-500">{request.endpoint}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400" data-label="Status">{request.status_code}</td>
                      <td className="px-4 py-4 text-sm text-slate-400" data-label="Time">{formatDate(request.created_at)}</td>
                    </tr>
                  ))}
                  {(overview?.request_logs || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                        No requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
