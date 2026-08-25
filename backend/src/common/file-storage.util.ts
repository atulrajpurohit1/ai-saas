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
