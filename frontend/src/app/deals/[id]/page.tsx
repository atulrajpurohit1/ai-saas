'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import NotesPanel from '@/components/NotesPanel';
import SalesAcceleratorPanel from '@/components/SalesAcceleratorPanel';
import api from '@/lib/api';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Loader2,
  Target,
  User,
} from 'lucide-react';

interface DealDetail {
  id: string;
  name: string;
  stage: string;
  createdAt: string;
  lead: {
    id: string;
    name: string;
    company: string;
    email?: string | null;
  };
  clientId: string | null;
  client?: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
}

export default function DealDetailsPage() {
  const params = useParams<{ id: string }>();
  const dealId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDeal = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(`deals/${dealId}`);
        setDeal(response.data);
      } catch (err) {
        console.error('Failed to load deal', err);
        setError('Could not load this deal.');
      } finally {
        setLoading(false);
      }
    };

    if (dealId) fetchDeal();
  }, [dealId]);

  const formatDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Not recorded';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to deals
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading deal details...
        </div>
      ) : error || !deal ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          {error || 'Deal not found.'}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-purple-300">
                  <Briefcase size={14} />
                  Deal Details
                </div>
                <h1 className="break-words text-2xl font-extrabold text-white sm:text-3xl">{deal.name}</h1>
                <p className="mt-2 flex items-center gap-2 text-slate-400">
                  <Target size={16} className="text-purple-300" />
                  {deal.lead.company}
                </p>
              </div>

              <span className="w-fit rounded-full border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-300">
                {deal.stage}
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <User size={14} />
                  Lead
                </div>
                <div className="text-sm font-semibold text-white">{deal.lead.name}</div>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <Building2 size={14} />
                  Client
                </div>
                <div className="text-sm font-semibold text-white">
                  {deal.client ? deal.client.name : 'No client linked'}
                </div>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <CalendarDays size={14} />
                  Created
                </div>
                <div className="text-sm font-semibold text-white">{formatDate(deal.createdAt)}</div>
              </div>
            </div>
          </section>

          <SalesAcceleratorPanel entityType="deal" entityId={deal.id} />

          <NotesPanel entityType="deal" entityId={deal.id} title="Deal Notes" />
        </div>
      )}
    </DashboardLayout>
  );
}
