'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import { getApiErrorMessage } from '@/lib/api-error';
import { getAdminIncidents, Incident } from '@/lib/incidents';
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardCheck, FileWarning, Loader2, MapPin, ShieldCheck } from 'lucide-react';

const severityClass: Record<string, string> = {
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

const statusClass: Record<string, string> = {
  submitted: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  under_review: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    const fetchIncidents = async () => {
      setLoading(true);
      try {
        const data = await getAdminIncidents(selectedBranchId);
        setIncidents(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load incidents.'));
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, [selectedBranchId]);

  const formatDate = (value: string) => new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileWarning className="text-amber-300" size={28} />
            Incidents
          </h2>
          <p className="text-muted-foreground">Track incident reports submitted by guards.</p>
        </div>
        <Link
          href="/incidents/review"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-400"
        >
          <ClipboardCheck size={17} />
          Review Queue
        </Link>
      </div>

      <div className="glass-card overflow-hidden rounded-3xl border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:max-w-xs sm:p-6">
          <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
        </div>
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading incidents...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-300">
            <AlertTriangle className="mx-auto mb-3" size={28} />
            {error}
          </div>
        ) : incidents.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No incidents reported yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold">Site</th>
                  <th className="px-6 py-4 font-semibold">Branch</th>
                  <th className="px-6 py-4 font-semibold">Guard</th>
                  <th className="px-6 py-4 font-semibold">Severity</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Occurred</th>
                  <th className="px-6 py-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Title">
                      <div className="font-semibold text-white">{incident.title}</div>
                    </td>
                    <td className="px-6 py-4" data-label="Site">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <MapPin size={14} className="text-indigo-300" />
                        {incident.site.name}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-label="Branch">
                      <BranchBadge branch={incident.branch} />
                    </td>
                    <td className="px-6 py-4" data-label="Guard">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <ShieldCheck size={14} className="text-emerald-300" />
                        {incident.guard.name}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-label="Severity">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${severityClass[incident.severity] || severityClass.low}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[incident.status] || statusClass.submitted}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground" data-label="Occurred">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-indigo-300" />
                        {formatDate(incident.occurredAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                      >
                        View <ArrowRight size={14} />
                      </Link>
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
