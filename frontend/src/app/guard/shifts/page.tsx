'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { AlertTriangle, ArrowRight, CalendarDays, Clock, MapPin } from 'lucide-react';

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

  useEffect(() => {
    const fetchShifts = async () => {
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
    };

    fetchShifts();
  }, []);

  const formatTime = (value: string) => new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <GuardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Assigned Shifts</h1>
        <p className="mt-2 text-sm text-slate-400">Only shifts assigned to your guard profile are shown.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading shifts...</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">No assigned shifts found.</div>
      ) : (
        <div className="grid gap-4">
          {shifts.map((shift) => (
            <article key={shift.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
                    <CalendarDays size={14} />
                    {shift.assignmentStatus}
                  </div>
                  <h2 className="text-xl font-bold text-white">{shift.siteName}</h2>
                  <div className="mt-2 flex items-start gap-2 text-sm text-slate-400">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                    {shift.siteAddress}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-emerald-300" />
                      Start: {formatTime(shift.startTime)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-emerald-300" />
                      End: {formatTime(shift.endTime)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:items-end">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
                    {shift.status}
                  </span>
                  <Link href={`/guard/shifts/${shift.id}`} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400 sm:w-auto">
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
