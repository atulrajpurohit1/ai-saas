'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { ArrowRight, CalendarDays, Clock, MapPin } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import { formatEnumLabel } from '@/lib/format';

interface GuardShift {
  id: string;
  siteName: string;
  siteAddress: string;
  startTime: string;
  endTime: string;
  status: string;
  assignmentStatus: string;
}

export default function GuardShiftsPage() {
  const [shifts, setShifts] = useState<GuardShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('guard/shifts');
      setShifts(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err) {
      console.error('Failed to load guard shifts', err);
      setError('Could not load assigned shifts. Please sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const formatTime = (value: string) =>
    new Date(value).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <GuardLayout>
      <PageHeader
        title="Assigned Shifts"
        description="Only shifts assigned to your guard profile are shown."
      />

      {loading ? (
        <LoadingState label="Loading shifts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchShifts} />
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No assigned shifts"
          description="Shifts assigned to you by your scheduler will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift) => (
            <article key={shift.id} className="surface-card p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center gap-2 text-eyebrow">
                    <CalendarDays size={14} className="text-primary" />
                    My status: {formatEnumLabel(shift.assignmentStatus)}
                  </div>
                  <h2 className="text-section-title">{shift.siteName}</h2>
                  <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    {shift.siteAddress}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      Start: {formatTime(shift.startTime)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      End: {formatTime(shift.endTime)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                  <div className="flex flex-col gap-1 sm:items-end">
                    <span className="text-eyebrow">Schedule</span>
                    <StatusBadge status={shift.status} />
                  </div>
                  <Link
                    href={`/guard/shifts/${shift.id}`}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
                  >
                    Details <ArrowRight size={16} />
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
