'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { DailyServiceReport, getClientReports, isDailyReportSummary } from '@/lib/reports';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ClientReportsPage() {
  const [reports, setReports] = useState<DailyServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await getClientReports();
        setReports(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load daily reports.'));
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    const normalized = search.toLowerCase();
    return reports.filter((report) => {
      const siteName = report.site?.name || 'Daily service report';
      return siteName.toLowerCase().includes(normalized);
    });
  }, [reports, search]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    setError('');

    try {
      const response = await api.get(`client/reports/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily-report-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download this report.'));
    } finally {
      setDownloadingId('');
    }
  };

  return (
    <ClientLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <FileText className="text-indigo-300" size={28} />
            Daily Reports
          </h2>
          <p className="mt-2 font-medium text-slate-400">Published service reports for your linked sites.</p>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0a14]/60">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search reports..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white transition-all placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
              <p>Loading daily reports...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-16 text-rose-300">
              <AlertTriangle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <FileText className="mx-auto mb-4 opacity-20" size={48} />
              <p>{search ? 'No reports match your search.' : 'No published daily reports are available.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredReports.map((report) => {
                const summary = report.summary;
                const structuredSummary = isDailyReportSummary(summary) ? summary : null;

                return (
                  <article
                    key={report.id}
                    className="group rounded-3xl border border-white/5 bg-white/5 p-5 transition-all hover:border-indigo-500/30 hover:bg-white/10 sm:p-6"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300 transition-transform group-hover:scale-105">
                        <FileText size={24} />
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                        Published
                      </span>
                    </div>

                    <h3 className="mb-3 break-words text-lg font-bold text-white">
                      {report.site?.name || 'Daily service report'}
                    </h3>
                    <div className="mb-3 flex items-start gap-2 text-sm text-slate-400">
                      <MapPin className="mt-0.5 shrink-0 text-indigo-400" size={16} />
                      <span>{report.site?.address || 'Linked site'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                      <CalendarDays size={14} />
                      <span>{formatDate(report.reportDate)}</span>
                    </div>

                    {structuredSummary && (
                      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-black/10 p-3 text-center">
                        <div>
                          <div className="text-lg font-black text-white">{structuredSummary.totals.shifts}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Shifts</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-white">{structuredSummary.totals.totalWorkedHours}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hours</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-white">{structuredSummary.totals.approvedIncidents}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Incidents</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row">
                      <Link
                        href={`/client/reports/${report.id}`}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-indigo-600 hover:text-white"
                      >
                        View Details <ArrowRight size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDownload(report.id)}
                        disabled={downloadingId === report.id}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {downloadingId === report.id ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        PDF
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
