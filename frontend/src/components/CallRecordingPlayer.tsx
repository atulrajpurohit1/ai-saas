'use client';

import React, { useEffect, useState } from 'react';
import { fetchCallRecording } from '@/lib/calls';
import { Download, Loader2, Play } from 'lucide-react';

/**
 * Plays a saved call recording. The audio is fetched only when the rep asks
 * for it -- a list of calls should not download every recording up front.
 */
export default function CallRecordingPlayer({
  callId,
  fileName,
}: {
  callId: string;
  fileName?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const blob = await fetchCallRecording(callId);
      setUrl(URL.createObjectURL(blob));
    } catch {
      setError('Could not load the recording.');
    } finally {
      setLoading(false);
    }
  };

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <audio controls autoPlay src={url} className="h-9 w-full min-w-0" />
        <a
          href={url}
          download={fileName || 'call-recording'}
          title="Download recording"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground transition hover:text-foreground"
        >
          <Download size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        Play recording
      </button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
