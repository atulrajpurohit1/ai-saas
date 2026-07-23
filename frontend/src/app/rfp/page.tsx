'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { createRfp, deleteRfp, downloadRfpPdf, getRfps, Rfp } from '@/lib/rfp';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FilePenLine,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

const statusClass: Record<Rfp['status'], string> = {
  DRAFT: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
  GENERATED: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  FINALIZED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RfpListPage() {
  const { can } = useAuth();
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getRfps();
      setRfps(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load RFPs.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDuplicate = async (rfp: Rfp) => {
    setActionId(rfp.id);
    try {
      await createRfp({
        title: `${rfp.title} (Copy)`,
        clientName: rfp.clientName,
        companyName: rfp.companyName || undefined,
        industry: rfp.industry || undefined,
        projectName: rfp.projectName || undefined,
        dueDate: rfp.dueDate || undefined,
        startDate: rfp.startDate || undefined,
        endDate: rfp.endDate || undefined,
        estimatedBudget: rfp.estimatedBudget ?? undefined,
        securityTypes: rfp.securityTypes,
        numberOfLocations: rfp.numberOfLocations ?? undefined,
        address: rfp.address || undefined,
        operatingHours: rfp.operatingHours || undefined,
        guardsRequired: rfp.guardsRequired ?? undefined,
        additionalRequirements: rfp.additionalRequirements || undefined,
        generatedContent: rfp.generatedContent || undefined,
        status: 'DRAFT',
      });
      showToast('RFP duplicated.', 'success');
      fetchData();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Could not duplicate this RFP.'), 'error');
    } finally {
      setActionId('');
    }
  };

  const handleDelete = async (rfp: Rfp) => {
    if (!confirm(`Delete "${rfp.title}"? This cannot be undone.`)) return;
    setActionId(rfp.id);
    try {
      await deleteRfp(rfp.id);
      setRfps((current) => current.filter((item) => item.id !== rfp.id));
      showToast('RFP deleted.', 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Could not delete this RFP.'), 'error');
    } finally {
      setActionId('');
    }
  };

  const handleDownload = async (rfp: Rfp) => {
    setActionId(rfp.id);
    try {
      await downloadRfpPdf(rfp.id, rfp.title);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Could not download PDF.'), 'error');
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout requiredPermissions="rfp.view">
      {toast && (
        <div
          className={`fixed left-4 right-4 top-4 z-[200] flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl transition-all sm:left-auto sm:right-6 sm:top-6 sm:max-w-md sm:px-5 sm:py-4 ${
            toast.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileText className="text-indigo-300" size={28} />
            RFP Management
          </h2>
          <p className="mt-2 text-muted-foreground">Create, generate, and manage Requests for Proposal.</p>
        </div>
        {can('rfp.create') && (
          <Link
            href="/rfp/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500"
          >
            <Plus size={20} />
            Create RFP
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading RFPs...
          </div>
        ) : rfps.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 text-indigo-400" size={40} />
            <p className="mb-2 text-lg font-semibold">No RFPs yet</p>
            <p className="text-sm">Use the &quot;Create RFP&quot; button to draft your first Request for Proposal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Due Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Created By</th>
                  <th className="px-6 py-4 font-semibold">Created Date</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rfps.map((rfp) => (
                  <tr key={rfp.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Title">
                      <div className="font-semibold text-white">{rfp.title}</div>
                      {rfp.projectName && <div className="mt-1 text-sm text-slate-500">{rfp.projectName}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Client">
                      <div>{rfp.clientName}</div>
                      {rfp.companyName && <div className="mt-1 text-slate-500">{rfp.companyName}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Due Date">
                      {formatDate(rfp.dueDate)}
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[rfp.status]}`}>
                        {rfp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Created By">
                      {rfp.createdByUser?.name || rfp.createdByUser?.email || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Created Date">
                      {formatDate(rfp.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/rfp/${rfp.id}`}
                          title="View"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-200 transition hover:bg-white/10"
                        >
                          <Eye size={16} />
                        </Link>
                        {can('rfp.update') && (
                          <Link
                            href={`/rfp/${rfp.id}/edit`}
                            title="Edit"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-200 transition hover:bg-white/10"
                          >
                            <FilePenLine size={16} />
                          </Link>
                        )}
                        <button
                          type="button"
                          title="Duplicate"
                          onClick={() => handleDuplicate(rfp)}
                          disabled={actionId === rfp.id || !can('rfp.create')}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          {actionId === rfp.id ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
                        </button>
                        <button
                          type="button"
                          title="Export PDF"
                          onClick={() => handleDownload(rfp)}
                          disabled={actionId === rfp.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                        >
                          <Download size={16} />
                        </button>
                        {can('rfp.delete') && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => handleDelete(rfp)}
                            disabled={actionId === rfp.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
