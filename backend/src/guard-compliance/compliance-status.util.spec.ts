import {
  COMPLIANCE_EXPIRING_SOON_DAYS,
  ComplianceStatus,
  calculateRecordStatus,
} from './compliance-status.util';

describe('compliance-status.util', () => {
  const NOW = new Date('2026-06-15T12:00:00.000Z');
  const daysFromNow = (days: number) =>
    new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

  it('treats a record with no expiration date as VALID (a permanent credential)', () => {
    expect(calculateRecordStatus(null, NOW)).toBe(ComplianceStatus.VALID);
    expect(calculateRecordStatus(undefined, NOW)).toBe(ComplianceStatus.VALID);
  });

  it('returns VALID for a date well beyond the expiring-soon window', () => {
    const farFuture = daysFromNow(COMPLIANCE_EXPIRING_SOON_DAYS + 10);
    expect(calculateRecordStatus(farFuture, NOW)).toBe(ComplianceStatus.VALID);
  });

  it('returns EXPIRING_SOON for a date inside the threshold window', () => {
    const soon = daysFromNow(COMPLIANCE_EXPIRING_SOON_DAYS - 5);
    expect(calculateRecordStatus(soon, NOW)).toBe(
      ComplianceStatus.EXPIRING_SOON,
    );
  });

  it('returns EXPIRING_SOON at exactly the threshold boundary', () => {
    const boundary = daysFromNow(COMPLIANCE_EXPIRING_SOON_DAYS);
    expect(calculateRecordStatus(boundary, NOW)).toBe(
      ComplianceStatus.EXPIRING_SOON,
    );
  });

  it('returns EXPIRED for a date in the past', () => {
    const past = daysFromNow(-1);
    expect(calculateRecordStatus(past, NOW)).toBe(ComplianceStatus.EXPIRED);
  });

  it('returns EXPIRED for a date far in the past', () => {
    const longExpired = daysFromNow(-365);
    expect(calculateRecordStatus(longExpired, NOW)).toBe(
      ComplianceStatus.EXPIRED,
    );
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(calculateRecordStatus(daysFromNow(-1).toISOString(), NOW)).toBe(
      ComplianceStatus.EXPIRED,
    );
  });

  it('throws (never silently treats as valid) for a malformed date string', () => {
    expect(() => calculateRecordStatus('not-a-real-date', NOW)).toThrow();
  });
});
