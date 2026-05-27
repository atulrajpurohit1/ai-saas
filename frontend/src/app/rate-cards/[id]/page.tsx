'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { deactivateRateCard, getRateCard, RateCard, updateRateCard } from '@/lib/rate-cards';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  Loader2,
  Power,
  Save,
} from 'lucide-react';

interface ClientOption {
  id: string;
  name: string;
  companyName: string | null;
}

interface SiteOption {
  id: string;
  name: string;
  clientId?: string | null;
  client_id?: string | null;
  client?: { id: string } | null;
}

const statusClass: Record<string, string> = {
  active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  inactive: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

function toDateInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function getSiteClientId(site: SiteOption) {
  return site.clientId || site.client_id || site.client?.id || '';
}

export default function RateCardDetailPage() {
  const params = useParams<{ id: string }>();
  const rateCardId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [rateCard, setRateCard] = useState<RateCard | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    client_id: '',
    site_id: '',
    role_name: '',
    hourly_rate: '',
    overtime_rate: '',
    holiday_rate: '',
    effective_from: '',
    effective_to: '',
    status: 'active',
  });

  const clientSites = useMemo(
    () => sites.filter((site) => getSiteClientId(site) === formData.client_id),
    [formData.client_id, sites],
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!rateCardId) return;

      setLoading(true);
      try {
        const [rateData, clientRes, siteRes] = await Promise.all([
          getRateCard(rateCardId),
          api.get<ClientOption[]>('clients'),
          api.get<SiteOption[]>('sites'),
        ]);
        setRateCard(rateData);
        setClients(Array.isArray(clientRes.data) ? clientRes.data : []);
        setSites(Array.isArray(siteRes.data) ? siteRes.data : []);
        setFormData({
          client_id: rateData.clientId,
          site_id: rateData.siteId || '',
          role_name: rateData.roleName || '',
          hourly_rate: String(rateData.hourlyRate),
          overtime_rate: rateData.overtimeRate ? String(rateData.overtimeRate) : '',
          holiday_rate: rateData.holidayRate ? String(rateData.holidayRate) : '',
          effective_from: toDateInputValue(rateData.effectiveFrom),
          effective_to: toDateInputValue(rateData.effectiveTo),
          status: rateData.status,
        });
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this rate card.'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [rateCardId]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rateCard) return;

    setWorking(true);
    setError('');

    try {
      const updated = await updateRateCard(rateCard.id, {
        client_id: formData.client_id,
        site_id: formData.site_id || null,
        role_name: formData.role_name.trim() || undefined,
        hourly_rate: Number(formData.hourly_rate),
        overtime_rate: formData.overtime_rate ? Number(formData.overtime_rate) : undefined,
        holiday_rate: formData.holiday_rate ? Number(formData.holiday_rate) : undefined,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || undefined,
        status: formData.status as 'active' | 'inactive',
      });
      setRateCard(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save rate card.'));
    } finally {
      setWorking(false);
    }
  };

  const handleDeactivate = async () => {
    if (!rateCard) return;

    setWorking(true);
    setError('');

    try {
      const updated = await deactivateRateCard(rateCard.id);
      setRateCard(updated);
      setFormData((current) => ({ ...current, status: updated.status }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not deactivate rate card.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/rate-cards" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to rate cards
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading rate card...
        </div>
      ) : error || !rateCard ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error || 'Rate card not found.'}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[rateCard.status] || statusClass.inactive}`}>
                {rateCard.status}
              </span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
                {formatMoney(rateCard.hourlyRate)}
              </span>
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                  <BadgeDollarSign className="mt-0.5 shrink-0 text-indigo-300" size={30} />
                  {rateCard.client?.companyName || rateCard.client?.name || 'Client rate card'}
                </h1>
                <p className="mt-3 text-slate-400">{rateCard.site?.name || 'Client-level rate'}</p>
              </div>
              {rateCard.status === 'active' && (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={working}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {working ? <Loader2 className="animate-spin" size={16} /> : <Power size={16} />}
                  Deactivate
                </button>
              )}
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Client</label>
                <select
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={formData.client_id}
                  onChange={(event) => setFormData({ ...formData, client_id: event.target.value, site_id: '' })}
                  required
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id} className="bg-[#0e0e1a] text-white">
                      {client.companyName || client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Site</label>
                <select
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={formData.site_id}
                  onChange={(event) => setFormData({ ...formData, site_id: event.target.value })}
                >
                  <option value="" className="bg-[#0e0e1a] text-white">Client-level rate</option>
                  {clientSites.map((site) => (
                    <option key={site.id} value={site.id} className="bg-[#0e0e1a] text-white">
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Role</label>
                <input
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={formData.role_name}
                  onChange={(event) => setFormData({ ...formData, role_name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Status</label>
                <select
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                >
                  <option value="active" className="bg-[#0e0e1a] text-white">Active</option>
                  <option value="inactive" className="bg-[#0e0e1a] text-white">Inactive</option>
                </select>
              </div>

              {[
                ['Hourly', 'hourly_rate', true],
                ['Overtime', 'overtime_rate', false],
                ['Holiday', 'holiday_rate', false],
              ].map(([label, key, required]) => (
                <div key={String(key)} className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">{label}</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={formData[key as 'hourly_rate']}
                    onChange={(event) => setFormData({ ...formData, [key as string]: event.target.value })}
                    required={Boolean(required)}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Effective From</label>
                <input
                  type="date"
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={formData.effective_from}
                  onChange={(event) => setFormData({ ...formData, effective_from: event.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Effective To</label>
                <input
                  type="date"
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={formData.effective_to}
                  onChange={(event) => setFormData({ ...formData, effective_to: event.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={working}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {working ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Rate Card
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
