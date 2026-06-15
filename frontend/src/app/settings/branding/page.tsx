'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  BrandingSnapshot,
  BrandingUpdatePayload,
  CustomDomain,
  addCustomDomain,
  getBranding,
  getCustomDomains,
  updateBranding,
  verifyCustomDomain,
} from '@/lib/branding';
import { useAuth } from '@/context/AuthContext';
import { Check, Copy, Globe2, Loader2, Palette, Plus, Save, ShieldCheck } from 'lucide-react';

const defaultBranding: BrandingSnapshot = {
  company_name: '',
  logo_url: '',
  favicon_url: '',
  primary_color: '#6366f1',
  secondary_color: '#334155',
  accent_color: '#818cf8',
  login_background: '',
  welcome_message: '',
  support_email: '',
  support_phone: '',
};

function formatDate(value?: string | null) {
  if (!value) return 'Not verified';
  return new Date(value).toLocaleString();
}

function normalizePayload(form: BrandingSnapshot): BrandingUpdatePayload {
  return {
    company_name: form.company_name.trim() || null,
    logo_url: form.logo_url?.trim() || null,
    favicon_url: form.favicon_url?.trim() || null,
    primary_color: form.primary_color,
    secondary_color: form.secondary_color,
    accent_color: form.accent_color,
    login_background: form.login_background?.trim() || null,
    welcome_message: form.welcome_message?.trim() || null,
    support_email: form.support_email?.trim() || null,
    support_phone: form.support_phone?.trim() || null,
  };
}

export default function BrandingSettingsPage() {
  const { can } = useAuth();
  const canManage = can('branding.manage');
  const [form, setForm] = useState<BrandingSnapshot>(defaultBranding);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const previewStyle = useMemo(
    () => ({
      background: form.login_background
        ? `linear-gradient(90deg, rgba(15,23,42,.88), rgba(15,23,42,.62)), url(${form.login_background}) center/cover`
        : `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
      borderColor: form.accent_color,
    }),
    [form.accent_color, form.login_background, form.primary_color, form.secondary_color],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [brandingData, domainData] = await Promise.all([getBranding(), getCustomDomains()]);
      setForm({
        ...defaultBranding,
        ...brandingData,
        logo_url: brandingData.logo_url || '',
        favicon_url: brandingData.favicon_url || '',
        login_background: brandingData.login_background || '',
        welcome_message: brandingData.welcome_message || '',
        support_email: brandingData.support_email || '',
        support_phone: brandingData.support_phone || '',
      });
      setDomains(domainData);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load branding settings.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await updateBranding(normalizePayload(form));
      setForm({
        ...form,
        ...saved,
        logo_url: saved.logo_url || '',
        favicon_url: saved.favicon_url || '',
        login_background: saved.login_background || '',
        welcome_message: saved.welcome_message || '',
        support_email: saved.support_email || '',
        support_phone: saved.support_phone || '',
      });
      setMessage('Branding updated.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save branding.'));
    } finally {
      setSaving(false);
    }
  };

  const addDomain = async () => {
    setDomainSaving(true);
    setError('');
    setMessage('');
    try {
      await addCustomDomain(domainInput.trim());
      setDomainInput('');
      setDomains(await getCustomDomains());
      setMessage('Domain added.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add domain.'));
    } finally {
      setDomainSaving(false);
    }
  };

  const verifyDomain = async (domain: CustomDomain) => {
    setDomainSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await verifyCustomDomain(domain.id);
      setDomains((current) => current.map((item) => (item.id === result.id ? result : item)));
      setMessage(result.verification_error || 'Domain verified.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not verify domain.'));
    } finally {
      setDomainSaving(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage('Copied.');
  };

  return (
    <DashboardLayout requiredPermissions="branding.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Palette className="text-indigo-300" size={28} />
            Branding
          </h2>
          <p className="mt-2 text-muted-foreground">Tenant identity, email/PDF styling, and custom domains</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={18} />}
            Save
          </button>
        )}
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}
      {message && <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading branding...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Company Name
                <input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Support Email
                <input value={form.support_email || ''} onChange={(event) => setForm({ ...form, support_email: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Support Phone
                <input value={form.support_phone || ''} onChange={(event) => setForm({ ...form, support_phone: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Logo URL
                <input value={form.logo_url || ''} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Favicon URL
                <input value={form.favicon_url || ''} onChange={(event) => setForm({ ...form, favicon_url: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Login Background URL
                <input value={form.login_background || ''} onChange={(event) => setForm({ ...form, login_background: event.target.value })} disabled={!canManage} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Primary Color
                <input type="color" value={form.primary_color} onChange={(event) => setForm({ ...form, primary_color: event.target.value })} disabled={!canManage} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-2 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Secondary Color
                <input type="color" value={form.secondary_color} onChange={(event) => setForm({ ...form, secondary_color: event.target.value })} disabled={!canManage} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-2 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Accent Color
                <input type="color" value={form.accent_color} onChange={(event) => setForm({ ...form, accent_color: event.target.value })} disabled={!canManage} className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-2 disabled:opacity-60" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300 lg:col-span-2">
                Welcome Message
                <textarea value={form.welcome_message || ''} onChange={(event) => setForm({ ...form, welcome_message: event.target.value })} disabled={!canManage} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60" />
              </label>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="overflow-hidden rounded-xl border bg-slate-950/60" style={previewStyle}>
              <div className="p-6">
                <div className="mb-10 flex items-center gap-3">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="" className="h-12 max-w-40 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-lg font-black text-white">
                      {(form.company_name || 'A').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-lg font-black text-white">{form.company_name || 'Ai Saas'}</div>
                    <div className="truncate text-sm text-white/70">{form.support_email || 'support@example.com'}</div>
                  </div>
                </div>
                <h3 className="max-w-xs text-3xl font-black text-white">{form.welcome_message || 'Welcome back.'}</h3>
                <button type="button" className="mt-6 min-h-11 rounded-xl px-5 text-sm font-bold text-white" style={{ backgroundColor: form.accent_color }}>
                  Continue
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <Globe2 className="text-sky-300" size={22} />
                <h3 className="text-xl font-bold">Custom Domains</h3>
              </div>
              {canManage && (
                <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="portal.example.com" className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  <button type="button" onClick={addDomain} disabled={domainSaving || !domainInput.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60">
                    {domainSaving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
                    Add
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {domains.map((domain) => (
                  <div key={domain.id} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{domain.domain}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDate(domain.verified_at)}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${domain.verification_status === 'verified' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>
                        {domain.verification_status}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg bg-black/20 p-3 text-xs text-slate-300">
                      <div className="font-mono">{domain.verification_record}</div>
                      <div className="mt-1 break-all font-mono text-slate-400">{domain.verification_token}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => copy(`${domain.verification_record} TXT ${domain.verification_token}`)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white transition hover:bg-white/10">
                        <Copy size={14} />
                        Copy TXT
                      </button>
                      {canManage && (
                        <button type="button" onClick={() => verifyDomain(domain)} disabled={domainSaving} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-60">
                          <ShieldCheck size={14} />
                          Verify
                        </button>
                      )}
                      {domain.verification_status === 'verified' && <span className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-emerald-300"><Check size={14} /> Ready</span>}
                    </div>
                    {domain.verification_error && <div className="mt-3 text-xs font-semibold text-amber-300">{domain.verification_error}</div>}
                  </div>
                ))}
                {domains.length === 0 && <div className="rounded-xl border border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">No custom domains.</div>}
              </div>
            </section>
          </aside>
        </div>
      )}
    </DashboardLayout>
  );
}
