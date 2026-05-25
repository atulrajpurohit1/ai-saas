'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { getAdminIncident, Incident } from '@/lib/incidents';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileWarning,
  Loader2,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

const severityClass: Record<string, string> = {
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

const statusClass: Record<string, string> = {
  submitted: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  reviewed: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchIncident = async () => {
      if (!incidentId) return;

      setLoading(true);
      try {
        const data = await getAdminIncident(incidentId);
        setIncident(data);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this incident.'));
      } finally {
        setLoading(false);
      }
    };

    fetchIncident();
  }, [incidentId]);

  const formatDate = (value: string) => new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/incidents" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to incidents
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading incident...
        </div>
      ) : error || !incident ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error || 'Incident not found.'}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${severityClass[incident.severity] || severityClass.low}`}>
                {incident.severity}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[incident.status] || statusClass.submitted}`}>
                {incident.status}
              </span>
            </div>

            <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
              <FileWarning className="mt-0.5 shrink-0 text-amber-300" size={30} />
              {incident.title}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{incident.description}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <MapPin size={14} />
                Site
              </div>
              <div className="text-lg font-bold text-white">{incident.site.name}</div>
              <div className="mt-1 text-sm text-slate-400">{incident.site.address}</div>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <ShieldCheck size={14} />
                Guard
              </div>
              <div className="text-lg font-bold text-white">{incident.guard.name}</div>
              <div className="mt-1 text-sm text-slate-400">{incident.guard.phone || incident.guard.email || 'No contact listed'}</div>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} />
                Occurred At
              </div>
              <div className="text-lg font-bold text-white">{formatDate(incident.occurredAt)}</div>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} />
                Shift
              </div>
              <div className="text-sm text-slate-300">{formatDate(incident.shift.startTime)}</div>
              <div className="mt-1 text-sm text-slate-400">to {formatDate(incident.shift.endTime)}</div>
            </div>
          </section>

          {incident.attachmentUrl && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Attachment</h2>
              <a
                href={incident.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-indigo-200 transition hover:bg-white/10"
              >
                Open attachment <ExternalLink size={16} />
              </a>
            </section>
          )}

          {incident.notes && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Notes</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{incident.notes}</p>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
