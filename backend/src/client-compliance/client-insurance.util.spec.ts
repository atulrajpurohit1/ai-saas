import {
  clientInsuranceUploadMaxBytes,
  isAllowedClientInsuranceDocument,
} from '../common/file-storage.util';
import {
  ComplianceStatus,
  calculateRecordStatus,
} from '../guard-compliance/compliance-status.util';
import {
  CLIENT_INSURANCE_REQUIRED_TYPES,
  CLIENT_INSURANCE_TYPES,
} from './client-insurance-types.constants';

// Phase 3G reuses the guard-compliance status engine verbatim - these tests
// document the expected derivations for the client-insurance context rather
// than re-implementing the logic.
describe('client insurance - status derivation (reused guard-compliance util)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('derives VALID for an expiration comfortably in the future', () => {
    expect(calculateRecordStatus(new Date(Date.now() + 200 * DAY))).toBe(
      ComplianceStatus.VALID,
    );
  });

  it('derives VALID for a policy with no expiration date (non-expiring)', () => {
    expect(calculateRecordStatus(null)).toBe(ComplianceStatus.VALID);
  });

  it('derives EXPIRING_SOON within the 30-day window', () => {
    expect(calculateRecordStatus(new Date(Date.now() + 10 * DAY))).toBe(
      ComplianceStatus.EXPIRING_SOON,
    );
  });

  it('derives EXPIRED once the expiration date has passed', () => {
    expect(calculateRecordStatus(new Date(Date.now() - DAY))).toBe(
      ComplianceStatus.EXPIRED,
    );
  });

  it('throws on a malformed date so callers can downgrade to EXPIRED', () => {
    expect(() => calculateRecordStatus('not-a-date')).toThrow();
  });
});

describe('CLIENT_INSURANCE type constants', () => {
  it('exposes the six documented types', () => {
    expect(CLIENT_INSURANCE_TYPES).toEqual([
      'general_liability',
      'workers_comp',
      'professional_liability',
      'umbrella',
      'certificate_of_insurance',
      'other',
    ]);
  });

  it('marks GL, WC and COI as required (drives MISSING synthesis)', () => {
    expect([...CLIENT_INSURANCE_REQUIRED_TYPES].sort()).toEqual(
      ['certificate_of_insurance', 'general_liability', 'workers_comp'].sort(),
    );
    for (const type of CLIENT_INSURANCE_REQUIRED_TYPES) {
      expect(CLIENT_INSURANCE_TYPES).toContain(type);
    }
  });
});

describe('isAllowedClientInsuranceDocument', () => {
  it('accepts a genuine PDF / image (extension + MIME agree)', () => {
    expect(isAllowedClientInsuranceDocument('coi.pdf', 'application/pdf')).toBe(
      true,
    );
    expect(isAllowedClientInsuranceDocument('scan.JPG', 'image/jpeg')).toBe(
      true,
    );
    expect(isAllowedClientInsuranceDocument('scan.png', 'image/png')).toBe(true);
    expect(isAllowedClientInsuranceDocument('scan.webp', 'image/webp')).toBe(
      true,
    );
  });

  it('normalizes a MIME type with a parameter suffix', () => {
    expect(
      isAllowedClientInsuranceDocument('coi.pdf', 'application/pdf; charset=binary'),
    ).toBe(true);
  });

  it('rejects a disallowed extension even with an allowed MIME type', () => {
    expect(isAllowedClientInsuranceDocument('coi.svg', 'application/pdf')).toBe(
      false,
    );
    expect(
      isAllowedClientInsuranceDocument('policy.docx', 'application/pdf'),
    ).toBe(false);
  });

  it('rejects an executable/document disguised with an allowed extension', () => {
    expect(
      isAllowedClientInsuranceDocument('malware.pdf', 'application/x-msdownload'),
    ).toBe(false);
    expect(
      isAllowedClientInsuranceDocument('policy.png', 'application/octet-stream'),
    ).toBe(false);
  });

  it('rejects an empty MIME type', () => {
    expect(isAllowedClientInsuranceDocument('coi.pdf', '')).toBe(false);
  });
});

describe('clientInsuranceUploadMaxBytes', () => {
  it('is a positive byte count derived from the configured MB cap', () => {
    expect(clientInsuranceUploadMaxBytes()).toBeGreaterThan(0);
    expect(clientInsuranceUploadMaxBytes() % (1024 * 1024)).toBe(0);
  });
});
