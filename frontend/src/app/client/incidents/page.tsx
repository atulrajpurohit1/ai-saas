'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { AlertTriangle, ArrowRight, CalendarDays, FileWarning, Loader2, MapPin, Search } from 'lucide-react';

interface ClientIncident {
  id: string;
  title: string;
  severity: string;
  status: 'approved';
  occurredAt: string;
  site: {
    id: string;
    name: string;
  };
}

const severityClass: Record<string, string> = {
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

export default function ClientIncidentsPage() {
  const [incidents, setIncidents] = useState<ClientIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await api.get('client/incidents');
        setIncidents(Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch (err) {
        console.error('Failed to fetch incidents', err);
        setError('Could not load incident reports. Please refresh or sign in again.');
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const filteredIncidents = incidents.filter((incident) => (
    incident.title.toLowerCase().includes(search.toLowerCase()) ||
    incident.site.name.toLowerCase().includes(search.toLowerCase())
  ));

  const formatDate = (value: string) => new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ClientLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <FileWarning className="text-amber-300" size={28} />
            Incidents
          </h2>
          <p className="mt-2 text-slate-400 font-medium">Approved reports for your linked sites.</p>
        </div>
      </div>

      <div className="glass-card mb-8 overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0a14]/60">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search incidents..."
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
              <p>Loading incident reports...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-16 text-rose-300">
              <AlertTriangle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <FileWarning className="mx-auto mb-4 opacity-20" size={48} />
              <p>{search ? 'No incident reports match your search.' : 'No approved incident reports are available.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredIncidents.map((incident) => (
                <article
                  key={incident.id}
                  className="group rounded-3xl border border-white/5 bg-white/5 p-5 transition-all hover:border-indigo-500/30 hover:bg-white/10 sm:p-6"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300 transition-transform group-hover:scale-105">
                      <FileWarning size={24} />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${severityClass[incident.severity] || severityClass.low}`}>
                      {incident.severity}
                    </span>
                  </div>

                  <h3 className="mb-3 break-words text-lg font-bold text-white">{incident.title}</h3>
                  <div className="mb-3 flex items-start gap-2 text-sm text-slate-400">
                    <MapPin className="mt-0.5 shrink-0 text-indigo-400" size={16} />
                    <span>{incident.site.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <CalendarDays size={14} />
                    <span>{formatDate(incident.occurredAt)}</span>
                  </div>

                  <div className="mt-6 border-t border-white/5 pt-4">
                    <Link
                      href={`/client/incidents/${incident.id}`}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-indigo-600 hover:text-white sm:w-auto"
                    >
                      View Details <ArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
