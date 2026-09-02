'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatEnumLabel } from '@/lib/format';
import { getIncidentReviewQueue, Incident } from '@/lib/incidents';
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardCheck, FileWarning, MapPin, ShieldCheck } from 'lucide-react';

const severityTone: Record<string, 'neutral' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export default function IncidentReviewQueuePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await getIncidentReviewQueue();
      setIncidents(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the review queue.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to incidents
        </Link>
      </div>

      <PageHeader
        title="Incident Review Queue"
        description="Submitted and in-progress incident reports awaiting a decision."
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        {loading ? (
          <LoadingState label="Loading review queue..." />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={fetchQueue} />
          </div>
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to review"
            description="Incident reports awaiting a decision will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Site</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Guard</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Severity</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Submitted</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Title">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <FileWarning size={15} aria-hidden="true" />
                        {incident.title}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Site">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} aria-hidden="true" />
                        {incident.site.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Guard">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck size={14} aria-hidden="true" />
                        {incident.guard.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Severity">
                      <StatusBadge label={formatEnumLabel(incident.severity)} tone={severityTone[incident.severity] ?? 'neutral'} />
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-normal" data-label="Submitted">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} aria-hidden="true" />
                        {formatDate(incident.submittedAt || incident.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Status">
                      <StatusBadge status={incident.status} />
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/incidents/review/${incident.id}`}>
                          Review <ArrowRight size={14} />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
