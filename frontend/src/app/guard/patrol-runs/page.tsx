'use client';

import { formatDate as fmtDate } from '@/lib/format';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { getGuardPatrolRuns, PatrolRun } from '@/lib/patrols';
import { Navigation, Calendar, Clock, ArrowRight, LogIn, MapPin } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import StatusBadge from '@/components/StatusBadge';

interface GuardShift {
  id: string;
  siteName: string;
  startTime: string;
  endTime: string;
  attendanceStatus?: 'not_started' | 'checked_in' | 'completed';
}

export default function GuardPatrolRunsPage() {
  const [runs, setRuns] = useState<PatrolRun[]>([]);
  const [shifts, setShifts] = useState<GuardShift[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      // Shifts are fetched alongside the history so this tab can offer to
      // START a patrol. Tapping "Patrols" used to land the guard on a
      // history list with no way to begin one, which is the first thing
      // they try.
      const [runData, shiftRes] = await Promise.all([
        getGuardPatrolRuns(),
        api.get('guard/shifts').catch(() => ({ data: [] })),
      ]);
      setRuns(runData);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // The shift a patrol can be started from right now, else one the guard
  // still needs to check in to. Patrols are voluntary and only possible
  // while checked in, so this is the whole decision.
  const dutyPrompt = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const today = shifts.filter(
      (shift) =>
        new Date(shift.startTime) <= endOfToday && new Date(shift.endTime) >= startOfToday,
    );

    const onDuty = today.find((shift) => shift.attendanceStatus === 'checked_in');
    if (onDuty) return { kind: 'on_duty' as const, shift: onDuty };

    const notStarted = today.find((shift) => shift.attendanceStatus === 'not_started');
    if (notStarted) return { kind: 'needs_check_in' as const, shift: notStarted };

    return null;
  }, [shifts]);

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : new Date().getTime();
    const diffMins = Math.round((endTime - startTime) / 60000);
    return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <GuardLayout>
      <PageHeader title="Patrols" description="Start a patrol while you are on duty, and review the ones you have walked." />

      {!loading && dutyPrompt?.kind === 'on_duty' && (
        <Link
          href={`/guard/shifts/${dutyPrompt.shift.id}/patrols`}
          className="surface-card mb-6 flex items-center gap-4 border-primary/40 p-5 transition hover:border-primary"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary/10 text-primary">
            <Navigation size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-eyebrow">On duty</div>
            <h2 className="text-section-title">{dutyPrompt.shift.siteName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start a patrol</p>
          </div>
          <ArrowRight className="shrink-0 text-primary" size={20} />
        </Link>
      )}

      {!loading && dutyPrompt?.kind === 'needs_check_in' && (
        <Link
          href={`/guard/shifts/${dutyPrompt.shift.id}`}
          className="surface-card mb-6 flex items-center gap-4 p-5 transition hover:border-primary/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-muted text-muted-foreground">
            <LogIn size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-eyebrow">Not checked in</div>
            <h2 className="text-section-title">{dutyPrompt.shift.siteName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Check in to start patrolling</p>
          </div>
          <ArrowRight className="shrink-0 text-muted-foreground" size={20} />
        </Link>
      )}

      {!loading && !dutyPrompt && (
        <div className="surface-card mb-6 flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-muted text-muted-foreground">
            <MapPin size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-section-title">No shift today</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A patrol is walked during a shift. Your next one will show here.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading patrol logs…" />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Navigation}
          title="No patrols yet"
          description="Patrols you walk will be listed here once you start one."
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-section-title">Previous patrols</h2>
          {runs.map((run) => (
            <div
              key={run.id}
              className="surface-card flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary/10 text-primary">
                  <Navigation size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-card-title">{run.patrolRoute?.name || 'Unknown Route'}</h3>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {run.shift?.site.name || 'Unknown Site'}
                  </span>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {run.startedAt ? fmtDate(run.startedAt) : 'N/A'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'N/A'}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px]">
                      Duration: {formatDuration(run.startedAt, run.completedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full items-center justify-between border-t border-border pt-3 md:w-auto md:justify-end md:border-0 md:pt-0">
                <span className="text-eyebrow md:hidden">Status</span>
                <StatusBadge status={run.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </GuardLayout>
  );
}
