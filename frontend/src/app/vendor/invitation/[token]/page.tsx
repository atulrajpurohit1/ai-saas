'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  getVendorInvitation,
  markInvitationViewed,
  submitVendorProposal,
  VendorInvitation,
} from '@/lib/vendor-portal';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';

const ALLOWED_EXTENSIONS = /\.(pdf|docx|xlsx|zip)$/i;

const inputClass =
  'min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-foreground outline-none focus:ring-2 focus:ring-indigo-500/50 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary-foreground';

interface FileFields {
  proposalFile: File | null;
  pricingFile: File | null;
  insuranceFile: File | null;
  licenseFile: File | null;
}

const emptyFiles: FileFields = {
  proposalFile: null,
  pricingFile: null,
  insuranceFile: null,
  licenseFile: null,
};

function formatDate(value: string | null) {
  if (!value) return 'Not specified';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function VendorInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [invitation, setInvitation] = useState<VendorInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<FileFields>(emptyFiles);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await getVendorInvitation(token);
        setInvitation(data);
        setError('');
        if (!data.alreadySubmitted) {
          markInvitationViewed(token).catch(() => undefined);
        }
      } catch (err) {
        setError(getApiErrorMessage(err, 'This invitation link is invalid or has expired.'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const handleFileChange = (field: keyof FileFields, file: File | null) => {
    if (file && !ALLOWED_EXTENSIONS.test(file.name)) {
      setSubmitError(`"${file.name}" is not a supported file type. Please use PDF, DOCX, XLSX, or ZIP.`);
      return;
    }
    setSubmitError('');
    setFiles((current) => ({ ...current, [field]: file }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (!files.proposalFile) {
      setSubmitError('Please attach your proposal document before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitVendorProposal(token, files, notes);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Could not submit your proposal. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05050a] px-4 py-8 sm:py-12">
      <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-indigo-600/10 blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-purple-600/10 blur-[120px]"></div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Vendor Proposal Submission</h1>
          <p className="font-medium tracking-wide text-slate-500">Secure invitation-based request for proposal</p>
        </div>

        <div className="glass-card rounded-[2rem] border-white/5 bg-[#0a0a14]/80 p-5 shadow-2xl backdrop-blur-xl sm:rounded-[2.5rem] sm:p-10">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
              Loading invitation...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="text-rose-400" size={40} />
              <p className="text-lg font-bold text-foreground">Unable to Load Invitation</p>
              <p className="max-w-sm text-sm text-slate-400">{error}</p>
            </div>
          ) : invitation ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                  <Building2 size={16} />
                  {invitation.companyName}
                </div>
                <h2 className="text-2xl font-bold text-foreground">{invitation.rfpTitle}</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <CalendarDays size={14} className="text-indigo-300" />
                  Submission deadline: <span className="font-semibold text-foreground">{formatDate(invitation.dueDate)}</span>
                </div>
              </div>

              {invitation.securityTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {invitation.securityTypes.map((type) => (
                    <span key={type} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      {type}
                    </span>
                  ))}
                </div>
              )}

              {invitation.additionalRequirements && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-400">Instructions</h3>
                  <p className="whitespace-pre-wrap text-sm text-slate-300">{invitation.additionalRequirements}</p>
                </div>
              )}

              {invitation.alreadySubmitted || submitted ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-10 text-center">
                  <CheckCircle2 className="text-emerald-400" size={40} />
                  <p className="text-lg font-bold text-foreground">Proposal Submitted</p>
                  <p className="max-w-sm text-sm text-emerald-200/80">
                    Thank you. Your proposal has been received. No further action is required.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 border-t border-white/5 pt-6">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
                    <Upload size={14} />
                    Upload Proposal
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Proposal PDF *</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.zip"
                      className={inputClass}
                      onChange={(e) => handleFileChange('proposalFile', e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Pricing Sheet</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.zip"
                      className={inputClass}
                      onChange={(e) => handleFileChange('pricingFile', e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Insurance Certificate</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.zip"
                      className={inputClass}
                      onChange={(e) => handleFileChange('insuranceFile', e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Security License</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.zip"
                      className={inputClass}
                      onChange={(e) => handleFileChange('licenseFile', e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Notes (optional)</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-indigo-500/50"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional context for your submission..."
                    />
                  </div>

                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck size={14} className="text-indigo-300" />
                    Accepted formats: PDF, DOCX, XLSX, ZIP
                  </p>

                  {submitError && (
                    <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
                      <AlertTriangle size={16} />
                      {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground shadow-lg transition-all hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    {submitting ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500">
              <FileText className="mx-auto mb-3" size={32} />
              No invitation data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
