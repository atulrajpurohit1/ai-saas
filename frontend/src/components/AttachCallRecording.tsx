'use client';

import React, { useRef, useState } from 'react';
import {
  CALL_RECORDING_ACCEPT,
  readAudioDurationSec,
  uploadCallRecording,
  type CallRecord,
} from '@/lib/calls';
import { Loader2, Paperclip } from 'lucide-react';

/**
 * Attaches an audio file to a call -- on a phone, the recording the phone's
 * own dialer saved, since a web page cannot record a native phone call.
 */
export default function AttachCallRecording({
  call,
  label = 'Attach recording',
  onSaved,
  className = '',
}: {
  call: CallRecord;
  label?: string;
  onSaved: (call: CallRecord, file: File) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const durationSec = await readAudioDurationSec(file);
      const updated = await uploadCallRecording(call.id, file, durationSec);
      onSaved(updated, file);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'The recording could not be uploaded.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        {uploading ? 'Uploading...' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={CALL_RECORDING_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
