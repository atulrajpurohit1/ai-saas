import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const VENDOR_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'vendor-submissions',
);

export function ensureVendorUploadDir(): string {
  if (!existsSync(VENDOR_UPLOAD_DIR)) {
    mkdirSync(VENDOR_UPLOAD_DIR, { recursive: true });
  }
  return VENDOR_UPLOAD_DIR;
}

/** Strips path separators and unsafe characters so a vendor-supplied filename can't escape the upload directory. */
export function sanitizeFilename(originalName: string): string {
  const baseName = originalName.split(/[/\\]/).pop() || 'file';
  const cleaned = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return cleaned.slice(-150) || 'file';
}

export const VENDOR_UPLOAD_ALLOWED_EXTENSIONS = /\.(pdf|docx|xlsx|zip)$/i;

export function vendorUploadMaxMb(): number {
  const parsed = Number(process.env.VENDOR_UPLOAD_MAX_MB || 20);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export function vendorUploadMaxBytes(): number {
  return vendorUploadMaxMb() * 1024 * 1024;
}

// Guard compliance documents (Phase 3C) - same local-disk pattern as vendor
// submissions above (this project has no object storage / Cloudinary / S3
// integration). Note: on a PaaS deploy without a persistent volume, this
// directory does not survive a redeploy - documented as a known limitation
// rather than solved here, matching the existing vendor-submissions module's
// own characteristics.
export const GUARD_COMPLIANCE_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'guard-compliance',
);

export function ensureGuardComplianceUploadDir(): string {
  if (!existsSync(GUARD_COMPLIANCE_UPLOAD_DIR)) {
    mkdirSync(GUARD_COMPLIANCE_UPLOAD_DIR, { recursive: true });
  }
  return GUARD_COMPLIANCE_UPLOAD_DIR;
}

export const GUARD_COMPLIANCE_UPLOAD_ALLOWED_EXTENSIONS = /\.(pdf|jpg|jpeg|png)$/i;

export function guardComplianceUploadMaxMb(): number {
  const parsed = Number(process.env.GUARD_COMPLIANCE_UPLOAD_MAX_MB || 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export function guardComplianceUploadMaxBytes(): number {
  return guardComplianceUploadMaxMb() * 1024 * 1024;
}

// Incident evidence photos/videos (Phase 3F) - same local-disk pattern as the
// guard-compliance and vendor-submission uploads above. Same PaaS-redeploy
// caveat applies (no persistent volume => files do not survive a redeploy),
// documented as a known limitation consistent with the other upload modules.
export const INCIDENT_EVIDENCE_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'incident-evidence',
);

export function ensureIncidentEvidenceUploadDir(): string {
  if (!existsSync(INCIDENT_EVIDENCE_UPLOAD_DIR)) {
    mkdirSync(INCIDENT_EVIDENCE_UPLOAD_DIR, { recursive: true });
  }
  return INCIDENT_EVIDENCE_UPLOAD_DIR;
}

// Allow-list keyed by canonical MIME type -> media category. Both the
// browser-supplied MIME type AND the file extension must map here, so a
// renamed executable (e.g. shell.exe -> shell.png) is rejected on the MIME
// check and a spoofed MIME is rejected on the extension check.
export const INCIDENT_EVIDENCE_IMAGE_MIME_TYPES: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'image/gif': true,
  'image/heic': true,
  'image/heif': true,
};

export const INCIDENT_EVIDENCE_VIDEO_MIME_TYPES: Record<string, true> = {
  'video/mp4': true,
  'video/quicktime': true,
  'video/webm': true,
  'video/x-m4v': true,
};

export const INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS =
  /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|m4v|webm)$/i;

export type IncidentEvidenceMediaType = 'image' | 'video';

/**
 * Resolves the media category for an upload, requiring the extension and the
 * declared MIME type to agree. Returns null when the file is not an accepted
 * image/video (the caller rejects with a 400).
 */
export function classifyIncidentEvidence(
  originalName: string,
  mimeType: string,
): IncidentEvidenceMediaType | null {
  if (!INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS.test(originalName)) {
    return null;
  }
  const normalized = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (INCIDENT_EVIDENCE_IMAGE_MIME_TYPES[normalized]) {
    return 'image';
  }
  if (INCIDENT_EVIDENCE_VIDEO_MIME_TYPES[normalized]) {
    return 'video';
  }
  return null;
}

export function incidentEvidenceImageMaxMb(): number {
  const parsed = Number(process.env.INCIDENT_EVIDENCE_IMAGE_MAX_MB || 15);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

export function incidentEvidenceVideoMaxMb(): number {
  const parsed = Number(process.env.INCIDENT_EVIDENCE_VIDEO_MAX_MB || 100);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export function incidentEvidenceImageMaxBytes(): number {
  return incidentEvidenceImageMaxMb() * 1024 * 1024;
}

export function incidentEvidenceVideoMaxBytes(): number {
  return incidentEvidenceVideoMaxMb() * 1024 * 1024;
}

/** The larger of the two caps - the hard multer limit; the per-media-type
 * cap is enforced afterward once the media type is known. */
export function incidentEvidenceUploadMaxBytes(): number {
  return Math.max(
    incidentEvidenceImageMaxBytes(),
    incidentEvidenceVideoMaxBytes(),
  );
}

export function incidentEvidenceMaxBytesFor(
  mediaType: IncidentEvidenceMediaType,
): number {
  return mediaType === 'image'
    ? incidentEvidenceImageMaxBytes()
    : incidentEvidenceVideoMaxBytes();
}
