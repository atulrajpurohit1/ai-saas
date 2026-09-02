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
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatEnumLabel } from '@/lib/format';
import { getAdminIncidents, Incident } from '@/lib/incidents';
import { ArrowRight, CalendarDays, ClipboardCheck, FileWarning, MapPin, ShieldCheck } from 'lucide-react';

const severityTone: Record<string, 'neutral' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

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

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

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
      <PageHeader
        title="Incidents"
        description="Track incident reports submitted by guards."
        actions={
          <Button asChild variant="outline">
            <Link href="/incidents/review">
              <ClipboardCheck size={16} />
              Review Queue
            </Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:max-w-xs">
          <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
        </div>
        {loading ? (
          <LoadingState label="Loading incidents..." />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={fetchIncidents} />
          </div>
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            title="No incidents reported"
            description="Incident reports submitted by guards in the field will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Site</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Guard</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Severity</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Occurred</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Title">
                      <div className="font-semibold text-foreground">{incident.title}</div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Site">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} aria-hidden="true" />
                        {incident.site.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Branch">
                      <BranchBadge branch={incident.branch} />
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
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Status">
                      <StatusBadge status={incident.status} />
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-normal" data-label="Occurred">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} aria-hidden="true" />
                        {formatDate(incident.occurredAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/incidents/${incident.id}`}>
                          View <ArrowRight size={14} />
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
