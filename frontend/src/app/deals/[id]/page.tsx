'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import NotesPanel from '@/components/NotesPanel';
import SalesAcceleratorPanel from '@/components/SalesAcceleratorPanel';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import api from '@/lib/api';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
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
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to deals
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading deal details..." />
        </div>
      ) : error || !deal ? (
        <ErrorState message={error || 'Deal not found.'} />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                  <Briefcase size={14} />
                  Deal Details
                </div>
                <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">{deal.name}</h1>
                <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <Target size={16} className="text-primary" />
                  {deal.lead.company}
                </p>
              </div>

              <StatusBadge label={deal.stage} tone="primary" className="w-fit px-4 py-2 text-xs" />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <User size={14} />
                  Lead
                </div>
                <div className="text-sm font-semibold text-foreground">{deal.lead.name}</div>
              </div>
              <div className="min-w-0 rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Building2 size={14} />
                  Client
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {deal.client ? deal.client.name : 'No client linked'}
                </div>
              </div>
              <div className="min-w-0 rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <CalendarDays size={14} />
                  Created
                </div>
                <div className="text-sm font-semibold text-foreground">{formatDate(deal.createdAt)}</div>
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
