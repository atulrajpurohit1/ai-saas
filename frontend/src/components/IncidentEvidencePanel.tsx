'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FileImage,
  FileVideo,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  IncidentEvidence,
  IncidentEvidenceScope,
  deleteIncidentEvidence,
  fetchIncidentEvidenceObjectUrl,
  formatFileSize,
  getIncidentEvidence,
  uploadIncidentEvidence,
} from '@/lib/incidents';

interface IncidentEvidencePanelProps {
  incidentId: string;
  // 'incidents' for the admin portal, 'client/incidents' for the client portal.
  apiBase: IncidentEvidenceScope;
  // Only admins with incidents.review may upload/delete. Always false for clients.
  canManage?: boolean;
}

const ACCEPT = 'image/*,video/*';

export default function IncidentEvidencePanel({
  incidentId,
  apiBase,
  canManage = false,
}: IncidentEvidencePanelProps) {
  const [items, setItems] = useState<IncidentEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<IncidentEvidence | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    urlsRef.current = previewUrls;
  }, [previewUrls]);

  const revokeAll = useCallback(() => {
    Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
  }, []);

  const loadPreview = useCallback(
    async (evidence: IncidentEvidence) => {
      try {
        const url = await fetchIncidentEvidenceObjectUrl(
          apiBase,
          incidentId,
          evidence.id,
        );
        setPreviewUrls((current) => {
          if (current[evidence.id]) URL.revokeObjectURL(url);
          return current[evidence.id]
            ? current
            : { ...current, [evidence.id]: url };
        });
      } catch {
        // A single failed preview should not break the whole panel.
      }
    },
    [apiBase, incidentId],
  );

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIncidentEvidence(apiBase, incidentId);
      setItems(data);
      setError('');
      data.forEach((evidence) => void loadPreview(evidence));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load incident evidence.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase, incidentId, loadPreview]);

  useEffect(() => {
    void loadEvidence();
    return () => revokeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, apiBase]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const created = await uploadIncidentEvidence(incidentId, file);
      setItems((current) => [created, ...current]);
      void loadPreview(created);
      toast.success('Evidence uploaded.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload evidence.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (evidence: IncidentEvidence) => {
    if (!window.confirm(`Remove "${evidence.fileName}" from this incident?`)) {
      return;
    }
    setDeletingId(evidence.id);
    try {
      await deleteIncidentEvidence(incidentId, evidence.id);
      setItems((current) => current.filter((item) => item.id !== evidence.id));
      setPreviewUrls((current) => {
        const next = { ...current };
        if (next[evidence.id]) URL.revokeObjectURL(next[evidence.id]);
        delete next[evidence.id];
        return next;
      });
      if (lightbox?.id === evidence.id) setLightbox(null);
      toast.success('Evidence removed.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove evidence.'));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <FileImage className="text-indigo-300" size={20} />
            Evidence
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Photo and video evidence attached to this incident.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          {canManage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                onChange={handleUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={22} />
          Loading evidence...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
          No evidence attached{canManage ? ' yet.' : '.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((evidence) => {
            const previewUrl = previewUrls[evidence.id];
            const isDeleting = deletingId === evidence.id;
            return (
              <article
                key={evidence.id}
                className={`overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition ${
                  isDeleting ? 'opacity-50' : 'hover:border-indigo-400/30'
                }`}
              >
                <div className="relative flex aspect-video items-center justify-center bg-black/40">
                  {!previewUrl ? (
                    <Loader2 className="animate-spin text-slate-500" size={22} />
                  ) : evidence.mediaType === 'image' ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(evidence)}
                      className="h-full w-full"
                      title="View full size"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={evidence.fileName}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <video
                      src={previewUrl}
                      controls
                      preload="metadata"
                      className="h-full w-full bg-black object-contain"
                    />
                  )}
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-200">
                    {evidence.mediaType === 'image' ? (
                      <FileImage size={12} />
                    ) : (
                      <FileVideo size={12} />
                    )}
                    {evidence.mediaType}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white" title={evidence.fileName}>
                      {evidence.fileName}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {formatFileSize(evidence.fileSizeBytes)} · {formatDate(evidence.createdAt)}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(evidence)}
                      disabled={isDeleting}
                      className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-wait"
                      title="Delete evidence"
                    >
                      {isDeleting ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {lightbox && previewUrls[lightbox.id] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            title="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrls[lightbox.id]}
            alt={lightbox.fileName}
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
