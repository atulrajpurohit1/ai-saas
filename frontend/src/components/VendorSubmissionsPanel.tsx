'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  downloadSubmissionFile,
  getRfpSubmissions,
  getVendors,
  inviteVendorsToRfp,
  InvitationStatus,
  RfpVendorSubmission,
  SUBMISSION_DOCUMENT_FIELDS,
  Vendor,
} from '@/lib/vendors';
import { AlertTriangle, Download, FileCheck2, Loader2, Mail, Plus, Search, Send, X } from 'lucide-react';

const statusClass: Record<InvitationStatus, string> = {
  PENDING: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  INVITED: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  VIEWED: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  SUBMITTED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface VendorSubmissionsPanelProps {
  rfpId: string;
}

export default function VendorSubmissionsPanel({ rfpId }: VendorSubmissionsPanelProps) {
  const { can } = useAuth();
  const [submissions, setSubmissions] = useState<RfpVendorSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingKey, setDownloadingKey] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  const canManage = can('rfp.update');

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getRfpSubmissions(rfpId);
      setSubmissions(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load vendor submissions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpId]);

  const openInviteModal = async () => {
    setShowInviteModal(true);
    setSelectedIds([]);
    setVendorSearch('');
    setLoadingVendors(true);
    try {
      const data = await getVendors();
      setAllVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load vendors.'));
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleVendorSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoadingVendors(true);
    try {
      const data = await getVendors(vendorSearch || undefined);
      setAllVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not search vendors.'));
    } finally {
      setLoadingVendors(false);
    }
  };

  const toggleSelected = (vendorId: string) => {
    setSelectedIds((current) =>
      current.includes(vendorId) ? current.filter((id) => id !== vendorId) : [...current, vendorId],
    );
  };

  const handleInvite = async () => {
    if (selectedIds.length === 0) return;
    setInviting(true);
    try {
      const result = await inviteVendorsToRfp(rfpId, selectedIds);
      setShowInviteModal(false);
      fetchSubmissions();
      const notices: string[] = [];
      if (result.skippedNoEmail.length > 0) {
        notices.push(`Skipped (no email on file): ${result.skippedNoEmail.join(', ')}`);
      }
      if (result.emailFailed.length > 0) {
        notices.push(`Invitation link created, but the email could not be delivered for: ${result.emailFailed.join(', ')}`);
      }
      if (notices.length > 0) {
        setError(notices.join(' '));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not invite the selected vendor(s).'));
    } finally {
      setInviting(false);
    }
  };

  const handleDownload = async (submission: RfpVendorSubmission, field: string, label: string) => {
    const key = `${submission.vendorId}-${field}`;
    setDownloadingKey(key);
    try {
      const filename = `${submission.vendor.companyName}-${label}`.replace(/[^a-zA-Z0-9.\-_]+/g, '_');
      await downloadSubmissionFile(rfpId, submission.vendorId, field, filename);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download this document.'));
    } finally {
      setDownloadingKey('');
    }
  };

  const alreadySubmittedIds = new Set(
    submissions.filter((item) => item.invitationStatus === 'SUBMITTED').map((item) => item.vendorId),
  );
  const selectableVendors = allVendors.filter((vendor) => !alreadySubmittedIds.has(vendor.id));

  return (
    <section className="rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
          <Send size={14} />
          Vendor Submissions
        </h3>
        {canManage && (
          <button
            type="button"
            onClick={openInviteModal}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
          >
            <Mail size={14} />
            Invite Vendors
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-2 animate-spin text-indigo-300" size={20} />
          Loading submissions...
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-8 text-center text-sm text-slate-500">
          No vendors have been invited to this RFP yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Invited</th>
                <th className="px-4 py-3 font-semibold">Viewed</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {submissions.map((item) => (
                <tr key={item.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold text-white" data-label="Vendor">
                    {item.vendor.companyName}
                  </td>
                  <td className="px-4 py-3" data-label="Status">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusClass[item.invitationStatus]}`}>
                      {item.invitationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Invited">
                    {formatDateTime(item.invitedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Viewed">
                    {formatDateTime(item.viewedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Submitted">
                    {formatDateTime(item.submittedAt)}
                  </td>
                  <td className="px-4 py-3" data-label="Documents">
                    {item.submission ? (
                      <div className="flex flex-wrap gap-2">
                        {SUBMISSION_DOCUMENT_FIELDS.filter(({ field }) => item.submission?.[field]).map(({ field, label }) => {
                          const key = `${item.vendorId}-${field}`;
                          return (
                            <button
                              key={field}
                              type="button"
                              title={`Download ${label}`}
                              onClick={() => handleDownload(item, field, label)}
                              disabled={downloadingKey === key}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              {downloadingKey === key ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Not submitted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 text-left backdrop-blur-md sm:items-center sm:p-4">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-lg)] border-white/10 bg-[#0e0e1a] shadow-3xl sm:max-h-[85vh]">
            <div className="flex items-center justify-between gap-4 border-b border-white/5 p-5 sm:p-6">
              <h3 className="text-lg font-bold text-white sm:text-xl">Invite Vendors</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>

            <div className="border-b border-white/5 p-5 sm:p-6">
              <form onSubmit={handleVendorSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-white outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder="Search vendors by company, contact, or email..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {loadingVendors ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-2 animate-spin text-indigo-300" size={20} />
                  Loading vendors...
                </div>
              ) : selectableVendors.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No vendors available to invite.</div>
              ) : (
                <div className="space-y-2">
                  {selectableVendors.map((vendor) => {
                    const selected = selectedIds.includes(vendor.id);
                    const hasEmail = Boolean(vendor.email);
                    return (
                      <button
                        key={vendor.id}
                        type="button"
                        disabled={!hasEmail}
                        onClick={() => toggleSelected(vendor.id)}
                        className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{vendor.companyName}</div>
                          <div className="text-xs text-slate-500">
                            {hasEmail ? vendor.email : 'No email on file — cannot be invited'}
                          </div>
                        </div>
                        {selected && <FileCheck2 size={16} className="shrink-0 text-indigo-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/5 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || selectedIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {inviting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Invite {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
