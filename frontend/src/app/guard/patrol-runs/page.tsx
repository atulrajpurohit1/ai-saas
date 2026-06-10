'use client';

import React, { useEffect, useState } from 'react';
import GuardLayout from '@/components/GuardLayout';
import { getGuardPatrolRuns, PatrolRun } from '@/lib/patrols';
import { Navigation, Calendar, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function GuardPatrolRunsPage() {
  const [runs, setRuns] = useState<PatrolRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const data = await getGuardPatrolRuns();
        setRuns(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRuns();
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'in_progress':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';
      case 'missed':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-white/5 text-muted-foreground border border-white/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="text-emerald-400" size={18} />;
      case 'in_progress':
        return <AlertCircle className="text-amber-400" size={18} />;
      case 'missed':
        return <XCircle className="text-red-400" size={18} />;
      default:
        return <AlertCircle className="text-muted-foreground" size={18} />;
    }
  };

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diffMs = endTime - startTime;
    const diffMins = Math.round(diffMs / 60000);
    return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <GuardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl font-sf">Patrol Logs</h1>
        <p className="text-sm text-slate-400 mt-1">Review your historical patrol routes and scan statuses.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading patrol logs...</div>
      ) : runs.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-500">
          No patrol logs recorded.
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <div
              key={run.id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Navigation size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{run.patrolRoute?.name || 'Unknown Route'}</h3>
                  <span className="text-xs text-slate-400 block mt-0.5">{run.shift?.site.name || 'Unknown Site'}</span>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {run.startedAt ? new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                    <span className="bg-white/5 px-2 py-0.5 rounded-md text-[10px]">
                      Duration: {formatDuration(run.startedAt, run.completedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end border-t border-white/5 md:border-0 pt-3 md:pt-0">
                <span className="text-xs text-slate-500 md:hidden">STATUS</span>
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(run.status)}`}>
                  {getStatusIcon(run.status)}
                  <span>{run.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GuardLayout>
  );
}
