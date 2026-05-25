'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { getGuardIncidents, Incident } from '@/lib/incidents';
import { AlertTriangle, ArrowRight, CalendarDays, FileWarning, Loader2, MapPin } from 'lucide-react';

const severityClass: Record<string, string> = {
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

export default function GuardIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const data = await getGuardIncidents();
        setIncidents(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load incidents. Please sign in again.'));
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const formatDate = (value: string) => new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <GuardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">My Incidents</h1>
        <p className="mt-2 text-sm text-slate-400">Reports submitted from your assigned shifts.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-20 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-emerald-300" size={26} />
          Loading incidents...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">
          No incidents submitted yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {incidents.map((incident) => (
            <article key={incident.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
                    <FileWarning size={14} />
                    {incident.status}
                  </div>
                  <h2 className="text-xl font-bold text-white">{incident.title}</h2>
                  <div className="mt-2 flex items-start gap-2 text-sm text-slate-400">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                    {incident.site.name}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                    <CalendarDays size={16} className="text-emerald-300" />
                    {formatDate(incident.occurredAt)}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:items-end">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${severityClass[incident.severity] || severityClass.low}`}>
                    {incident.severity}
                  </span>
                  <Link href={`/guard/shifts/${incident.shiftId}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/5 sm:w-auto">
                    Shift <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </GuardLayout>
  );
}
