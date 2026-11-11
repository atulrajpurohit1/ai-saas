// Camera QR decoding for Guard Tour checkpoint scans.
//
// Two decoders, in order of preference:
//
//   1. The browser's own BarcodeDetector, where present (Chrome/Edge on
//      Android and desktop). Hardware-backed, so it costs nothing to ship.
//   2. jsQR, a pure-JS decoder, loaded on demand. Safari/iOS has never
//      shipped BarcodeDetector, so every guard on an iPhone previously saw
//      no Scan button at all and had to type the code off the sticker.
//
// jsQR is imported dynamically so its ~40 KB only reaches devices that
// actually need it, and never the first load of any other screen.
//
// The manual code-entry path stays available regardless, and the server
// treats a typed value and a decoded value identically (see
// verifyCheckpointQr) - the camera is a convenience, never the gate.

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
//
// Now only the camera itself has to be there: without BarcodeDetector we
// fall back to jsQR, which runs anywhere, so this no longer excludes iOS.
export function isQrCameraScanSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Samples video frames onto a canvas and runs the pure-JS decoder over the
 * pixels. Used where BarcodeDetector is absent.
 *
 * The canvas is sized to the video once and reused per frame, because
 * allocating one per sample churns memory on a phone held up for 30 seconds.
 */
function createJsQrFrameDecoder(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  return async (
    decode: typeof import('jsqr').default,
  ): Promise<string | null> => {
    if (!context) return null;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    // A sticker photographed against a dark wall can come back inverted,
    // and a faded one reads either way, so let the decoder try both.
    const found = decode(data, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    return found?.data?.trim() || null;
  };
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
      return "This device has no camera available for scanning. Enter the checkpoint code instead.";
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

  if (!navigator.mediaDevices?.getUserMedia) {
    return { status: 'unsupported' };
  }

  const Ctor = getBarcodeDetectorCtor();

  // Loaded before the camera is opened: if the decoder can't be fetched (an
  // offline guard whose chunk was never cached), say "unsupported" rather
  // than turning the camera on and then failing.
  let decodeFrame: ((video: HTMLVideoElement) => Promise<string | null>) | null =
    null;
  if (!Ctor) {
    try {
      const { default: jsQR } = await import('jsqr');
      const sample = createJsQrFrameDecoder(video);
      decodeFrame = () => sample(jsQR);
    } catch {
      return { status: 'unsupported' };
    }
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

    const detector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (signal?.aborted) return { status: 'cancelled' };

      // videoWidth is 0 until the first frame is decoded; detect() on an
      // empty frame throws on some builds, so wait for real pixels.
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            const value = found.find((b) => b.rawValue?.trim())?.rawValue.trim();
            if (value) return { status: 'success', value };
          } else if (decodeFrame) {
            const value = await decodeFrame(video);
            if (value) return { status: 'success', value };
          }
        } catch {
          // A single failed frame is not fatal - keep sampling until the
          // deadline. Only a total failure to decode becomes a timeout.
        }
      }

      // The software decoder is the slow path, so it is given a little more
      // room between frames; both stay well inside a steady hand's hold.
      await new Promise((resolve) => setTimeout(resolve, detector ? 200 : 300));
    }

    return { status: 'timeout' };
  } finally {
    stop();
  }
}
