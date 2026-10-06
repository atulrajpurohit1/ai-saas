'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Records the microphone of the device the rep is on while they take a call.
 *
 * The app does not carry the call (see CallDialer), so this hears exactly what
 * the microphone hears: both sides when the rep is on speakerphone or a
 * softphone on this machine, only the rep when the call is on a separate
 * handset. It is not used on phones at all -- see isMobileDevice.
 */

export type CallRecorderStatus = 'idle' | 'requesting' | 'recording' | 'unsupported' | 'denied';

export interface FinishedRecording {
  file: File;
  durationSec: number;
}

/** First format the browser can produce, in order of preference. Chrome,
 * Edge and Firefox produce WebM/Opus; Safari only MP4/AAC. */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function extensionFor(mimeType: string) {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export function isCallRecordingSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Phones and tablets. On these the dialer takes the microphone the moment a
 * call connects, so a page recording in the background hears only the
 * ringing and then silence -- no browser API can capture a native phone call.
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function useCallRecorder() {
  const [status, setStatus] = useState<CallRecorderStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (status !== 'recording') return;
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [status]);

  // Leaving the page mid-call would silently drop the recording.
  useEffect(() => {
    if (status !== 'recording') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  // Never leave the microphone open after the component goes away.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      releaseMicrophone();
    };
  }, [releaseMicrophone]);

  /** Resolves true once recording has started, false if it could not. */
  const start = useCallback(async () => {
    if (recorderRef.current?.state === 'recording') return true;
    if (!isCallRecordingSupported()) {
      setStatus('unsupported');
      return false;
    }

    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Echo cancellation and noise suppression treat the other party's
        // voice coming out of a speakerphone as noise to remove, which is the
        // half of the call worth keeping.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch {
      setStatus('denied');
      return false;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setStatus('unsupported');
      return false;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    // Timeslice so a crash or tab kill mid-call still leaves most of the audio
    // in memory rather than one blob that only arrives on stop().
    recorder.start(1000);
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    setStatus('recording');
    return true;
  }, []);

  /** Stops recording and hands back the audio, or null if nothing was recording. */
  const stop = useCallback(
    (baseName = 'call-recording') =>
      new Promise<FinishedRecording | null>((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
          resolve(null);
          return;
        }
        recorder.onstop = () => {
          const mimeType = (recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm').split(';')[0];
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
          chunksRef.current = [];
          recorderRef.current = null;
          releaseMicrophone();
          setStatus('idle');
          resolve(
            blob.size > 0
              ? {
                  file: new File([blob], `${baseName}.${extensionFor(mimeType)}`, { type: mimeType }),
                  durationSec,
                }
              : null,
          );
        };
        recorder.stop();
      }),
    [releaseMicrophone],
  );

  return { status, elapsedSec, start, stop };
}
