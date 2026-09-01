'use client';

import React, { useCallback, useEffect, useState } from 'react';
import GuardLayout from '@/components/GuardLayout';
import { getGuardPatrolRuns, PatrolRun } from '@/lib/patrols';
import { Navigation, Calendar, Clock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import StatusBadge from '@/components/StatusBadge';

export default function GuardPatrolRunsPage() {
  const [runs, setRuns] = useState<PatrolRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGuardPatrolRuns();
      setRuns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : new Date().getTime();
    const diffMins = Math.round((endTime - startTime) / 60000);
    return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <GuardLayout>
      <PageHeader title="Patrol Logs" description="Your historical patrol routes and scan statuses." />

      {loading ? (
        <LoadingState label="Loading patrol logs…" />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Navigation}
          title="No patrol logs recorded"
          description="Completed and in-progress patrol runs will appear here."
        />
      ) : (
        <div className="space-y-4">
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
                      {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : 'N/A'}
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
