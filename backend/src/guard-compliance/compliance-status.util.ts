// Server-side compliance status derivation (Phase 3C). Status is NEVER
// stored - always computed here from expirationDate at read time, so it
// can never go stale and can never be spoofed by a client-supplied value.

export enum ComplianceStatus {
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  // Only used at the guard×type level (no record exists at all) - never
  // returned by calculateRecordStatus, which always operates on a record
  // that exists. See GuardComplianceService.findAllForTenant.
  MISSING = 'MISSING',
}

// Single shared threshold - do not scatter this number through the app.
export const COMPLIANCE_EXPIRING_SOON_DAYS = 30;
const EXPIRING_SOON_WINDOW_MS =
  COMPLIANCE_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

/**
 * Status for a record that exists. A record with no expirationDate is
 * treated as VALID (a permanent/non-expiring credential, e.g. a one-time
 * background check) - it is not "missing", a real record is on file.
 * Throws on a genuinely malformed date rather than silently treating it as
 * valid - callers should validate at the DTO layer first; this is a
 * defensive last line.
 */
export function calculateRecordStatus(
  expirationDate: Date | string | null | undefined,
  now: Date = new Date(),
):
  | ComplianceStatus.VALID
  | ComplianceStatus.EXPIRING_SOON
  | ComplianceStatus.EXPIRED {
  if (!expirationDate) return ComplianceStatus.VALID;

  const expiry =
    expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(expiry.getTime())) {
    throw new Error('Invalid expiration date');
  }

  const msUntilExpiry = expiry.getTime() - now.getTime();
  if (msUntilExpiry < 0) return ComplianceStatus.EXPIRED;
  if (msUntilExpiry <= EXPIRING_SOON_WINDOW_MS)
    return ComplianceStatus.EXPIRING_SOON;
  return ComplianceStatus.VALID;
}
