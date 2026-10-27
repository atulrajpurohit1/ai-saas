'use client';

import { formatDateTime as fmtDateTime } from '@/lib/format';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  acknowledgeEmergencyAlert,
  EmergencyAlert,
  EmergencyAlertStatus,
  getEmergencyAlerts,
  resolveEmergencyAlert,
} from '@/lib/emergency-alerts';
import { CalendarDays, MapPin, RefreshCw, ShieldCheck, Siren } from 'lucide-react';

// A dispatch screen should not need a manual refresh to notice a new panic
// alert, so it re-polls on a short interval while open.
const POLL_INTERVAL_MS = 15_000;

const STATUS_FILTERS: { label: string; value?: EmergencyAlertStatus }[] = [
  { label: 'All' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
  { label: 'Resolved', value: 'RESOLVED' },
];

const statusTone = {
  ACTIVE: 'error',
  ACKNOWLEDGED: 'warning',
  RESOLVED: 'success',
} as const;

export default function EmergencyAlertsPage() {
  const { can } = useAuth();
  const canReview = can('incidents.review');

  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<EmergencyAlertStatus | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAlerts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const data = await getEmergencyAlerts(filter);
        setAlerts(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        if (!opts?.silent) {
          setError(getApiErrorMessage(err, 'Could not load emergency alerts.'));
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(() => fetchAlerts({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const formatDate = (value: string) =>
    fmtDateTime(value);

  const handleAcknowledge = async (alert: EmergencyAlert) => {
    setBusyId(alert.id);
    try {
      await acknowledgeEmergencyAlert(alert.id);
      toast.success('Alert acknowledged — the guard is told help is on the way.');
      await fetchAlerts({ silent: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not acknowledge the alert.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (alert: EmergencyAlert) => {
    setBusyId(alert.id);
    try {
      await resolveEmergencyAlert(alert.id);
      toast.success('Alert resolved.');
      await fetchAlerts({ silent: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not resolve the alert.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout requiredModule="GUARD_TOUR">
      <PageHeader
        title="Emergency Alerts"
        description="Panic / duress alerts triggered by guards in the field. Acknowledge to tell the guard help is coming, then resolve once handled."
        actions={
          <Button variant="outline" onClick={() => fetchAlerts()}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <Button
              key={option.label}
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        {loading ? (
          <LoadingState label="Loading emergency alerts..." />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={fetchAlerts} />
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={Siren}
            title="No emergency alerts"
            description="When a guard triggers a panic/duress alert, it will appear here and the admins will be emailed."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Guard</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Location</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Triggered</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Guard">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <ShieldCheck size={14} aria-hidden="true" />
                        {alert.guard?.name ?? 'Unknown guard'}
                      </div>
                      {alert.guard?.phone && (
                        <div className="text-xs text-muted-foreground">{alert.guard.phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Location">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} aria-hidden="true" />
                        {alert.site?.name ?? alert.branch?.name ?? 'Unknown'}
                      </div>
                      {alert.location && (
                        <a
                          className="text-xs text-primary underline"
                          href={`https://www.google.com/maps/search/?api=1&query=${alert.location.latitude},${alert.location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View last position
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Status">
                      <StatusBadge label={alert.status} tone={statusTone[alert.status] ?? 'neutral'} />
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-normal" data-label="Triggered">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} aria-hidden="true" />
                        {formatDate(alert.triggeredAt)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                      {canReview && alert.status !== 'RESOLVED' ? (
                        <div className="flex justify-end gap-2">
                          {alert.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === alert.id}
                              onClick={() => handleAcknowledge(alert)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={busyId === alert.id}
                            onClick={() => handleResolve(alert)}
                          >
                            Resolve
                          </Button>
                        </div>
                      ) : null}
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
