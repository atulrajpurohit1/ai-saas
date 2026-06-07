'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { addDomain, CustomDomain, getDomains, verifyDomain } from '@/lib/branding';
import { Globe, Loader2, Plus, RefreshCw } from 'lucide-react';

export default function DomainsSettingsPage() {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setDomains(await getDomains());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load domains.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    setSaving(true);
    setError('');
    try {
      await addDomain(domain);
      setDomain('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add domain.'));
    } finally {
      setSaving(false);
    }
  };

  const verify = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      const result = await verifyDomain(id);
      if (result.verification_error) setError(result.verification_error);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not verify domain.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="domains.view">
      <div className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Globe className="text-indigo-300" size={28} />
          Custom Domains
        </h2>
        <p className="mt-2 text-muted-foreground">Tenant domain verification and SSL status</p>
      </div>

      {error && <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">{error}</div>}

      <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="app.company.com" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
          <button type="button" onClick={add} disabled={saving || !domain.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
            Add Domain
          </button>
        </div>
      </section>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading domains...
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-white">{item.domain}</div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                    <span>Verification: {item.verification_status}</span>
                    <span>SSL: {item.ssl_status}</span>
                    <span className="md:col-span-2">TXT: {item.verification_record} = {item.verification_token}</span>
                  </div>
                </div>
                <button type="button" onClick={() => verify(item.id)} disabled={saving || item.verification_status === 'verified'} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50">
                  <RefreshCw size={16} />
                  Verify
                </button>
              </div>
            </div>
          ))}
          {domains.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">No custom domains configured.</div>}
        </div>
      )}
    </DashboardLayout>
  );
}
