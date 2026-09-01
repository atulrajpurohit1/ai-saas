'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { ArrowRight, CalendarDays, FileWarning, MapPin, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';

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

export default function ClientIncidentsPage() {
  const [incidents, setIncidents] = useState<ClientIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = incidents.filter((incident) =>
    incident.title.toLowerCase().includes(search.toLowerCase()),
  );

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <ClientLayout>
      <PageHeader
        title="Incidents"
        description="Approved incident reports for your linked sites."
      />

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border bg-muted/50 p-4 sm:p-5">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search incidents…"
              className="w-full rounded-[var(--radius)] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <LoadingState label="Loading incident reports…" />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchIncidents} />
          ) : filteredIncidents.length === 0 ? (
            <EmptyState
              icon={FileWarning}
              title={search ? 'No matching incidents' : 'No approved incident reports'}
              description={
                search
                  ? 'Try a different search term.'
                  : 'Approved incident reports for your sites will appear here.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredIncidents.map((incident) => (
                <article
                  key={incident.id}
                  className="group flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-warning-wash text-warning">
                      <FileWarning size={22} />
                    </span>
                    <StatusBadge status={incident.severity} />
                  </div>

                  <h3 className="mb-3 break-words text-base font-bold text-foreground">{incident.title}</h3>
                  <div className="mb-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 shrink-0 text-primary" size={16} />
                    <span>{incident.site.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-eyebrow">
                    <CalendarDays size={13} />
                    {formatDate(incident.occurredAt)}
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <Link
                      href={`/client/incidents/${incident.id}`}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground sm:w-auto"
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
