'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  createPerformanceReview,
  getPerformanceReviews,
  PerformanceReviewInput,
  Rfp,
  updatePerformanceReview,
  VendorPerformanceReview,
} from '@/lib/rfp';
import { AlertTriangle, ClipboardList, FilePenLine, Loader2, Plus, Star, X } from 'lucide-react';

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function localDateInputValue(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const emptyForm: PerformanceReviewInput = {
  reviewDate: localDateInputValue(),
  overallRating: 5,
  slaCompliance: 100,
  incidentCount: 0,
  responseTime: '',
  notes: '',
};

interface VendorPerformancePanelProps {
  rfpId: string;
  rfp: Rfp;
}

export default function VendorPerformancePanel({ rfpId, rfp }: VendorPerformancePanelProps) {
  const { can } = useAuth();
  const [reviews, setReviews] = useState<VendorPerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState<VendorPerformanceReview | null>(null);
  const [form, setForm] = useState<PerformanceReviewInput>(emptyForm);

  const canManage = can('vendor.performance');
  const isAwarded = rfp.status === 'AWARDED';
  const latestReview = reviews[0] || null;

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await getPerformanceReviews(rfpId);
      setReviews(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load performance reviews.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpId]);

  const openAddModal = () => {
    setEditingReview(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (review: VendorPerformanceReview) => {
    setEditingReview(review);
    setForm({
      reviewDate: review.reviewDate.slice(0, 10),
      overallRating: review.overallRating,
      slaCompliance: review.slaCompliance,
      incidentCount: review.incidentCount,
      responseTime: review.responseTime,
      notes: review.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: PerformanceReviewInput = {
        ...form,
        responseTime: form.responseTime.trim(),
        notes: form.notes?.trim() || undefined,
      };

      if (editingReview) {
        await updatePerformanceReview(editingReview.id, payload);
      } else {
        await createPerformanceReview(rfpId, payload);
      }

      setShowModal(false);
      fetchReviews();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this performance review.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
          <ClipboardList size={14} />
          Vendor Performance
        </h3>
        {canManage && isAwarded && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
            >
              <Plus size={14} />
              Add Review
            </button>
            {latestReview && (
              <button
                type="button"
                onClick={() => openEditModal(latestReview)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
              >
                <FilePenLine size={14} />
                Edit Review
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {!isAwarded ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-8 text-center text-sm text-slate-500">
          Vendor performance can be tracked once this RFP&apos;s contract has been awarded.
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto animate-spin text-indigo-300" size={20} />
        </div>
      ) : !latestReview ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-muted py-8 text-center text-sm text-slate-500">
          No performance reviews recorded yet.
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Overall Rating</div>
            <div className="flex items-center gap-1 text-white">
              <Star size={14} className="text-amber-400" fill="currentColor" />
              <span className="font-bold">{latestReview.overallRating} / 5</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">SLA Compliance</div>
            <div className="font-bold text-white">{latestReview.slaCompliance}%</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Incident Count</div>
            <div className="font-bold text-white">{latestReview.incidentCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Response Time</div>
            <div className="font-bold text-white">{latestReview.responseTime}</div>
          </div>
          {latestReview.notes && (
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-4">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Notes</div>
              <div className="text-sm text-slate-300">{latestReview.notes}</div>
            </div>
          )}
        </div>
      )}

      {isAwarded && reviews.length > 0 && (
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Review Date</th>
                <th className="px-4 py-3 font-semibold">Rating</th>
                <th className="px-4 py-3 font-semibold">SLA</th>
                <th className="px-4 py-3 font-semibold">Incidents</th>
                <th className="px-4 py-3 font-semibold">Response Time</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reviews.map((review) => (
                <tr key={review.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold text-white" data-label="Review Date">
                    {formatDate(review.reviewDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Rating">
                    {review.overallRating} / 5
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="SLA">
                    {review.slaCompliance}%
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Incidents">
                    {review.incidentCount}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Response Time">
                    {review.responseTime}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Notes">
                    {review.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 text-left backdrop-blur-md sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] border-white/10 bg-[#0e0e1a] p-5 shadow-3xl sm:max-h-[calc(100dvh-2rem)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                {editingReview ? 'Edit Review' : 'Add Review'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Review Date</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-ring/50"
                  value={form.reviewDate}
                  onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setForm({ ...form, overallRating: rating })}
                      className={`flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-bold transition ${
                        form.overallRating === rating
                          ? 'border-amber-400/40 bg-amber-500 text-black'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SLA Compliance (%)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-ring/50"
                    value={form.slaCompliance}
                    onChange={(e) => setForm({ ...form, slaCompliance: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Incident Count</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-ring/50"
                    value={form.incidentCount}
                    onChange={(e) => setForm({ ...form, incidentCount: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Response Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Under 2 hours"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-ring/50"
                  value={form.responseTime}
                  onChange={(e) => setForm({ ...form, responseTime: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-ring/50"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/5 pt-6 sm:flex-row sm:gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 font-bold text-white transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                  {saving ? 'Saving...' : editingReview ? 'Save Changes' : 'Add Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
