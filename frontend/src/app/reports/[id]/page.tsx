'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  DailyServiceReport,
  getAdminReport,
  isDailyReportSummary,
  publishDailyReport,
} from '@/lib/reports';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  draft: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  published: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
};

const attendanceClass: Record<string, string> = {
  completed: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  checked_in: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  not_started: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [report, setReport] = useState<DailyServiceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;

      setLoading(true);
      try {
        const data = await getAdminReport(reportId);
        setReport(data);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this report.'));
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  const handlePublish = async () => {
    if (!report) return;

    setWorking(true);
    setError('');

    try {
      const updated = await publishDailyReport(report.id);
      setReport(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not publish the report.'));
    } finally {
      setWorking(false);
    }
  };

  const handleDownload = async () => {
    if (!report) return;

    setWorking(true);
    setError('');

    try {
      const response = await api.get(`reports/${report.id}/export-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily-report-${report.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download the report PDF.'));
    } finally {
      setWorking(false);
    }
  };

  const summary = report?.summary;
  const structuredSummary = summary && isDailyReportSummary(summary) ? summary : null;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to reports
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading report...
        </div>
      ) : error || !report ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error || 'Report not found.'}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[report.status] || statusClass.draft}`}>
                {report.status}
              </span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
                {formatDateOnly(report.reportDate)}
              </span>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                  <FileText className="mt-0.5 shrink-0 text-indigo-300" size={30} />
                  Daily Service Report
                </h1>
                <p className="mt-3 text-slate-400">
                  {report.client?.companyName || report.client?.name || 'Client'} - {report.site?.name || 'Site'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {report.status === 'draft' && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={working}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {working ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Publish
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={working}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {structuredSummary && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Shifts</div>
                  <div className="mt-2 text-3xl font-black text-white">{structuredSummary.totals.shifts}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Assigned Guards</div>
                  <div className="mt-2 text-3xl font-black text-white">{structuredSummary.totals.assignedGuards}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Worked Hours</div>
                  <div className="mt-2 text-3xl font-black text-white">{structuredSummary.totals.totalWorkedHours}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Approved Incidents</div>
                  <div className="mt-2 text-3xl font-black text-white">{structuredSummary.totals.approvedIncidents}</div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <MapPin size={14} />
                    Site
                  </div>
                  <div className="text-lg font-bold text-white">{structuredSummary.site.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{structuredSummary.site.address}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <CalendarDays size={14} />
                    Publication
                  </div>
                  <div className="text-lg font-bold text-white">{formatDate(report.publishedAt)}</div>
                  <div className="mt-1 text-sm text-slate-400">Generated {formatDate(report.createdAt)}</div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <h2 className="mb-4 text-xl font-bold text-white">Shifts And Attendance</h2>
                {structuredSummary.shifts.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">No shifts were scheduled for this date.</div>
                ) : (
                  <div className="space-y-4">
                    {structuredSummary.shifts.map((shift) => (
                      <article key={shift.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="font-bold text-white">{formatDate(shift.startTime)} to {formatDate(shift.endTime)}</div>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{shift.status}</span>
                        </div>
                        {shift.assignedGuards.length === 0 ? (
                          <div className="text-sm text-slate-500">No assigned guards.</div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            {shift.assignedGuards.map((guard) => (
                              <div key={`${shift.id}-${guard.id}`} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 font-bold text-white">
                                      <ShieldCheck size={15} className="text-emerald-300" />
                                      {guard.name}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">{guard.email || guard.phone || 'No contact listed'}</div>
                                  </div>
                                  <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${attendanceClass[guard.attendanceStatus] || attendanceClass.not_started}`}>
                                    {guard.attendanceStatus}
                                  </span>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-400">
                                  <div>
                                    <div className="font-bold uppercase tracking-widest text-slate-600">In</div>
                                    <div className="mt-1">{formatDate(guard.checkInTime)}</div>
                                  </div>
                                  <div>
                                    <div className="font-bold uppercase tracking-widest text-slate-600">Out</div>
                                    <div className="mt-1">{formatDate(guard.checkOutTime)}</div>
                                  </div>
                                  <div>
                                    <div className="font-bold uppercase tracking-widest text-slate-600">Hours</div>
                                    <div className="mt-1">{guard.totalWorkedHours}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <h2 className="mb-4 text-xl font-bold text-white">Approved Incidents</h2>
                {structuredSummary.incidents.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">No approved incidents for this report date.</div>
                ) : (
                  <div className="space-y-4">
                    {structuredSummary.incidents.map((incident) => (
                      <article key={incident.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <h3 className="break-words text-lg font-bold text-white">{incident.title}</h3>
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                            {incident.severity}
                          </span>
                        </div>
                        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                          {formatDate(incident.occurredAt)} by {incident.guard.name}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{incident.description}</p>
                        {incident.attachmentUrl && (
                          <a
                            href={incident.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-indigo-200 transition hover:bg-white/10"
                          >
                            Open attachment <ExternalLink size={14} />
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {!structuredSummary && 'raw' in report.summary && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Summary</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{report.summary.raw}</p>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
