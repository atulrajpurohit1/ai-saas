'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { AlertTriangle, ArrowLeft, CalendarDays, Clock, MapPin, ShieldCheck } from 'lucide-react';

interface GuardShiftDetail {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  assignmentStatus: string;
  site: {
    id: string;
    name: string;
    address: string;
    instructions?: string;
  };
  assignedGuard: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
}

export default function GuardShiftDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [shift, setShift] = useState<GuardShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShift = async () => {
      if (!id) {
        setLoading(false);
        setError('Shift not found.');
        return;
      }

      try {
        const response = await api.get(`guard/shifts/${id}`);
        setShift(response.data);
        setError('');
      } catch (err) {
        console.error('Failed to load guard shift detail', err);
        setError('Could not open this shift. It may not be assigned to you.');
      } finally {
        setLoading(false);
      }
    };

    fetchShift();
  }, [id]);

  const formatTime = (value: string) => new Date(value).toLocaleString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <GuardLayout>
      <Link href="/guard/shifts" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white">
        <ArrowLeft size={16} />
        Back to shifts
      </Link>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Opening shift...</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : shift ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
                {shift.status}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-300">
                {shift.assignmentStatus}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white">{shift.site.name}</h1>
            <div className="mt-3 flex items-start gap-2 text-slate-400">
              <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <span>{shift.site.address}</span>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} />
                Start
              </div>
              <div className="text-lg font-bold text-white">{formatTime(shift.startTime)}</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <Clock size={14} />
                End
              </div>
              <div className="text-lg font-bold text-white">{formatTime(shift.endTime)}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Site Instructions</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {shift.site.instructions || 'No special instructions have been added for this site.'}
            </p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <ShieldCheck className="text-emerald-300" size={18} />
              Assigned Guard
            </h2>
            <div className="text-sm text-slate-300">{shift.assignedGuard.name}</div>
            <div className="mt-1 text-sm text-slate-500">{shift.assignedGuard.phone || shift.assignedGuard.email || 'No contact listed'}</div>
          </section>
        </div>
      ) : null}
    </GuardLayout>
  );
}
