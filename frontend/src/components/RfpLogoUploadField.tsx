'use client';

import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { readImageAsDataUrl } from '@/lib/rfp';

interface RfpLogoUploadFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function RfpLogoUploadField({ label, value, onChange }: RfpLogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      onChange(dataUrl);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this image file.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-300">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-14 w-24 rounded-lg border border-white/10 bg-white/5 object-contain"
          />
        ) : (
          <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 text-slate-500">
            <ImagePlus size={20} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10">
            {value ? 'Replace' : 'Upload'}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-semibold text-slate-400 transition hover:text-rose-300"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}
    </div>
  );
}
