'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { ArrowRight, CalendarDays, Clock, History, MapPin } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from '@/lib/format';

type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';

interface GuardShift {
  id: string;
  siteName: string;
  siteAddress: string;
  startTime: string;
  endTime: string;
  status: string;
  attendanceStatus?: AttendanceStatus;
}

// The guard only needs one word about a shift: their own attendance. The
// scheduler's staffing status ("assigned", "open") stays on the admin side.
const attendanceLabel = (status?: AttendanceStatus) => {
  if (status === 'checked_in') return 'Checked in';
  if (status === 'completed') return 'Completed';
  return 'Not started';
};

const attendanceTone = (status?: AttendanceStatus): 'info' | 'success' | 'neutral' => {
  if (status === 'checked_in') return 'info';
  if (status === 'completed') return 'success';
  return 'neutral';
};

export default function GuardShiftsPage() {
  const [shifts, setShifts] = useState<GuardShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showingHistory, setShowingHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchShifts = useCallback(async (history = false) => {
    if (history) {
      setLoadingHistory(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await api.get('guard/shifts', {
        params: history ? { history: '1' } : undefined,
      });
      setShifts(Array.isArray(response.data) ? response.data : []);
      setShowingHistory(history);
      setError('');
    } catch (err) {
      console.error('Failed to load guard shifts', err);
      setError('Could not load assigned shifts. Please sign in again.');
    } finally {
      setLoading(false);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const formatTime = (value: string) => fmtDateTime(value);

  // Today / Upcoming / Recent, so the shift the guard is here for is first
  // instead of buried in a flat list of everything they have ever worked.
  // "Today" means on duty at any point today, matching the dashboard: a
  // night shift that started yesterday evening is still today's shift.
  const { todayShifts, upcomingShifts, recentShifts } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const overlapsToday = (shift: GuardShift) =>
      new Date(shift.startTime) <= endOfToday && new Date(shift.endTime) >= startOfToday;

    return {
      todayShifts: shifts.filter(overlapsToday),
      upcomingShifts: shifts.filter((shift) => new Date(shift.startTime) > endOfToday),
      recentShifts: shifts.filter(
        (shift) => !overlapsToday(shift) && new Date(shift.startTime) <= endOfToday,
      ),
    };
  }, [shifts]);

  const renderShift = (shift: GuardShift, prominent = false) => (
    <article key={shift.id} className={prominent ? 'surface-card border-primary/30 p-5' : 'surface-card p-5'}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-eyebrow">
            <CalendarDays size={14} className="text-primary" />
            {fmtDate(shift.startTime)}
          </div>
          <h2 className={prominent ? 'text-page-title' : 'text-section-title'}>{shift.siteName}</h2>
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
            <span className="text-eyebrow">Attendance</span>
            <StatusBadge label={attendanceLabel(shift.attendanceStatus)} tone={attendanceTone(shift.attendanceStatus)} />
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
  );

  return (
    <GuardLayout>
      <PageHeader
        title="My Shifts"
        description="Only shifts assigned to your guard profile are shown."
      />

      {loading ? (
        <LoadingState label="Loading shifts…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchShifts(showingHistory)} />
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No assigned shifts"
          description="Shifts assigned to you by your scheduler will appear here."
          action={
            showingHistory ? undefined : (
              <button
                type="button"
                onClick={() => fetchShifts(true)}
                disabled={loadingHistory}
                className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {loadingHistory ? 'Loading…' : 'Show older shifts'}
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-section-title">Today</h2>
            {todayShifts.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No shifts today" />
            ) : (
              <div className="grid gap-4">{todayShifts.map((shift) => renderShift(shift, true))}</div>
            )}
          </section>

          {upcomingShifts.length > 0 && (
            <section>
              <h2 className="mb-4 text-section-title">Upcoming</h2>
              <div className="grid gap-4">{upcomingShifts.map((shift) => renderShift(shift))}</div>
            </section>
          )}

          {recentShifts.length > 0 && (
            <section>
              <h2 className="mb-4 text-section-title">{showingHistory ? 'Past shifts' : 'Recent'}</h2>
              <div className="grid gap-4">{recentShifts.map((shift) => renderShift(shift))}</div>
            </section>
          )}

          {!showingHistory && (
            <button
              type="button"
              onClick={() => fetchShifts(true)}
              disabled={loadingHistory}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              <History size={16} />
              {loadingHistory ? 'Loading…' : 'Show older shifts'}
            </button>
          )}
        </div>
      )}
    </GuardLayout>
  );
}
