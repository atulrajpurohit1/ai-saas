'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { ArrowRight, CalendarDays, Clock, MapPin, ShieldCheck } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';

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

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const { todayShifts, upcomingShifts } = useMemo(() => {
    const now = new Date();
    const isToday = (value: string) => {
      const date = new Date(value);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };
    return {
      todayShifts: shifts.filter((shift) => isToday(shift.startTime)),
      upcomingShifts: shifts
        .filter((shift) => new Date(shift.startTime) >= now && !isToday(shift.startTime))
        .slice(0, 5),
    };
  }, [shifts]);

  const formatTime = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <GuardLayout>
      {loading ? (
        <LoadingState label="Loading your dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDashboard} />
      ) : (
        <div className="space-y-8">
          <section className="surface-card p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2 text-eyebrow">
                  <ShieldCheck size={14} className="text-primary" />
                  Field operations
                </div>
                <h1 className="text-page-title">Welcome, {profile?.name || 'Guard'}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review your assigned shifts before reporting to site.
                </p>
              </div>
              <div className="shrink-0 rounded-[var(--radius)] border border-border bg-muted px-4 py-3">
                <div className="text-eyebrow">Availability</div>
                <div className="mt-1 text-sm font-bold capitalize text-success">
                  {profile?.availabilityStatus || 'available'}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-section-title">
                <CalendarDays className="text-primary" size={18} />
                Today
              </h2>
              <Link
                href="/guard/shifts"
                className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                All shifts <ArrowRight size={14} />
              </Link>
            </div>

            {todayShifts.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No shifts today" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {todayShifts.map((shift) => (
                  <Link
                    key={shift.id}
                    href={`/guard/shifts/${shift.id}`}
                    className="surface-card p-5 transition hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="font-semibold text-foreground">{shift.siteName}</div>
                    <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                      {shift.siteAddress}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Clock size={16} className="text-primary" />
                      {formatTime(shift.startTime)} to {formatTime(shift.endTime)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-section-title">Upcoming</h2>
            {upcomingShifts.length === 0 ? (
              <EmptyState icon={Clock} title="No upcoming assigned shifts" />
            ) : (
              <div className="space-y-3">
                {upcomingShifts.map((shift) => (
                  <Link
                    key={shift.id}
                    href={`/guard/shifts/${shift.id}`}
                    className="flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius)] border border-border bg-card p-4 transition hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{shift.siteName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{formatTime(shift.startTime)}</div>
                    </div>
                    <ArrowRight className="shrink-0 text-muted-foreground" size={18} />
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
