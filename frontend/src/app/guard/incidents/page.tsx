'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { getGuardIncidents, Incident } from '@/lib/incidents';
import { ArrowRight, CalendarDays, FileWarning, MapPin } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';

const guardStatusLabel = (status: Incident['status']) =>
  status === 'under_review' ? 'submitted' : status;

export default function GuardIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGuardIncidents();
      setIncidents(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load incidents. Please sign in again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <GuardLayout>
      <PageHeader title="My Incidents" description="Reports submitted from your assigned shifts." />

      {loading ? (
        <LoadingState label="Loading incidents…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchIncidents} />
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={FileWarning}
          title="No incidents submitted yet"
          description="Incidents you report during a shift will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {incidents.map((incident) => (
            <article key={incident.id} className="surface-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1.5">
                    <StatusBadge status={guardStatusLabel(incident.status)} />
                  </div>
                  <h2 className="text-section-title">{incident.title}</h2>
                  <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    {incident.site.name}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays size={16} className="text-primary" />
                    {formatDate(incident.occurredAt)}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                  <StatusBadge status={incident.severity} />
                  <Link
                    href={`/guard/shifts/${incident.shiftId}`}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted sm:w-auto"
                  >
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
