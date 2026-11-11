'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { QrCode, Camera, CheckCircle2, X, Keyboard } from 'lucide-react';
import {
  isQrCameraScanSupported,
  qrScanErrorMessage,
  scanQrFromCamera,
} from '@/lib/qr-scan';

interface CheckpointQrScannerProps {
  // The decoded (or typed) checkpoint code, owned by the parent so it can be
  // submitted with the scan. null = nothing captured yet.
  value: string | null;
  onChange: (value: string | null) => void;
  // False when the checkpoint has no QR code configured, in which case
  // there is nothing to verify and the control explains that instead of
  // asking the guard for a code they don't have.
  checkpointHasQrCode: boolean;
  disabled?: boolean;
}

// Captures the checkpoint's QR code during a patrol scan. Two paths, both
// producing the same string for the server to verify:
//
//   1. Camera decode (BarcodeDetector where the browser has it, jsQR
//      otherwise - see qr-scan.ts; iPhones take the second path).
//   2. Typing the code printed on the sticker.
//
// The manual path is always available, never hidden behind a failure: a
// faded, wet or partly torn sticker is routine on a real site, and a guard
// must never be unable to log a checkpoint because the camera couldn't read
// it. Whichever path is used, the verdict is the server's - a wrong code is
// recorded and flagged for the supervisor, not rejected here.
export default function CheckpointQrScanner({
  value,
  onChange,
  checkpointHasQrCode,
  disabled = false,
}: CheckpointQrScannerProps) {
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Checked on the client only: navigator is absent during SSR, so probing
  // it at render time would mark every device unsupported.
  useEffect(() => {
    setCameraSupported(isQrCameraScanSupported());
  }, []);

  // Releases the camera if this control unmounts mid-scan (the guard closed
  // the scan modal), so the device's camera never stays live.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const startScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || scanning) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setScanning(true);

    try {
      const result = await scanQrFromCamera({
        video,
        signal: controller.signal,
      });

      if (result.status === 'success') {
        onChange(result.value);
        toast.success('QR code captured.');
      } else if (result.status !== 'cancelled') {
        toast.warning(qrScanErrorMessage(result.status));
        setManualEntry(true);
      }
    } finally {
      setScanning(false);
      abortRef.current = null;
    }
  }, [onChange, scanning]);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (!checkpointHasQrCode) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-400">
        <span className="flex items-center gap-2">
          <QrCode className="shrink-0" size={14} />
          This checkpoint has no QR code to scan.
        </span>
      </div>
    );
  }

  // Only a camera capture collapses into the confirmation chip. While the
  // guard is typing, the input must stay mounted - switching views on the
  // first keystroke would drop focus and the rest of the code with it.
  if (value && !manualEntry) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="shrink-0" size={14} />
            <span className="truncate font-mono">{value}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="shrink-0 rounded-lg p-1 text-emerald-300/70 transition hover:bg-white/10 hover:text-emerald-200 disabled:opacity-50"
            aria-label="Clear captured QR code"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-emerald-300/70">
          Verified against this checkpoint when you submit the scan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* The video element must stay mounted for the whole scan, so it is
          rendered (collapsed to nothing) rather than conditionally created. */}
      <div className={scanning ? 'block' : 'hidden'}>
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-48 w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-32 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        </div>
        <button
          type="button"
          onClick={cancelScan}
          className="mt-2 w-full rounded-2xl border border-white/10 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/5"
        >
          Cancel scan
        </button>
      </div>

      {!scanning && (
        <>
          {cameraSupported && !manualEntry && (
            <button
              type="button"
              onClick={startScan}
              disabled={disabled}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <Camera size={16} />
              Scan checkpoint QR code
            </button>
          )}

          {manualEntry || !cameraSupported ? (
            <div className="space-y-1">
              <label
                htmlFor="checkpoint-qr-value"
                className="text-xs font-semibold text-slate-300"
              >
                Checkpoint code (printed on the sticker)
              </label>
              <input
                id="checkpoint-qr-value"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                value={value ?? ''}
                onChange={(e) => {
                  const next = e.target.value;
                  // Kept in sync per keystroke rather than on blur: a guard
                  // who types the code and immediately hits "Verify Scan"
                  // would otherwise submit without it.
                  onChange(next.trim() === '' ? null : next);
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none focus:border-indigo-500/50 disabled:opacity-50"
                placeholder="e.g. CP-LOADING-BAY-01"
              />
              {cameraSupported && (
                <button
                  type="button"
                  onClick={() => setManualEntry(false)}
                  className="inline-flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  <Camera size={11} />
                  Use the camera instead
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setManualEntry(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
            >
              <Keyboard size={11} />
              Can&apos;t scan it? Enter the code by hand
            </button>
          )}

          {!value && (
            <p className="text-[10px] text-slate-500">
              You can still submit without a code — the scan is recorded and
              flagged for your supervisor.
            </p>
          )}
        </>
      )}
    </div>
  );
}
