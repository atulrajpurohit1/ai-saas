'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  createRateCard,
  deactivateRateCard,
  getRateCards,
  RateCard,
  RateCardStatus,
} from '@/lib/rate-cards';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Plus,
  Power,
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

type StatusFilter = RateCardStatus | 'all';

const statusClass: Record<string, string> = {
  active: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  inactive: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

function localDateInputValue(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return 'Open ended';
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

export default function RateCardsPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    client_id: '',
    site_id: '',
    role_name: '',
    hourly_rate: '',
    overtime_rate: '',
    holiday_rate: '',
    effective_from: localDateInputValue(),
    effective_to: '',
  });

  const clientSites = useMemo(
    () => sites.filter((site) => getSiteClientId(site) === formData.client_id),
    [formData.client_id, sites],
  );

  const fetchData = async (filter: StatusFilter) => {
    setLoading(true);
    try {
      const [rateData, clientRes, siteRes] = await Promise.all([
        getRateCards(filter === 'all' ? undefined : filter),
        api.get<ClientOption[]>('clients'),
        api.get<SiteOption[]>('sites'),
      ]);
      setRateCards(Array.isArray(rateData) ? rateData : []);
      setClients(Array.isArray(clientRes.data) ? clientRes.data : []);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load rate cards.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    if (!formData.client_id && clients.length > 0) {
      setFormData((current) => ({ ...current, client_id: clients[0].id }));
    }
  }, [clients, formData.client_id]);

  useEffect(() => {
    setFormData((current) => {
      const stillValid = clientSites.some((site) => site.id === current.site_id);
      return stillValid ? current : { ...current, site_id: '' };
    });
  }, [clientSites]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const created = await createRateCard({
        client_id: formData.client_id,
        site_id: formData.site_id || null,
        role_name: formData.role_name.trim() || undefined,
        hourly_rate: Number(formData.hourly_rate),
        overtime_rate: formData.overtime_rate ? Number(formData.overtime_rate) : undefined,
        holiday_rate: formData.holiday_rate ? Number(formData.holiday_rate) : undefined,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || undefined,
        status: 'active',
      });
      setRateCards((current) => [created, ...current]);
      setFormData((current) => ({
        ...current,
        site_id: '',
        role_name: '',
        hourly_rate: '',
        overtime_rate: '',
        holiday_rate: '',
        effective_from: localDateInputValue(),
        effective_to: '',
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create rate card.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActionId(id);
    setError('');

    try {
      const updated = await deactivateRateCard(id);
      setRateCards((current) => {
        const next = current.map((rateCard) => (rateCard.id === id ? updated : rateCard));
        return statusFilter === 'active' ? next.filter((rateCard) => rateCard.id !== id) : next;
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not deactivate rate card.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BadgeDollarSign className="text-indigo-300" size={28} />
            Rate Cards
          </h2>
          <p className="mt-2 text-muted-foreground">Manage contract billing rates for clients and sites.</p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 xl:grid-cols-[1fr_1fr_120px_120px_120px_150px_150px_auto]"
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Client</label>
          <select
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.client_id}
            onChange={(event) => setFormData({ ...formData, client_id: event.target.value, site_id: '' })}
            required
          >
            {clients.length === 0 ? (
              <option value="" className="bg-[#0e0e1a] text-white">Create a client first</option>
            ) : (
              clients.map((client) => (
                <option key={client.id} value={client.id} className="bg-[#0e0e1a] text-white">
                  {client.companyName || client.name}
                </option>
              ))
            )}
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
          <label className="text-sm font-semibold text-slate-300">Hourly</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.hourly_rate}
            onChange={(event) => setFormData({ ...formData, hourly_rate: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Overtime</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.overtime_rate}
            onChange={(event) => setFormData({ ...formData, overtime_rate: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Holiday</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.holiday_rate}
            onChange={(event) => setFormData({ ...formData, holiday_rate: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">From</label>
          <input
            type="date"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.effective_from}
            onChange={(event) => setFormData({ ...formData, effective_from: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">To</label>
          <input
            type="date"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.effective_to}
            onChange={(event) => setFormData({ ...formData, effective_to: event.target.value })}
          />
        </div>

        <button
          type="submit"
          disabled={saving || clients.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />}
          Create
        </button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {(['active', 'inactive', 'all'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              statusFilter === status
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
            }`}
          >
            {status === 'active' ? <CheckCircle2 size={15} /> : <Power size={15} />}
            {status[0].toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading rate cards...
          </div>
        ) : rateCards.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No rate cards found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Client/Site</th>
                  <th className="px-6 py-4 font-semibold">Rates</th>
                  <th className="px-6 py-4 font-semibold">Effective</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rateCards.map((rateCard) => (
                  <tr key={rateCard.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Client/Site">
                      <div className="font-semibold text-white">{rateCard.client?.companyName || rateCard.client?.name || 'Client'}</div>
                      <div className="mt-1 text-sm text-slate-500">{rateCard.site?.name || 'Client-level rate'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Rates">
                      <div className="font-bold text-white">{formatMoney(rateCard.hourlyRate)}</div>
                      <div className="mt-1 text-slate-500">OT {formatMoney(rateCard.overtimeRate)} | Holiday {formatMoney(rateCard.holidayRate)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Effective">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-indigo-300" />
                        {formatDate(rateCard.effectiveFrom)}
                      </div>
                      <div className="mt-1 text-slate-500">to {formatDate(rateCard.effectiveTo)}</div>
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[rateCard.status] || statusClass.inactive}`}>
                        {rateCard.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/rate-cards/${rateCard.id}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                        >
                          Edit <ArrowRight size={14} />
                        </Link>
                        {rateCard.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(rateCard.id)}
                            disabled={actionId === rateCard.id}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            {actionId === rateCard.id ? <Loader2 className="animate-spin" size={14} /> : <Power size={14} />}
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
