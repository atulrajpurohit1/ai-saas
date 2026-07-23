'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { deleteRfp, downloadRfpPdf, getRfp, Rfp } from '@/lib/rfp';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Download,
  FilePenLine,
  Loader2,
  MapPin,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';

const statusClass: Record<Rfp['status'], string> = {
  DRAFT: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
  GENERATED: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  FINALIZED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
};

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

export default function RfpViewPage() {
  const params = useParams<{ id: string }>();
  const rfpId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { can } = useAuth();
  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!rfpId) return;
    const fetchRfp = async () => {
      setLoading(true);
      try {
        const data = await getRfp(rfpId);
        setRfp(data);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this RFP.'));
      } finally {
        setLoading(false);
      }
    };
    fetchRfp();
  }, [rfpId]);

  const handleDownload = async () => {
    if (!rfp) return;
    setDownloading(true);
    try {
      await downloadRfpPdf(rfp.id, rfp.title);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!rfp || !confirm(`Delete "${rfp.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteRfp(rfp.id);
      router.push('/rfp');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete this RFP.'));
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="rfp.view">
      <div className="mb-6">
        <Link href="/rfp" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to RFPs
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading RFP...
        </div>
      ) : error && !rfp ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      ) : rfp ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-white sm:text-2xl">{rfp.title}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[rfp.status]}`}>
                  {rfp.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {rfp.clientName}
                {rfp.companyName ? ` — ${rfp.companyName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {can('rfp.update') && (
                <Link
                  href={`/rfp/${rfp.id}/edit`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <FilePenLine size={16} />
                  Edit
                </Link>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                Export PDF
              </button>
              {can('rfp.delete') && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  Delete
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-1">
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-indigo-400">Basic Information</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Building2 size={14} className="text-indigo-300" />
                    <span className="text-slate-500">Industry:</span> {rfp.industry || 'Not set'}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CalendarDays size={14} className="text-indigo-300" />
                    <span className="text-slate-500">Due:</span> {formatDate(rfp.dueDate)}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CalendarDays size={14} className="text-indigo-300" />
                    <span className="text-slate-500">Start → End:</span> {formatDate(rfp.startDate)} → {formatDate(rfp.endDate)}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-slate-500">Estimated Budget:</span> {formatMoney(rfp.estimatedBudget)}
                  </div>
                  {rfp.projectName && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-slate-500">Project:</span> {rfp.projectName}
                    </div>
                  )}
                </dl>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
                  <Shield size={14} />
                  Security Requirements
                </h3>
                {rfp.securityTypes.length === 0 ? (
                  <p className="text-sm text-slate-500">Not specified.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {rfp.securityTypes.map((type) => (
                      <span key={type} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
                  <MapPin size={14} />
                  Site Information
                </h3>
                <dl className="space-y-3 text-sm text-slate-300">
                  <div>
                    <span className="text-slate-500">Locations:</span> {rfp.numberOfLocations ?? 'Not set'}
                  </div>
                  <div>
                    <span className="text-slate-500">Address:</span> {rfp.address || 'Not set'}
                  </div>
                  <div>
                    <span className="text-slate-500">Operating Hours:</span> {rfp.operatingHours || 'Not set'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-indigo-300" />
                    <span className="text-slate-500">Guards Required:</span> {rfp.guardsRequired ?? 'Not set'}
                  </div>
                </dl>
              </section>

              {rfp.additionalRequirements && (
                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-indigo-400">Additional Requirements</h3>
                  <p className="whitespace-pre-wrap text-sm text-slate-300">{rfp.additionalRequirements}</p>
                </section>
              )}

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-indigo-400">History</h3>
                <dl className="space-y-3 text-sm text-slate-300">
                  <div>
                    <span className="text-slate-500">Created by:</span> {rfp.createdByUser?.name || rfp.createdByUser?.email || 'Unknown'}
                  </div>
                  <div>
                    <span className="text-slate-500">Created:</span> {formatDateTime(rfp.createdAt)}
                  </div>
                  <div>
                    <span className="text-slate-500">Last updated:</span> {formatDateTime(rfp.updatedAt)}
                  </div>
                </dl>
              </section>
            </div>

            <div className="lg:col-span-2">
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-indigo-400">Generated Document</h3>
                {rfp.generatedContent ? (
                  <div className="rfp-document rounded-2xl border border-white/5 bg-black/20" dangerouslySetInnerHTML={{ __html: rfp.generatedContent }} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 py-16 text-center text-sm text-slate-500">
                    No document has been generated for this RFP yet.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
