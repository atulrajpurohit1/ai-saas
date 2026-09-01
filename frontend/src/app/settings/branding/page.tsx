'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatPhoneNumber, isValidPhoneNumber } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Check, Copy, Globe2, Loader2, Plus, Save, ShieldCheck } from 'lucide-react';

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

const fieldLabelClass = 'space-y-2 text-sm font-medium text-muted-foreground';
const fieldInputClass = 'min-h-11 w-full';

export default function BrandingSettingsPage() {
  const { can } = useAuth();
  const canManage = can('branding.manage');
  const [form, setForm] = useState<BrandingSnapshot>(defaultBranding);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoUploadError, setLogoUploadError] = useState('');

  const MAX_LOGO_FILE_BYTES = 300 * 1024;

  const handleLogoFile = (file: File | undefined) => {
    setLogoUploadError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      setLogoUploadError('Image is too large - please choose one under 300KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, logo_url: String(reader.result || '') }));
    };
    reader.onerror = () => setLogoUploadError('Could not read that file - please try again.');
    reader.readAsDataURL(file);
  };

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
    if (!isValidPhoneNumber(form.support_phone || '')) {
      toast.error('Enter a valid support phone number before saving.');
      return;
    }
    setSaving(true);
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
      toast.success('Branding updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save branding.'));
    } finally {
      setSaving(false);
    }
  };

  const addDomain = async () => {
    setDomainSaving(true);
    try {
      await addCustomDomain(domainInput.trim());
      setDomainInput('');
      setDomains(await getCustomDomains());
      toast.success('Domain added.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not add domain.'));
    } finally {
      setDomainSaving(false);
    }
  };

  const verifyDomain = async (domain: CustomDomain) => {
    setDomainSaving(true);
    try {
      const result = await verifyCustomDomain(domain.id);
      setDomains((current) => current.map((item) => (item.id === result.id ? result : item)));
      toast.success(result.verification_error || 'Domain verified.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not verify domain.'));
    } finally {
      setDomainSaving(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied.');
  };

  return (
    <DashboardLayout requiredPermissions="branding.view">
      <PageHeader
        title="Branding"
        description="Tenant identity, email/PDF styling, and custom domains."
        actions={
          canManage && (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </Button>
          )
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading branding..." />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className={fieldLabelClass}>
                Company Name
                <Input
                  value={form.company_name}
                  onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                  disabled={!canManage}
                  className={fieldInputClass}
                />
              </label>
              <label className={fieldLabelClass}>
                Support Email
                <Input
                  value={form.support_email || ''}
                  onChange={(event) => setForm({ ...form, support_email: event.target.value })}
                  disabled={!canManage}
                  className={fieldInputClass}
                />
              </label>
              <label className={fieldLabelClass}>
                Support Phone
                <Input
                  type="tel"
                  value={form.support_phone || ''}
                  onChange={(event) => setForm({ ...form, support_phone: event.target.value })}
                  onBlur={(event) => {
                    if (event.target.value.trim()) {
                      setForm((current) => ({ ...current, support_phone: formatPhoneNumber(event.target.value) }));
                    }
                  }}
                  disabled={!canManage}
                  placeholder="(555) 555-5555"
                  className={fieldInputClass}
                />
                {!isValidPhoneNumber(form.support_phone || '') && (
                  <span className="block text-xs font-medium text-error">Enter a valid phone number (7-15 digits).</span>
                )}
              </label>
              <label className={fieldLabelClass}>
                Logo URL
                <Input
                  value={form.logo_url || ''}
                  onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
                  disabled={!canManage}
                  className={fieldInputClass}
                />
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  or
                  <label className={cn('cursor-pointer font-semibold text-primary hover:text-primary-hover', !canManage && 'pointer-events-none opacity-60')}>
                    upload an image
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!canManage}
                      onChange={(event) => handleLogoFile(event.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                  (under 300KB)
                </span>
                {logoUploadError && <span className="block text-xs font-medium text-error">{logoUploadError}</span>}
              </label>
              <label className={fieldLabelClass}>
                Favicon URL
                <Input
                  value={form.favicon_url || ''}
                  onChange={(event) => setForm({ ...form, favicon_url: event.target.value })}
                  disabled={!canManage}
                  className={fieldInputClass}
                />
              </label>
              <label className={fieldLabelClass}>
                Login Background URL
                <Input
                  value={form.login_background || ''}
                  onChange={(event) => setForm({ ...form, login_background: event.target.value })}
                  disabled={!canManage}
                  className={fieldInputClass}
                />
              </label>
              <label className={fieldLabelClass}>
                Primary Color
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(event) => setForm({ ...form, primary_color: event.target.value })}
                  disabled={!canManage}
                  className="h-11 w-full rounded-lg border border-border bg-card px-2 disabled:opacity-60"
                />
              </label>
              <label className={fieldLabelClass}>
                Secondary Color
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={(event) => setForm({ ...form, secondary_color: event.target.value })}
                  disabled={!canManage}
                  className="h-11 w-full rounded-lg border border-border bg-card px-2 disabled:opacity-60"
                />
              </label>
              <label className={fieldLabelClass}>
                Accent Color
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={(event) => setForm({ ...form, accent_color: event.target.value })}
                  disabled={!canManage}
                  className="h-11 w-full rounded-lg border border-border bg-card px-2 disabled:opacity-60"
                />
              </label>
              <label className={cn(fieldLabelClass, 'lg:col-span-2')}>
                Welcome Message
                <textarea
                  value={form.welcome_message || ''}
                  onChange={(event) => setForm({ ...form, welcome_message: event.target.value })}
                  disabled={!canManage}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
                />
              </label>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="overflow-hidden rounded-2xl border" style={previewStyle}>
              <div className="p-6">
                <div className="mb-10 flex items-center gap-3">
                  {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logo_url} alt="" className="h-12 max-w-40 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-lg font-bold" style={{ color: '#fff' }}>
                      {(form.company_name || 'A').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold" style={{ color: '#fff' }}>
                      {form.company_name || 'AegisLead'}
                    </div>
                    <div className="truncate text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {form.support_email || 'support@example.com'}
                    </div>
                  </div>
                </div>
                <h3 className="max-w-xs text-3xl font-bold" style={{ color: '#fff' }}>
                  {form.welcome_message || 'Welcome back.'}
                </h3>
                <button type="button" className="mt-6 min-h-11 rounded-lg px-5 text-sm font-semibold" style={{ backgroundColor: form.accent_color, color: '#fff' }}>
                  Continue
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <Globe2 className="text-primary" size={20} />
                <h3 className="text-base font-semibold text-foreground">Custom Domains</h3>
              </div>
              {canManage && (
                <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={domainInput}
                    onChange={(event) => setDomainInput(event.target.value)}
                    placeholder="portal.example.com"
                    className="min-h-11"
                  />
                  <Button onClick={addDomain} disabled={domainSaving || !domainInput.trim()}>
                    {domainSaving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                    Add
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {domains.map((domain) => (
                  <div key={domain.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{domain.domain}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatDate(domain.verified_at)}</div>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
                          domain.verification_status === 'verified' ? 'bg-success-wash text-success' : 'bg-warning-wash text-warning',
                        )}
                      >
                        {domain.verification_status}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-foreground">
                      <div className="font-mono">{domain.verification_record}</div>
                      <div className="mt-1 break-all font-mono text-muted-foreground">{domain.verification_token}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copy(`${domain.verification_record} TXT ${domain.verification_token}`)}
                      >
                        <Copy size={14} />
                        Copy TXT
                      </Button>
                      {canManage && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => verifyDomain(domain)}
                          disabled={domainSaving}
                          className="border-success/20 bg-success-wash text-success hover:bg-success-wash hover:text-success"
                        >
                          <ShieldCheck size={14} />
                          Verify
                        </Button>
                      )}
                      {domain.verification_status === 'verified' && (
                        <span className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-success">
                          <Check size={14} /> Ready
                        </span>
                      )}
                    </div>
                    {domain.verification_error && <div className="mt-3 text-xs font-medium text-warning">{domain.verification_error}</div>}
                  </div>
                ))}
                {domains.length === 0 && <EmptyState icon={Globe2} title="No custom domains" description="Add a domain above to serve the portal from your own hostname." />}
              </div>
            </section>
          </aside>
        </div>
      )}
    </DashboardLayout>
  );
}
