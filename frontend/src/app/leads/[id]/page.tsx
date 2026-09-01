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
  Building2,
  CalendarDays,
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
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to leads
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading lead details..." />
        </div>
      ) : error || !lead ? (
        <ErrorState message={error || 'Lead not found.'} />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                  Lead Details
                </div>
                <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">{lead.name}</h1>
                <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <Building2 size={16} className="text-primary" />
                  {lead.company}
                </p>
              </div>

              <StatusBadge label={lead.status} tone="success" className="w-fit px-4 py-2 text-xs" />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Mail size={14} />
                  Email
                </div>
                <div className="break-all text-sm font-semibold text-foreground">{lead.email || 'No email provided'}</div>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <CalendarDays size={14} />
                  Created
                </div>
                <div className="text-sm font-semibold text-foreground">{formatDate(lead.createdAt)}</div>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <User size={14} />
                  Contact
                </div>
                <div className="text-sm font-semibold text-foreground">{lead.name}</div>
              </div>
            </div>
          </section>

          <SalesAcceleratorPanel entityType="lead" entityId={lead.id} />

          <NotesPanel entityType="lead" entityId={lead.id} title="Lead Notes" />
        </div>
      )}
    </DashboardLayout>
  );
}
