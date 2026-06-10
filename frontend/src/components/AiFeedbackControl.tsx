'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';

interface AiFeedbackControlProps {
  aiGenerationId?: string;
  recommendationId?: string;
  actionId?: string;
  compact?: boolean;
}

export default function AiFeedbackControl({
  aiGenerationId,
  recommendationId,
  actionId,
  compact = false,
}: AiFeedbackControlProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [isUseful, setIsUseful] = useState(true);
  const [isAccurate, setIsAccurate] = useState(true);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = Boolean(aiGenerationId || recommendationId || actionId);

  const submit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await api.post('ai-feedback', {
        aiGenerationId,
        recommendationId,
        actionId,
        rating,
        feedbackText: feedbackText.trim() || undefined,
        isUseful,
        isAccurate,
      });
      setSubmitted(true);
      setOpen(false);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit AI feedback.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
        <CheckCircle2 size={14} />
        Feedback saved
      </div>
    );
  }

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={!canSubmit}
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageSquare size={14} />
        Feedback
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsUseful(true);
                setIsAccurate(true);
              }}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                isUseful
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <ThumbsUp size={14} />
              Useful
            </button>
            <button
              type="button"
              onClick={() => {
                setIsUseful(false);
                setIsAccurate(false);
                setRating((value) => Math.min(value, 2));
              }}
              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                !isUseful
                  ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <ThumbsDown size={14} />
              Not useful
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} star rating`}
                className={`rounded-lg p-1.5 transition ${
                  value <= rating
                    ? 'text-amber-300'
                    : 'text-slate-600 hover:text-slate-300'
                }`}
              >
                <Star size={17} fill={value <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>

          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={isAccurate}
              onChange={(event) => setIsAccurate(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/30 accent-sky-500"
            />
            Accurate
          </label>

          <textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            rows={3}
            placeholder="Optional comment"
            className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/40"
          />

          {error && <div className="mb-3 text-xs font-semibold text-rose-300">{error}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !canSubmit}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
          >
            {submitting && <Loader2 className="animate-spin" size={15} />}
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
