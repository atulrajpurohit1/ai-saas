'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { awardContract, rejectVendor, Rfp } from '@/lib/rfp';
import { getRfpSubmissions, RfpVendorSubmission } from '@/lib/vendors';
import { Award, AlertTriangle, Ban, Loader2, Trophy, X } from 'lucide-react';

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface ContractAwardPanelProps {
  rfpId: string;
  rfp: Rfp;
  onChanged: () => void;
}

export default function ContractAwardPanel({ rfpId, rfp, onChanged }: ContractAwardPanelProps) {
  const { can } = useAuth();
  const [submissions, setSubmissions] = useState<RfpVendorSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const [awardTarget, setAwardTarget] = useState<RfpVendorSubmission | null>(null);
  const [awardNotesInput, setAwardNotesInput] = useState('');
  const [rejectTarget, setRejectTarget] = useState<RfpVendorSubmission | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const canAward = can('rfp.award');
  const hasEvaluation = Boolean(rfp.evaluation);
  const isAwarded = rfp.status === 'AWARDED';
  const rejectedVendorIds = Array.isArray(rfp.rejectedVendorIds) ? rfp.rejectedVendorIds : [];

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getRfpSubmissions(rfpId);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch {
      // Non-fatal for this panel — the vendor action list simply stays empty.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpId]);

  const handleAward = async () => {
    if (!awardTarget) return;
    setProcessing(true);
    setError('');
    try {
      await awardContract(rfpId, awardTarget.vendorId, awardNotesInput || undefined);
      setAwardTarget(null);
      setAwardNotesInput('');
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not award the contract.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setProcessing(true);
    setError('');
    try {
      await rejectVendor(rfpId, rejectTarget.vendorId, rejectReasonInput || undefined);
      setRejectTarget(null);
      setRejectReasonInput('');
      onChanged();
      fetchSubmissions();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reject this vendor.'));
    } finally {
      setProcessing(false);
    }
  };

  const submittedVendors = submissions.filter((item) => item.submission);

  return (
    <section className="rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
        <Award size={14} />
        Contract Award
      </h3>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {isAwarded ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-300">
            <Trophy size={18} />
            <span className="font-bold">Contract Awarded</span>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Winning Vendor: </span>
              <span className="font-semibold text-white">{rfp.awardedVendor?.companyName || 'Unknown vendor'}</span>
            </div>
            <div>
              <span className="text-slate-400">Award Date: </span>
              <span className="text-white">{formatDateTime(rfp.awardDate)}</span>
            </div>
            {rfp.awardNotes && (
              <div>
                <span className="text-slate-400">Award Notes: </span>
                <span className="text-white">{rfp.awardNotes}</span>
              </div>
            )}
          </dl>
        </div>
      ) : !hasEvaluation ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-8 text-center text-sm text-slate-500">
          Generate an AI evaluation above before a contract can be awarded.
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto animate-spin text-indigo-300" size={20} />
        </div>
      ) : submittedVendors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-8 text-center text-sm text-slate-500">
          No submitted proposals available to award or reject.
        </div>
      ) : (
        <div className="space-y-2">
          {submittedVendors.map((item) => {
            const rejected = rejectedVendorIds.includes(item.vendorId);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-white">{item.vendor.companyName}</div>
                  {rejected && (
                    <span className="mt-1 inline-block rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                      Rejected
                    </span>
                  )}
                </div>
                {canAward && !rejected && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAwardTarget(item);
                        setAwardNotesInput('');
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400"
                    >
                      <Trophy size={14} />
                      Award Contract
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(item);
                        setRejectReasonInput('');
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                    >
                      <Ban size={14} />
                      Reject Vendor
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {awardTarget && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 text-left backdrop-blur-md sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border-white/10 bg-[#0e0e1a] p-5 shadow-3xl sm:p-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <Trophy className="text-amber-400" size={22} />
                Award Contract
              </h3>
              <button onClick={() => setAwardTarget(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-300">
              Award the contract for this RFP to <strong className="text-white">{awardTarget.vendor.companyName}</strong>?
              This action is final, will conclude the procurement process, and will notify the vendor by email.
            </p>
            <textarea
              rows={3}
              placeholder="Award notes (optional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500/50"
              value={awardNotesInput}
              onChange={(e) => setAwardNotesInput(e.target.value)}
            />
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setAwardTarget(null)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAward}
                disabled={processing}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 font-bold text-black shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
              >
                {processing ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} />}
                Confirm Award
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 text-left backdrop-blur-md sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border-white/10 bg-[#0e0e1a] p-5 shadow-3xl sm:p-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <Ban className="text-rose-400" size={22} />
                Reject Vendor
              </h3>
              <button onClick={() => setRejectTarget(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-300">
              Reject <strong className="text-white">{rejectTarget.vendor.companyName}</strong>&apos;s proposal? This will notify
              the vendor by email that another vendor was selected.
            </p>
            <textarea
              rows={3}
              placeholder="Reason (optional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-rose-500/50"
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
            />
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processing}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3 font-bold text-white shadow-lg transition hover:bg-rose-400 disabled:opacity-50"
              >
                {processing ? <Loader2 className="animate-spin" size={18} /> : <Ban size={18} />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
