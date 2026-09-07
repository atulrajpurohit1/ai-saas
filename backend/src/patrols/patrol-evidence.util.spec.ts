import {
  isAllowedPatrolEvidencePhoto,
  patrolEvidenceImageMaxBytes,
  patrolEvidenceImageMaxMb,
} from '../common/file-storage.util';

describe('isAllowedPatrolEvidencePhoto', () => {
  it('accepts a genuine photo (extension + MIME agree)', () => {
    expect(isAllowedPatrolEvidencePhoto('lobby.jpg', 'image/jpeg')).toBe(true);
    expect(isAllowedPatrolEvidencePhoto('lobby.PNG', 'image/png')).toBe(true);
    expect(isAllowedPatrolEvidencePhoto('lobby.heic', 'image/heic')).toBe(true);
    expect(
      isAllowedPatrolEvidencePhoto('a.jpg', 'image/jpeg; charset=binary'),
    ).toBe(true);
  });

  it('rejects video (patrol evidence is photo-only)', () => {
    expect(isAllowedPatrolEvidencePhoto('door.mp4', 'video/mp4')).toBe(false);
    expect(isAllowedPatrolEvidencePhoto('door.mov', 'video/quicktime')).toBe(
      false,
    );
  });

  it('rejects a disallowed extension even with an image MIME type', () => {
    expect(isAllowedPatrolEvidencePhoto('payload.svg', 'image/jpeg')).toBe(
      false,
    );
  });

  it('rejects a document / executable disguised with an allowed extension', () => {
    expect(
      isAllowedPatrolEvidencePhoto('shell.png', 'application/x-msdownload'),
    ).toBe(false);
    expect(isAllowedPatrolEvidencePhoto('report.pdf', 'application/pdf')).toBe(
      false,
    );
  });

  it('rejects an empty / missing MIME type', () => {
    expect(isAllowedPatrolEvidencePhoto('lobby.jpg', '')).toBe(false);
  });
});

describe('patrol evidence size limit', () => {
  it('defaults to a sane positive cap', () => {
    expect(patrolEvidenceImageMaxMb()).toBeGreaterThan(0);
    expect(patrolEvidenceImageMaxBytes()).toBe(
      patrolEvidenceImageMaxMb() * 1024 * 1024,
    );
  });
});
