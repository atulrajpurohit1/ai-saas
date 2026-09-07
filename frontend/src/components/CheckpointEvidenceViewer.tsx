'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileImage, Loader2, X } from 'lucide-react';
import {
  PatrolEvidenceSummary,
  fetchCheckpointEvidenceObjectUrl,
} from '@/lib/patrols';

interface CheckpointEvidenceViewerProps {
  runId: string;
  eventId: string;
  // Metadata already delivered with the patrol-run detail payload. The image
  // bytes are streamed on demand through the authenticated endpoint.
  evidence: PatrolEvidenceSummary[];
}

// Phase 3H: read-only photo evidence for admins/dispatchers, shown inline on
// the patrol-run checkpoint timeline. Mirrors IncidentEvidencePanel's
// object-URL streaming + lightbox, kept compact so it sits naturally in the
// existing timeline rather than as a separate screen.
export default function CheckpointEvidenceViewer({
  runId,
  eventId,
  evidence,
}: CheckpointEvidenceViewerProps) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const thumbsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    thumbsRef.current = thumbs;
  }, [thumbs]);

  const loadThumb = useCallback(
    async (id: string) => {
      try {
        const url = await fetchCheckpointEvidenceObjectUrl(
          'patrol-runs',
          runId,
          eventId,
          id,
        );
        setThumbs((current) => {
          if (current[id]) {
            URL.revokeObjectURL(url);
            return current;
          }
          return { ...current, [id]: url };
        });
      } catch {
        // A single failed thumbnail must not break the timeline row.
      }
    },
    [runId, eventId],
  );

  useEffect(() => {
    evidence.forEach((item) => void loadThumb(item.id));
  }, [evidence, loadThumb]);

  useEffect(() => {
    return () => {
      Object.values(thumbsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
      thumbsRef.current = {};
    };
  }, []);

  if (evidence.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <FileImage size={11} />
        {evidence.length} photo{evidence.length !== 1 ? 's' : ''} attached
      </div>
      <div className="flex flex-wrap gap-2">
        {evidence.map((item) => {
          const thumb = thumbs[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => thumb && setLightbox(thumb)}
              className="h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-black/40"
              title={`${item.fileName} · ${new Date(item.createdAt).toLocaleString()}`}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={item.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Loader2
                  className="mx-auto mt-5 animate-spin text-slate-500"
                  size={14}
                />
              )}
            </button>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
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
