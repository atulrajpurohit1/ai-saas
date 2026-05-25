'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { AlertTriangle, ArrowRight, CalendarDays, Clock, MapPin, ShieldCheck } from 'lucide-react';

interface GuardProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  availabilityStatus: string;
}

interface GuardShift {
  id: string;
  siteName: string;
  siteAddress: string;
  startTime: string;
  endTime: string;
  status: string;
  assignmentStatus: string;
}

export default function GuardDashboardPage() {
  const [profile, setProfile] = useState<GuardProfile | null>(null);
  const [shifts, setShifts] = useState<GuardShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [profileRes, shiftsRes] = await Promise.all([
          api.get('guard/me'),
          api.get('guard/shifts'),
        ]);

        setProfile(profileRes.data);
        setShifts(Array.isArray(shiftsRes.data) ? shiftsRes.data : []);
        setError('');
      } catch (err) {
        console.error('Failed to load guard dashboard', err);
        setError('Could not load your guard dashboard. Please sign in again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const { todayShifts, upcomingShifts } = useMemo(() => {
    const now = new Date();
    const isToday = (value: string) => {
      const date = new Date(value);
      return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
    };

    return {
      todayShifts: shifts.filter((shift) => isToday(shift.startTime)),
      upcomingShifts: shifts.filter((shift) => new Date(shift.startTime) >= now && !isToday(shift.startTime)).slice(0, 5),
    };
  }, [shifts]);

  const formatTime = (value: string) => new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <GuardLayout>
      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading assigned shifts...</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-emerald-300">
                  <ShieldCheck size={16} />
                  Field operations
                </div>
                <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Welcome, {profile?.name || 'Guard'}</h1>
                <p className="mt-2 text-sm text-slate-400">Review your assigned shifts before reporting to site.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Availability</div>
                <div className="mt-1 text-sm font-bold capitalize text-emerald-300">{profile?.availabilityStatus || 'available'}</div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <CalendarDays className="text-emerald-300" size={20} />
                Today
              </h2>
              <Link href="/guard/shifts" className="flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                All shifts <ArrowRight size={14} />
              </Link>
            </div>

            {todayShifts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-slate-500">No assigned shifts today.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {todayShifts.map((shift) => (
                  <Link key={shift.id} href={`/guard/shifts/${shift.id}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-400/40 hover:bg-white/[0.07]">
                    <div className="font-bold text-white">{shift.siteName}</div>
                    <div className="mt-2 flex items-start gap-2 text-sm text-slate-400">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                      {shift.siteAddress}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                      <Clock size={16} className="text-emerald-300" />
                      {formatTime(shift.startTime)} to {formatTime(shift.endTime)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-bold text-white">Upcoming</h2>
            {upcomingShifts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-slate-500">No upcoming assigned shifts.</div>
            ) : (
              <div className="space-y-3">
                {upcomingShifts.map((shift) => (
                  <Link key={shift.id} href={`/guard/shifts/${shift.id}`} className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-400/40">
                    <div>
                      <div className="font-bold text-white">{shift.siteName}</div>
                      <div className="mt-1 text-sm text-slate-400">{formatTime(shift.startTime)}</div>
                    </div>
                    <ArrowRight className="text-slate-500" size={18} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </GuardLayout>
  );
}
