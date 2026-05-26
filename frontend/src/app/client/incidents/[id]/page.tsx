'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileWarning,
  Loader2,
  MapPin,
} from 'lucide-react';

interface ClientIncidentDetail {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: 'approved';
  occurredAt: string;
  reviewedAt: string | null;
  attachmentUrl: string | null;
  site: {
    id: string;
    name: string;
    address: string;
  };
}

const severityClass: Record<string, string> = {
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

export default function ClientIncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [incident, setIncident] = useState<ClientIncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchIncident = async () => {
      if (!incidentId) return;

      setLoading(true);
      try {
        const res = await api.get(`client/incidents/${incidentId}`);
        setIncident(res.data);
        setError('');
      } catch (err) {
        console.error('Failed to fetch incident', err);
        setError('Could not load this incident report.');
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
    <ClientLayout>
      <div className="mb-6">
        <Link href="/client/incidents" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to incidents
        </Link>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading incident report...
        </div>
      ) : error || !incident ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error || 'Incident report not found.'}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${severityClass[incident.severity] || severityClass.low}`}>
                {incident.severity}
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
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
                <CalendarDays size={14} />
                Occurred
              </div>
              <div className="text-lg font-bold text-white">{formatDate(incident.occurredAt)}</div>
            </div>

            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} />
                Approved
              </div>
              <div className="text-lg font-bold text-white">
                {incident.reviewedAt ? formatDate(incident.reviewedAt) : 'Approved'}
              </div>
            </div>
          </section>

          {incident.attachmentUrl && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Attachment</h2>
              <a
                href={incident.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-indigo-200 transition hover:bg-white/10"
              >
                Open attachment <ExternalLink size={16} />
              </a>
            </section>
          )}
        </div>
      )}
    </ClientLayout>
  );
}
