// Camera QR decoding for Guard Tour checkpoint scans, built on the browser's
// own BarcodeDetector API - no new dependency, and nothing is bundled for
// devices that can't use it.
//
// Support is the reason this module exists as a capability check rather than
// a hard requirement: BarcodeDetector ships in Chrome/Edge on Android and
// desktop, but not in Safari/iOS. Every caller must therefore keep the
// manual code-entry path available, and the server treats a typed value and
// a decoded value identically (see verifyCheckpointQr) - the camera is a
// convenience, never the gate.

// Minimal structural types: TypeScript's DOM lib does not declare
// BarcodeDetector, and we only touch these two members.
interface DetectedBarcodeLike {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcodeLike[]>;
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

// True when this device can decode a QR code from its camera. Callers use
// this to decide whether to offer the "Scan with camera" affordance at all,
// rather than offering it and failing after a permission prompt.
export function isQrCameraScanSupported(): boolean {
  return (
    getBarcodeDetectorCtor() !== null &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export type QrScanFailure =
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'cancelled';

export function qrScanErrorMessage(failure: QrScanFailure): string {
  switch (failure) {
    case 'unsupported':
      return "This device can't scan QR codes with the camera. Enter the checkpoint code instead.";
    case 'denied':
      return 'Camera access was denied. Allow the camera, or enter the checkpoint code by hand.';
    case 'timeout':
      return "Couldn't read a QR code. Hold the camera steady on the sticker, or enter the code by hand.";
    case 'cancelled':
      return 'QR scan cancelled.';
    case 'unavailable':
    default:
      return "The camera isn't available right now. Enter the checkpoint code instead.";
  }
}

// Opens the rear camera, decodes the first QR code it sees, and stops the
// stream. `signal` lets the caller cancel (modal closed, guard tapped
// cancel) and is honoured at every await point, so the camera is always
// released - a stream left running would keep the device's camera light on
// for the rest of the patrol.
export async function scanQrFromCamera(options: {
  video: HTMLVideoElement;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<
  { status: 'success'; value: string } | { status: QrScanFailure }
> {
  const { video, signal, timeoutMs = 30_000 } = options;

  const Ctor = getBarcodeDetectorCtor();
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
    return { status: 'unsupported' };
  }

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    return {
      status:
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : 'unavailable',
    };
  }

  const stop = () => {
    for (const track of stream?.getTracks() ?? []) track.stop();
    // Release the element too, so a re-open starts from a clean state.
    video.srcObject = null;
  };

  try {
    if (signal?.aborted) return { status: 'cancelled' };

    video.srcObject = stream;
    video.muted = true;
    await video.play().catch(() => undefined);

    const detector = new Ctor({ formats: ['qr_code'] });
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (signal?.aborted) return { status: 'cancelled' };

      // videoWidth is 0 until the first frame is decoded; detect() on an
      // empty frame throws on some builds, so wait for real pixels.
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const found = await detector.detect(video);
          const value = found.find((b) => b.rawValue?.trim())?.rawValue.trim();
          if (value) return { status: 'success', value };
        } catch {
          // A single failed frame is not fatal - keep sampling until the
          // deadline. Only a total failure to decode becomes a timeout.
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { status: 'timeout' };
  } finally {
    stop();
  }
}
