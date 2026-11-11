'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import IncidentMap from '@/components/IncidentMap';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatEnumLabel, formatDateTime as fmtDateTime } from '@/lib/format';
import { getAdminIncidents, Incident, IncidentSeverity } from '@/lib/incidents';
import { Checkpoint, getCheckpoints } from '@/lib/patrols';
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileWarning,
  List,
  Map as MapIcon,
  MapPin,
  Navigation,
  ShieldCheck,
} from 'lucide-react';

const severityTone: Record<string, 'neutral' | 'warning' | 'error'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const SEVERITY_OPTIONS: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

// A date input gives a local YYYY-MM-DD. Comparing on that string against the
// incident's own local date keeps the range inclusive of both end days
// without dragging timezone maths into every row.
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [siteFilter, setSiteFilter] = useState('');
  const [guardFilter, setGuardFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      // Checkpoints come along so the map can place each incident at its
      // site's location; a failure to load them must not block the list.
      const [data, cps] = await Promise.all([
        getAdminIncidents(selectedBranchId),
        getCheckpoints().catch(() => [] as Checkpoint[]),
      ]);
      setIncidents(Array.isArray(data) ? data : []);
      setCheckpoints(cps);
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

  // Filter dropdowns offer only the sites and guards that actually appear in
  // the loaded incidents, the way SilverTracker scopes its Property / User
  // selectors to the data on hand.
  const siteOptions = useMemo(() => {
    const map = new Map<string, string>();
    incidents.forEach((i) => map.set(i.site.id, i.site.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [incidents]);

  const guardOptions = useMemo(() => {
    const map = new Map<string, string>();
    incidents.forEach((i) => map.set(i.guard.id, i.guard.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [incidents]);

  const filteredIncidents = useMemo(
    () =>
      incidents.filter((i) => {
        if (siteFilter && i.site.id !== siteFilter) return false;
        if (guardFilter && i.guard.id !== guardFilter) return false;
        if (severityFilter && i.severity !== severityFilter) return false;
        const key = localDateKey(i.occurredAt);
        if (startDate && key < startDate) return false;
        if (endDate && key > endDate) return false;
        return true;
      }),
    [incidents, siteFilter, guardFilter, severityFilter, startDate, endDate],
  );

  const hasActiveFilters =
    !!siteFilter || !!guardFilter || !!severityFilter || !!startDate || !!endDate;

  const clearFilters = () => {
    setSiteFilter('');
    setGuardFilter('');
    setSeverityFilter('');
    setStartDate('');
    setEndDate('');
  };

  const showOnMap = (id: string) => {
    setViewMode('map');
    setFocusId(id);
    setFocusNonce((n) => n + 1);
  };

  const fieldClass =
    'rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <DashboardLayout requiredModule="GUARD_TOUR">
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
        {/* FILTER BAR */}
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="sm:max-w-xs">
              <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site</span>
              <select className={fieldClass} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                <option value="">All sites</option>
                {siteOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guard</span>
              <select className={fieldClass} value={guardFilter} onChange={(e) => setGuardFilter(e.target.value)}>
                <option value="">All guards</option>
                {guardOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Severity</span>
              <select
                className={fieldClass}
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="">All levels</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {formatEnumLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</span>
              <input type="date" className={fieldClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</span>
              <input type="date" className={fieldClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear filters
              </button>
            )}

            {/* List / Map switch, pushed to the end of the row. */}
            <div className="ml-auto flex items-center rounded-[var(--radius)] border border-border bg-muted p-1">
              {([
                { key: 'list' as const, label: 'List', icon: List },
                { key: 'map' as const, label: 'Map', icon: MapIcon },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  aria-pressed={viewMode === key}
                  className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-bold transition-colors ${
                    viewMode === key ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
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
        ) : viewMode === 'map' ? (
          <div className="p-4">
            <IncidentMap
              incidents={filteredIncidents}
              checkpoints={checkpoints}
              focusId={focusId}
              focusNonce={focusNonce}
              onIncidentClick={showOnMap}
            />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            title="No incidents match these filters"
            description="Adjust or clear the filters above to see more incidents."
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
                {filteredIncidents.map((incident) => (
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
                        {fmtDateTime(incident.occurredAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => showOnMap(incident.id)}
                          className="rounded-[var(--radius)] p-2 text-primary transition-colors hover:bg-muted"
                          title="Show on map"
                        >
                          <Navigation size={16} />
                        </button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/incidents/${incident.id}`}>
                            View <ArrowRight size={14} />
                          </Link>
                        </Button>
                      </div>
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
