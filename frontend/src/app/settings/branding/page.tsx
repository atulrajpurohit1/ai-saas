'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { getBranding, TenantBranding, updateBranding, useBranding } from '@/lib/branding';
import { ImageUp, Loader2, Palette, Save } from 'lucide-react';

type FormState = TenantBranding;

const emptyForm: FormState = {
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BrandingSettingsPage() {
  const { branding } = useBranding();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setForm({ ...emptyForm, ...(await getBranding()) });
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load branding.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setAsset = async (field: 'logo_url' | 'favicon_url' | 'login_background', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setForm((current) => ({ ...current, [field]: dataUrl }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const saved = await updateBranding({
        ...form,
        company_name: form.company_name || null,
        logo_url: form.logo_url || null,
        favicon_url: form.favicon_url || null,
        login_background: form.login_background || null,
        welcome_message: form.welcome_message || null,
        support_email: form.support_email || null,
        support_phone: form.support_phone || null,
      });
      setForm({ ...emptyForm, ...saved });
      setSuccess('Branding updated.');
      window.location.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save branding.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="branding.view">
      <div className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Palette className="text-indigo-300" size={28} />
          Branding
        </h2>
        <p className="mt-2 text-muted-foreground">Tenant white-label theme</p>
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}
      {success && <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{success}</div>}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading branding...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Company Name
                <input value={form.company_name || ''} onChange={(event) => setForm({ ...form, company_name: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Welcome Message
                <input value={form.welcome_message || ''} onChange={(event) => setForm({ ...form, welcome_message: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Support Email
                <input type="email" value={form.support_email || ''} onChange={(event) => setForm({ ...form, support_email: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-300">
                Support Phone
                <input value={form.support_phone || ''} onChange={(event) => setForm({ ...form, support_phone: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </label>
              {[
                ['primary_color', 'Primary Color'],
                ['secondary_color', 'Secondary Color'],
                ['accent_color', 'Accent Color'],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2 text-sm font-semibold text-slate-300">
                  {label}
                  <div className="flex gap-3">
                    <input type="color" value={String(form[field as keyof FormState] || '#6366f1')} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="h-11 w-16 rounded-xl border border-white/10 bg-white/5 p-1" />
                    <input value={String(form[field as keyof FormState] || '')} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ['logo_url', 'Logo'],
                ['favicon_url', 'Favicon'],
                ['login_background', 'Login Background'],
              ].map(([field, label]) => (
                <label key={field} className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-slate-950/20 p-4 text-center text-sm font-bold text-slate-300 transition hover:bg-white/[0.06]">
                  <ImageUp size={22} className="text-indigo-300" />
                  {label}
                  <input type="file" accept="image/*" onChange={(event) => setAsset(field as 'logo_url' | 'favicon_url' | 'login_background', event)} className="hidden" />
                </label>
              ))}
            </div>

            <button type="button" onClick={save} disabled={saving} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              Save Branding
            </button>
          </section>

          <aside className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Preview</div>
            <div
              className="overflow-hidden rounded-xl border border-white/10 bg-[#05050a]"
              style={{
                ['--primary' as string]: form.primary_color,
                ['--accent' as string]: form.accent_color,
                backgroundImage: form.login_background ? `linear-gradient(rgba(5,5,10,.7), rgba(5,5,10,.7)), url(${form.login_background})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="p-5">
                {form.logo_url ? <img src={form.logo_url} alt={form.company_name || branding.company_name} className="mb-4 max-h-14 max-w-44 object-contain" /> : <div className="mb-4 text-2xl font-black text-white">{form.company_name || branding.company_name}</div>}
                <div className="mb-2 text-lg font-bold text-white">{form.welcome_message || 'Welcome back'}</div>
                <div className="mb-5 text-sm text-slate-400">{form.support_email || 'support@company.com'}</div>
                <button type="button" className="w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-bold text-white">Sign In</button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </DashboardLayout>
  );
}
