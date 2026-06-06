'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { branchParams, BranchSummary } from '@/lib/branches';
import {
  generateInvoice,
  getAdminInvoices,
  Invoice,
  issueInvoice,
  markInvoicePaid,
  cancelInvoice,
} from '@/lib/invoices';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Link2,
  Loader2,
  Receipt,
  Send,
  XCircle,
} from 'lucide-react';

interface ClientOption {
  id: string;
  name: string;
  companyName: string | null;
  branchId?: string | null;
  branch?: BranchSummary | null;
}

interface SiteOption {
  id: string;
  name: string;
  address: string;
  clientId?: string | null;
  client_id?: string | null;
  branchId?: string | null;
  branch?: BranchSummary | null;
  client?: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
}

const statusClass: Record<string, string> = {
  draft: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  issued: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  disputed: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  resolved: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  cancelled: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

function localDateInputValue(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function monthStartInputValue() {
  const now = new Date();
  return localDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function getSiteClientId(site: SiteOption) {
  return site.clientId || site.client_id || site.client?.id || '';
}

function formatRateSource(value: string) {
  if (value === 'site_rate_card') return 'Site rate card';
  if (value === 'client_rate_card') return 'Client rate card';
  return 'Manual';
}

export default function InvoicesPage() {
  const { can } = useAuth();
  const canGenerateInvoice = can('invoices.generate');
  const canIssueInvoice = can('invoices.issue');
  const canMarkInvoicePaid = can('invoices.mark_paid');
  const canCancelInvoice = can('invoices.cancel');
  const canExportInvoice = can('invoices.export');
  const canManageSites = can('sites.manage');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkingSite, setLinkingSite] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [linkSiteId, setLinkSiteId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [formData, setFormData] = useState({
    client_id: '',
    site_id: '',
    billing_start_date: monthStartInputValue(),
    billing_end_date: localDateInputValue(),
    allow_manual_rate: false,
    hourly_rate: '',
  });

  const selectedClientSites = useMemo(
    () => sites.filter((site) => getSiteClientId(site) === formData.client_id),
    [formData.client_id, sites],
  );

  const linkableSites = useMemo(
    () => sites.filter((site) => getSiteClientId(site) !== formData.client_id),
    [formData.client_id, sites],
  );

  const selectedClientName = useMemo(
    () => clients.find((client) => client.id === formData.client_id)?.companyName ||
      clients.find((client) => client.id === formData.client_id)?.name ||
      'selected client',
    [clients, formData.client_id],
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoiceData, clientRes, siteRes] = await Promise.all([
        getAdminInvoices(selectedBranchId),
        canGenerateInvoice
          ? api.get<ClientOption[]>('clients', { params: branchParams(selectedBranchId) })
          : Promise.resolve({ data: [] as ClientOption[] }),
        canGenerateInvoice
          ? api.get<SiteOption[]>('sites', { params: branchParams(selectedBranchId) })
          : Promise.resolve({ data: [] as SiteOption[] }),
      ]);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setClients(Array.isArray(clientRes.data) ? clientRes.data : []);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load invoices.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, canGenerateInvoice]);

  useEffect(() => {
    setFormData((current) => {
      if (clients.length === 0) return { ...current, client_id: '', site_id: '' };
      if (clients.some((client) => client.id === current.client_id)) return current;
      return { ...current, client_id: clients[0].id, site_id: '' };
    });
  }, [clients, formData.client_id]);

  useEffect(() => {
    setFormData((current) => {
      if (!current.client_id) return current;
      const clientSites = sites.filter((site) => getSiteClientId(site) === current.client_id);
      const selectedStillValid = clientSites.some((site) => site.id === current.site_id);
      return {
        ...current,
        site_id: selectedStillValid ? current.site_id : clientSites[0]?.id || '',
      };
    });
  }, [formData.client_id, sites]);

  useEffect(() => {
    setLinkSiteId((current) => {
      if (linkableSites.some((site) => site.id === current)) return current;
      return linkableSites[0]?.id || '';
    });
  }, [linkableSites]);

  const generateReady = Boolean(
    formData.client_id &&
    formData.site_id &&
    formData.billing_start_date &&
    formData.billing_end_date &&
    (!formData.allow_manual_rate || Number(formData.hourly_rate) > 0),
  );
  const shouldLinkTimesheets = error.includes('timesheet') || error.includes('billable hours');

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canGenerateInvoice) return;
    setSaving(true);
    setError('');

    try {
      const invoice = await generateInvoice({
        client_id: formData.client_id,
        site_id: formData.site_id || undefined,
        billing_start_date: formData.billing_start_date,
        billing_end_date: formData.billing_end_date,
        allow_manual_rate: formData.allow_manual_rate,
        hourly_rate: formData.allow_manual_rate ? Number(formData.hourly_rate) : undefined,
      });
      setInvoices((current) => [invoice, ...current.filter((item) => item.id !== invoice.id)]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate invoice.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLinkSite = async () => {
    if (!formData.client_id || !linkSiteId) return;
    if (!canManageSites) return;

    setLinkingSite(true);
    setError('');

    try {
      const response = await api.put<SiteOption>(`sites/${linkSiteId}`, {
        client_id: formData.client_id,
      });
      const updatedSite = response.data;

      setSites((current) => current.map((site) => (site.id === updatedSite.id ? updatedSite : site)));
      setFormData((current) => ({
        ...current,
        site_id: updatedSite.id,
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not link this site to the client.'));
    } finally {
      setLinkingSite(false);
    }
  };

  const updateInvoice = (updated: Invoice) => {
    setInvoices((current) => current.map((invoice) => (invoice.id === updated.id ? updated : invoice)));
  };

  const handleIssue = async (id: string) => {
    if (!canIssueInvoice) return;
    setActionId(id);
    setError('');

    try {
      updateInvoice(await issueInvoice(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not issue invoice.'));
    } finally {
      setActionId('');
    }
  };

  const handleMarkPaid = async (id: string) => {
    if (!canMarkInvoicePaid) return;
    setActionId(id);
    setError('');

    try {
      updateInvoice(await markInvoicePaid(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not mark invoice paid.'));
    } finally {
      setActionId('');
    }
  };

  const handleCancel = async (id: string) => {
    if (!canCancelInvoice) return;
    setActionId(id);
    setError('');

    try {
      updateInvoice(await cancelInvoice(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not cancel invoice.'));
    } finally {
      setActionId('');
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    if (!canExportInvoice) return;
    setActionId(invoice.id);
    setError('');

    try {
      const response = await api.get(`invoices/${invoice.id}/export-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download invoice PDF.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout requiredPermissions="invoices.view">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Receipt className="text-indigo-300" size={28} />
            Invoices
          </h2>
          <p className="mt-2 text-muted-foreground">Generate and issue client invoices from approved timesheets.</p>
        </div>
      </div>

      {canGenerateInvoice && (
        <form
          onSubmit={handleGenerate}
          className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 xl:grid-cols-[200px_1.1fr_1.1fr_150px_150px_170px_auto]"
        >
        <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Branch" />

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Client</label>
          <select
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.client_id}
            onChange={(event) => setFormData({ ...formData, client_id: event.target.value })}
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
            required
          >
            {selectedClientSites.length === 0 ? (
              <option value="" className="bg-[#0e0e1a] text-white">Link a site to this client</option>
            ) : (
              selectedClientSites.map((site) => (
                <option key={site.id} value={site.id} className="bg-[#0e0e1a] text-white">
                  {site.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Start</label>
          <input
            type="date"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.billing_start_date}
            onChange={(event) => setFormData({ ...formData, billing_start_date: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">End</label>
          <input
            type="date"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.billing_end_date}
            onChange={(event) => setFormData({ ...formData, billing_end_date: event.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={formData.allow_manual_rate}
              onChange={(event) => setFormData({ ...formData, allow_manual_rate: event.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Manual Rate
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Auto"
            value={formData.hourly_rate}
            onChange={(event) => setFormData({ ...formData, hourly_rate: event.target.value })}
            disabled={!formData.allow_manual_rate}
            required={formData.allow_manual_rate}
          />
        </div>

          <button
            type="submit"
            disabled={saving || !generateReady}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <DollarSign size={17} />}
            Generate
          </button>
        </form>
      )}

      {error && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
          {shouldLinkTimesheets && (
            <Link
              href="/timesheets"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-rose-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-rose-300"
            >
              Open Timesheets
            </Link>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No invoices generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Invoice</th>
                  <th className="px-6 py-4 font-semibold">Client/Site</th>
                  <th className="px-6 py-4 font-semibold">Branch</th>
                  <th className="px-6 py-4 font-semibold">Hours</th>
                  <th className="px-6 py-4 font-semibold">Rate</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Invoice">
                      <div className="font-semibold text-white">{invoice.invoiceNumber}</div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                        <CalendarDays size={14} className="text-indigo-300" />
                        {formatDate(invoice.billingStartDate)} - {formatDate(invoice.billingEndDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Client/Site">
                      <div>{invoice.client?.companyName || invoice.client?.name || 'Client'}</div>
                      <div className="mt-1 text-slate-500">{invoice.site?.name || 'Site'}</div>
                    </td>
                    <td className="px-6 py-4" data-label="Branch">
                      <BranchBadge branch={invoice.branch} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Hours">
                      {invoice.totalHours}h
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Rate">
                      <div className="font-bold text-white">{formatMoney(invoice.hourlyRate)}</div>
                      <div className="mt-1 text-slate-500">{formatRateSource(invoice.rateSource)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white" data-label="Total">
                      {formatMoney(invoice.totalAmount)}
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[invoice.status] || statusClass.draft}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                        >
                          View <ArrowRight size={14} />
                        </Link>
                        {canIssueInvoice && ['draft', 'resolved'].includes(invoice.status) && (
                          <button
                            type="button"
                            onClick={() => handleIssue(invoice.id)}
                            disabled={actionId === invoice.id}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
                          >
                            {actionId === invoice.id ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                            {invoice.status === 'resolved' ? 'Reissue' : 'Issue'}
                          </button>
                        )}
                        {canMarkInvoicePaid && ['issued', 'resolved'].includes(invoice.status) && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(invoice.id)}
                            disabled={actionId === invoice.id}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                          >
                            {actionId === invoice.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                            Paid
                          </button>
                        )}
                        {canCancelInvoice && !['paid', 'cancelled'].includes(invoice.status) && (
                          <button
                            type="button"
                            onClick={() => handleCancel(invoice.id)}
                            disabled={actionId === invoice.id}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-400 disabled:opacity-60"
                          >
                            {actionId === invoice.id ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                            Cancel
                          </button>
                        )}
                        {canExportInvoice && (
                          <button
                            type="button"
                            onClick={() => handleDownload(invoice)}
                            disabled={actionId === invoice.id}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            <Download size={14} />
                            PDF
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

      {canGenerateInvoice && clients.length > 0 && selectedClientSites.length === 0 && !loading && (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 shrink-0" size={18} />
            <div>
              <div className="font-semibold">No site is linked to {selectedClientName}.</div>
              <div className="mt-1 text-amber-100/80">Choose a site below, then generate the invoice once it appears in the Site field.</div>
            </div>
          </div>

          {canManageSites && linkableSites.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <select
                className="min-h-11 w-full rounded-xl border border-amber-300/20 bg-slate-950/40 px-4 text-white outline-none focus:ring-2 focus:ring-amber-300/40"
                value={linkSiteId}
                onChange={(event) => setLinkSiteId(event.target.value)}
              >
                {linkableSites.map((site) => (
                  <option key={site.id} value={site.id} className="bg-[#0e0e1a] text-white">
                    {site.name}{getSiteClientId(site) ? ' - currently linked elsewhere' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleLinkSite}
                disabled={linkingSite || !linkSiteId}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {linkingSite ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />}
                Link Site
              </button>
            </div>
          ) : canManageSites ? (
            <Link
              href="/sites"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
            >
              <ArrowRight size={16} />
              Create Site
            </Link>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}
