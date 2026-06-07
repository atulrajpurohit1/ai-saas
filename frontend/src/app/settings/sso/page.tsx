'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { Branch, getBranches } from '@/lib/branches';
import { getRoles, Role } from '@/lib/roles';
import {
  createSsoProvider,
  getSsoProviders,
  SsoProvider,
  SsoRoleMapping,
  testSsoProvider,
  updateSsoProvider,
} from '@/lib/sso';
import { Check, Loader2, Plus, Save, ShieldCheck, Trash2, Wifi } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const providerTypes = [
  { value: 'google_oidc', label: 'Google Workspace' },
  { value: 'microsoft_oidc', label: 'Microsoft Entra ID' },
  { value: 'okta_oidc', label: 'Okta' },
  { value: 'auth0_oidc', label: 'Auth0' },
  { value: 'saml', label: 'SAML 2.0' },
];

type FormState = {
  provider_type: string;
  provider_name: string;
  client_id: string;
  client_secret: string;
  issuer_url: string;
  metadata_url: string;
  saml_metadata: string;
  email_domains: string;
  auto_provision: boolean;
  default_role_id: string;
  default_branch_id: string;
  status: string;
  role_mappings: SsoRoleMapping[];
};

const emptyForm: FormState = {
  provider_type: 'google_oidc',
  provider_name: '',
  client_id: '',
  client_secret: '',
  issuer_url: '',
  metadata_url: '',
  saml_metadata: '',
  email_domains: '',
  auto_provision: true,
  default_role_id: '',
  default_branch_id: '',
  status: 'inactive',
  role_mappings: [],
};

function toForm(provider: SsoProvider): FormState {
  return {
    provider_type: provider.provider_type,
    provider_name: provider.provider_name,
    client_id: provider.client_id || '',
    client_secret: '',
    issuer_url: provider.issuer_url || '',
    metadata_url: provider.metadata_url || '',
    saml_metadata: '',
    email_domains: provider.email_domains.join(', '),
    auto_provision: provider.auto_provision,
    default_role_id: provider.default_role_id || '',
    default_branch_id: provider.default_branch_id || '',
    status: provider.status,
    role_mappings: provider.role_mappings || [],
  };
}

export default function SsoSettingsPage() {
  const { can } = useAuth();
  const canManage = can('sso.manage');
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => providers.find((provider) => provider.id === selectedId) || null, [providers, selectedId]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [providerData, roleData, branchData] = await Promise.all([
        getSsoProviders(),
        getRoles(),
        getBranches(),
      ]);
      setProviders(providerData);
      setRoles(roleData.filter((role) => role.isActive));
      setBranches(branchData);
      if (!selectedId && providerData[0]) {
        setSelectedId(providerData[0].id);
        setForm(toForm(providerData[0]));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load SSO settings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectProvider = (provider: SsoProvider) => {
    setSelectedId(provider.id);
    setForm(toForm(provider));
    setTestResult('');
    setError('');
  };

  const newProvider = () => {
    setSelectedId('');
    setForm(emptyForm);
    setTestResult('');
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setTestResult('');
    try {
      const payload = {
        ...form,
        email_domains: form.email_domains.split(',').map((domain) => domain.trim()).filter(Boolean),
        default_role_id: form.default_role_id || null,
        default_branch_id: form.default_branch_id || null,
        client_secret: form.client_secret || undefined,
        role_mappings: form.role_mappings.filter((mapping) => mapping.external_group && mapping.role_id),
      };
      const saved = selected ? await updateSsoProvider(selected.id, payload) : await createSsoProvider(payload);
      await load();
      setSelectedId(saved.id);
      setForm(toForm(saved));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save SSO provider.'));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!selected) return;
    setTesting(true);
    setError('');
    setTestResult('');
    try {
      const result = await testSsoProvider(selected.id);
      setTestResult(result.ok ? 'Connection looks good.' : 'Connection test returned warnings.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Connection test failed.'));
    } finally {
      setTesting(false);
    }
  };

  const updateMapping = (index: number, changes: Partial<SsoRoleMapping>) => {
    setForm((current) => ({
      ...current,
      role_mappings: current.role_mappings.map((mapping, itemIndex) =>
        itemIndex === index ? { ...mapping, ...changes } : mapping,
      ),
    }));
  };

  const removeMapping = (index: number) => {
    setForm((current) => ({
      ...current,
      role_mappings: current.role_mappings.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <DashboardLayout requiredPermissions="sso.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <ShieldCheck className="text-indigo-300" size={28} />
            Enterprise SSO
          </h2>
          <p className="mt-2 text-muted-foreground">Identity provider authentication</p>
        </div>
        {canManage && (
          <button type="button" onClick={newProvider} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400">
            <Plus size={18} />
            New Provider
          </button>
        )}
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}
      {testResult && <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{testResult}</div>}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading SSO settings...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-3">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => selectProvider(provider)}
                className={`w-full rounded-xl border p-4 text-left transition ${selectedId === provider.id ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{provider.provider_name}</div>
                    <div className="mt-1 truncate text-sm text-slate-400">{provider.provider_type}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${provider.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-300'}`}>
                    {provider.status}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-500">{provider.email_domains.join(', ') || 'No domains'}</div>
              </button>
            ))}
            {providers.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">No SSO providers.</div>}
          </div>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Provider
                <select value={form.provider_type} onChange={(event) => setForm({ ...form, provider_type: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60">
                  {providerTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Name
                <input value={form.provider_name} onChange={(event) => setForm({ ...form, provider_name: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Client ID
                <input value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })} disabled={!canManage || form.provider_type === 'saml'} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Client Secret
                <input type="password" value={form.client_secret} placeholder={selected?.client_secret_configured ? 'Configured' : ''} onChange={(event) => setForm({ ...form, client_secret: event.target.value })} disabled={!canManage || form.provider_type === 'saml'} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Issuer URL
                <input value={form.issuer_url} onChange={(event) => setForm({ ...form, issuer_url: event.target.value })} disabled={!canManage || form.provider_type === 'saml'} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Metadata URL
                <input value={form.metadata_url} onChange={(event) => setForm({ ...form, metadata_url: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Email Domains
                <input value={form.email_domains} onChange={(event) => setForm({ ...form, email_domains: event.target.value })} disabled={!canManage} placeholder="company.com, example.com" className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Default Role
                <select value={form.default_role_id} onChange={(event) => setForm({ ...form, default_role_id: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60">
                  <option value="">Branch Admin fallback</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Default Branch
                <select value={form.default_branch_id} onChange={(event) => setForm({ ...form, default_branch_id: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60">
                  <option value="">Tenant-wide</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-slate-300">
              <input type="checkbox" checked={form.auto_provision} onChange={(event) => setForm({ ...form, auto_provision: event.target.checked })} disabled={!canManage} className="h-5 w-5 rounded border-white/10 bg-white/5 accent-indigo-500" />
              Auto-create users on first SSO login
            </label>

            {form.provider_type === 'saml' && (
              <label className="mt-4 block space-y-2 text-sm font-semibold text-slate-300">
                SAML Metadata XML
                <textarea value={form.saml_metadata} onChange={(event) => setForm({ ...form, saml_metadata: event.target.value })} disabled={!canManage} rows={6} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
            )}

            <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-black text-white">Role Mapping</h3>
                {canManage && (
                  <button type="button" onClick={() => setForm({ ...form, role_mappings: [...form.role_mappings, { external_group: '', role_id: '', branch_id: '' }] })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-white transition hover:bg-white/10">
                    <Plus size={16} />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {form.role_mappings.map((mapping, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <input value={mapping.external_group} onChange={(event) => updateMapping(index, { external_group: event.target.value })} disabled={!canManage} placeholder="External group" className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
                    <select value={mapping.role_id} onChange={(event) => updateMapping(index, { role_id: event.target.value })} disabled={!canManage} className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60">
                      <option value="">Platform role</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <select value={mapping.branch_id || ''} onChange={(event) => updateMapping(index, { branch_id: event.target.value || null })} disabled={!canManage} className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60">
                      <option value="">Tenant-wide</option>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                    {canManage && (
                      <button type="button" onClick={() => removeMapping(index)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 text-rose-300 transition hover:bg-rose-400/20" aria-label="Remove mapping">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {form.role_mappings.length === 0 && <div className="text-sm text-slate-500">No group mappings configured.</div>}
              </div>
            </div>

            {canManage && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={save} disabled={saving || !form.provider_name.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                  Save
                </button>
                {selected && (
                  <button type="button" onClick={test} disabled={testing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-60">
                    {testing ? <Loader2 className="animate-spin" size={17} /> : <Wifi size={17} />}
                    Test
                  </button>
                )}
                {testResult && <span className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-300"><Check size={17} /> Verified</span>}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
