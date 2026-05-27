'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  DailyServiceReport,
  generateDailyReport,
  getAdminReports,
  isDailyReportSummary,
  publishDailyReport,
} from '@/lib/reports';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  MapPin,
  Send,
} from 'lucide-react';

interface SiteOption {
  id: string;
  name: string;
  address: string;
  clientId?: string | null;
  client_id?: string | null;
  client?: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
}

const statusClass: Record<string, string> = {
  draft: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  published: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
};

function localDateInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not published';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSiteClientId(site: SiteOption) {
  return site.clientId || site.client_id || site.client?.id || '';
}

function getSiteClientName(site: SiteOption) {
  return site.client?.companyName || site.client?.name || 'Linked client';
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyServiceReport[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    site_id: '',
    report_date: localDateInputValue(),
  });

  const linkedSites = useMemo(() => sites.filter((site) => getSiteClientId(site)), [sites]);

  const fetchData = async () => {
    try {
      const [reportData, siteRes] = await Promise.all([
        getAdminReports(),
        api.get<SiteOption[]>('sites'),
      ]);
      setReports(Array.isArray(reportData) ? reportData : []);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load daily reports.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!formData.site_id && linkedSites.length > 0) {
      setFormData((current) => ({ ...current, site_id: linkedSites[0].id }));
    }
  }, [formData.site_id, linkedSites]);

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const report = await generateDailyReport(formData);
      setReports((current) => [report, ...current]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate the daily report.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    setActionId(id);
    setError('');

    try {
      const updated = await publishDailyReport(id);
      setReports((current) => current.map((report) => (report.id === id ? updated : report)));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not publish the report.'));
    } finally {
      setActionId('');
    }
  };

  const handleDownload = async (id: string) => {
    setActionId(id);
    setError('');

    try {
      const response = await api.get(`reports/${id}/export-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily-report-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download the report PDF.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileText className="text-indigo-300" size={28} />
            Daily Service Reports
          </h2>
          <p className="mt-2 text-muted-foreground">Generate daily client/site reports from shifts, attendance, and approved incidents.</p>
        </div>
      </div>

      <form
        onSubmit={handleGenerate}
        className="mb-8 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 lg:grid-cols-[1fr_220px_auto]"
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Site</label>
          <select
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.site_id}
            onChange={(event) => setFormData({ ...formData, site_id: event.target.value })}
            required
          >
            {linkedSites.length === 0 ? (
              <option value="" className="bg-[#0e0e1a] text-white">No linked sites available</option>
            ) : (
              linkedSites.map((site) => (
                <option key={site.id} value={site.id} className="bg-[#0e0e1a] text-white">
                  {site.name} - {getSiteClientName(site)}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Report Date</label>
          <input
            type="date"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={formData.report_date}
            onChange={(event) => setFormData({ ...formData, report_date: event.target.value })}
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving || linkedSites.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={17} /> : <CalendarDays size={17} />}
          Generate
        </button>
      </form>

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
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No daily reports generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Report</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Coverage</th>
                  <th className="px-6 py-4 font-semibold">Published</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reports.map((report) => {
                  const summary = report.summary;
                  const structuredSummary = isDailyReportSummary(summary) ? summary : null;

                  return (
                    <tr key={report.id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4" data-label="Report">
                        <div className="font-semibold text-white">{report.site?.name || 'Site report'}</div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                          <CalendarDays size={14} className="text-indigo-300" />
                          {formatDate(report.reportDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300" data-label="Client">
                        {report.client?.companyName || report.client?.name || 'Client'}
                      </td>
                      <td className="px-6 py-4" data-label="Status">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[report.status] || statusClass.draft}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300" data-label="Coverage">
                        {structuredSummary ? (
                          <div className="space-y-1">
                            <div>{structuredSummary.totals.shifts} shifts, {structuredSummary.totals.assignedGuards} guards</div>
                            <div className="text-slate-500">{structuredSummary.totals.approvedIncidents} approved incidents</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Summary available</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground" data-label="Published">
                        {formatDateTime(report.publishedAt)}
                      </td>
                      <td className="px-6 py-4 text-right" data-label="Actions">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/reports/${report.id}`}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            View <ArrowRight size={14} />
                          </Link>
                          {report.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handlePublish(report.id)}
                              disabled={actionId === report.id}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {actionId === report.id ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                              Publish
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownload(report.id)}
                            disabled={actionId === report.id}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                          >
                            <Download size={14} />
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {linkedSites.length === 0 && !loading && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 shrink-0" size={18} />
            <div>
              <div className="font-semibold">
                {sites.length === 0
                  ? 'Create a site and assign it to a client before generating daily service reports.'
                  : 'No sites are linked to a client yet.'}
              </div>
              {sites.length > 0 && (
                <div className="mt-1 text-amber-100/80">
                  Reports use client-linked sites. Open Sites, edit a site, choose a client, then save.
                </div>
              )}
            </div>
          </div>
          <Link
            href="/sites"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
          >
            Manage Sites <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </DashboardLayout>
  );
}
