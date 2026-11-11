// QR code generation for printable checkpoint stickers.
//
// The counterpart to lib/qr-scan.ts: that module decodes what a guard's
// camera sees, this one produces the sticker they scan. Both sides agree on
// one contract - the QR encodes the checkpoint's qrCodeValue verbatim and
// nothing else (no URL, no JSON wrapper), because the server compares the
// decoded string to Checkpoint.qrCodeValue directly
// (see backend verifyCheckpointQr / qrCodeValuesMatch). Encoding anything
// richer here would make every sticker read back as a MISMATCH.
import QRCode from 'qrcode';

// A QR code as a single SVG path, sized in module (dark square) units.
// Rendered as real vector output rather than a raster data URL so a sticker
// stays sharp at any print size - a blurry QR is a QR that won't scan.
export interface QrPath {
  // Width/height of the code in modules, so callers can set the viewBox.
  size: number;
  // SVG path data covering every dark module.
  path: string;
}

// Error correction level M recovers ~15% of a damaged code. Deliberately
// not L: these stickers live outdoors on gates and stairwells, where
// scuffing and rain are routine, and the whole point of the printed sheet
// is that a site can mount codes that survive a few months of weather.
const ERROR_CORRECTION_LEVEL = 'M' as const;

/**
 * Builds the SVG path for `value`'s QR code.
 *
 * Throws if the value cannot be encoded (effectively only when it is empty -
 * checkpoint codes are far below any capacity limit). Callers filter out
 * codeless checkpoints before getting here, but the throw is left
 * un-swallowed on purpose: a sticker sheet that silently dropped a
 * checkpoint would send someone to a gate with nothing on it.
 */
export function buildQrPath(value: string): QrPath {
  const qr = QRCode.create(value, {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
  });

  const size = qr.modules.size;
  const modules = qr.modules.data;
  const segments: string[] = [];

  // Emitted as horizontal runs rather than one rect per module: a typical
  // checkpoint code is a 29x29 code, so run-length keeps the path a few
  // hundred bytes instead of a few thousand - printing 60 stickers at once
  // is then comfortably fast in the browser's print preview.
  for (let row = 0; row < size; row++) {
    let runStart = -1;

    for (let col = 0; col <= size; col++) {
      // col === size is the sentinel that closes a run ending at the edge.
      const dark = col < size && Boolean(modules[row * size + col]);

      if (dark && runStart === -1) {
        runStart = col;
      } else if (!dark && runStart !== -1) {
        segments.push(`M${runStart} ${row}h${col - runStart}v1h-${col - runStart}z`);
        runStart = -1;
      }
    }
  }

  return { size, path: segments.join('') };
}
