'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, ImagePlus, Loader2, CheckCircle2, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  PatrolEvidence,
  fetchCheckpointEvidenceObjectUrl,
  getCheckpointEvidence,
  uploadCheckpointEvidence,
} from '@/lib/patrols';

interface CheckpointPhotoCaptureProps {
  runId: string;
  // The PatrolEvent id returned by the checkpoint scan. When null the
  // checkpoint has not been scanned yet, so evidence cannot be attached.
  eventId: string | null;
  // Compact = the inline affordance on a scanned checklist row.
  variant?: 'inline' | 'block';
}

// Phase 3H: lets a guard attach one or more photos to a checkpoint scan they
// just performed. Kept deliberately light - a single button, a thumbnail
// strip, upload/'attached' states - so it reads as part of the existing
// patrol checklist, not a separate photo manager. Camera capture is offered
// first (capture="environment"); picking an existing image is the built-in
// fallback the same <input type="file"> gives us.
export default function CheckpointPhotoCapture({
  runId,
  eventId,
  variant = 'inline',
}: CheckpointPhotoCaptureProps) {
  const [items, setItems] = useState<PatrolEvidence[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const thumbsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    thumbsRef.current = thumbs;
  }, [thumbs]);

  const loadThumb = useCallback(
    async (evidence: PatrolEvidence) => {
      if (!eventId) return;
      try {
        const url = await fetchCheckpointEvidenceObjectUrl(
          'guard',
          runId,
          eventId,
          evidence.id,
        );
        setThumbs((current) => {
          if (current[evidence.id]) {
            URL.revokeObjectURL(url);
            return current;
          }
          return { ...current, [evidence.id]: url };
        });
      } catch {
        // A single failed thumbnail must not break the row.
      }
    },
    [runId, eventId],
  );

  // Lazily pull any evidence already attached (e.g. after a page refresh
  // mid-patrol) the first time this row's control is shown.
  const ensureLoaded = useCallback(async () => {
    if (loaded || !eventId) return;
    setLoaded(true);
    try {
      const data = await getCheckpointEvidence('guard', runId, eventId);
      setItems(data);
      data.forEach((evidence) => void loadThumb(evidence));
    } catch {
      // Non-fatal - the guard can still add a new photo.
    }
  }, [loaded, eventId, runId, loadThumb]);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    return () => {
      Object.values(thumbsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
      thumbsRef.current = {};
    };
  }, []);

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !eventId) return;

    setUploading(true);
    try {
      const created = await uploadCheckpointEvidence(runId, eventId, file);
      setItems((current) => [created, ...current]);
      void loadThumb(created);
      toast.success('Photo attached to checkpoint.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not attach photo.'));
    } finally {
      setUploading(false);
    }
  };

  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!eventId) return null;

  return (
    <div
      className={
        variant === 'block'
          ? 'space-y-2'
          : 'mt-2 flex flex-col items-end gap-2'
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        {items.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 size={12} />
            {items.length} photo{items.length !== 1 ? 's' : ''} attached
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="animate-spin" size={14} />
          ) : items.length > 0 ? (
            <ImagePlus size={14} />
          ) : (
            <Camera size={14} />
          )}
          {uploading
            ? 'Uploading…'
            : items.length > 0
              ? 'Add another'
              : 'Add photo'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((evidence) => {
            const thumb = thumbs[evidence.id];
            return (
              <button
                key={evidence.id}
                type="button"
                onClick={() => thumb && setLightbox(thumb)}
                className="h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-black/40"
                title={evidence.fileName}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={evidence.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Loader2
                    className="mx-auto mt-4 animate-spin text-slate-500"
                    size={14}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            title="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Checkpoint evidence"
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
