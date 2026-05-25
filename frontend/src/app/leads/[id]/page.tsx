'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import NotesPanel from '@/components/NotesPanel';
import api from '@/lib/api';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Loader2,
  Mail,
  User,
} from 'lucide-react';

interface LeadDetail {
  id: string;
  name: string;
  email: string | null;
  company: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const leadId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLead = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get(`leads/${leadId}`);
        setLead(response.data);
      } catch (err) {
        console.error('Failed to load lead', err);
        setError('Could not load this lead.');
      } finally {
        setLoading(false);
      }
    };

    if (leadId) fetchLead();
  }, [leadId]);

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
          href="/leads"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to leads
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading lead details...
        </div>
      ) : error || !lead ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          {error || 'Lead not found.'}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-300">
                  Lead Details
                </div>
                <h1 className="break-words text-2xl font-extrabold text-white sm:text-3xl">{lead.name}</h1>
                <p className="mt-2 flex items-center gap-2 text-slate-400">
                  <Building2 size={16} className="text-indigo-300" />
                  {lead.company}
                </p>
              </div>

              <span className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
                {lead.status}
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <Mail size={14} />
                  Email
                </div>
                <div className="break-all text-sm font-semibold text-white">{lead.email || 'No email provided'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <CalendarDays size={14} />
                  Created
                </div>
                <div className="text-sm font-semibold text-white">{formatDate(lead.createdAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <User size={14} />
                  Contact
                </div>
                <div className="text-sm font-semibold text-white">{lead.name}</div>
              </div>
            </div>
          </section>

          <NotesPanel entityType="lead" entityId={lead.id} title="Lead Notes" />
        </div>
      )}
    </DashboardLayout>
  );
}
