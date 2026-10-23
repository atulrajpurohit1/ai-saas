import {
  classifyIncidentEvidence,
  incidentEvidenceImageMaxBytes,
  incidentEvidenceMaxBytesFor,
  incidentEvidenceUploadMaxBytes,
  incidentEvidenceVideoMaxBytes,
} from '../common/file-storage.util';

describe('classifyIncidentEvidence', () => {
  it('accepts a genuine image (extension + MIME agree)', () => {
    expect(classifyIncidentEvidence('scene.jpg', 'image/jpeg')).toBe('image');
    expect(classifyIncidentEvidence('scene.PNG', 'image/png')).toBe('image');
    expect(classifyIncidentEvidence('clip.heic', 'image/heic')).toBe('image');
  });

  it('accepts a genuine video (extension + MIME agree)', () => {
    expect(classifyIncidentEvidence('door.mp4', 'video/mp4')).toBe('video');
    expect(classifyIncidentEvidence('door.mov', 'video/quicktime')).toBe(
      'video',
    );
    expect(classifyIncidentEvidence('door.webm', 'video/webm')).toBe('video');
  });

  it('normalizes a MIME type that carries a charset/params suffix', () => {
    expect(classifyIncidentEvidence('a.mp4', 'video/mp4; codecs="avc1"')).toBe(
      'video',
    );
  });

  it('rejects a disallowed extension even with an image MIME type', () => {
    expect(classifyIncidentEvidence('payload.svg', 'image/jpeg')).toBeNull();
  });

  it('rejects a document / executable disguised with an allowed extension', () => {
    // renamed shell.exe -> shell.png: extension passes, MIME does not
    expect(
      classifyIncidentEvidence('shell.png', 'application/x-msdownload'),
    ).toBeNull();
    expect(classifyIncidentEvidence('report.pdf', 'application/pdf')).toBeNull();
    expect(
      classifyIncidentEvidence('notes.docx', 'application/octet-stream'),
    ).toBeNull();
  });

  it('accepts a phone-gallery upload that sends no / a generic MIME type by trusting the extension', () => {
    // Android galleries routinely hand images/videos over as
    // application/octet-stream or with no type at all; rejecting those was
    // what made "upload from gallery" fail. The extension is the fallback.
    expect(classifyIncidentEvidence('scene.jpg', '')).toBe('image');
    expect(
      classifyIncidentEvidence('scene.jpg', 'application/octet-stream'),
    ).toBe('image');
    expect(
      classifyIncidentEvidence('clip.mp4', 'application/octet-stream'),
    ).toBe('video');
  });

  it('still rejects a generic MIME type when the extension is not allowed', () => {
    expect(classifyIncidentEvidence('payload.svg', '')).toBeNull();
    expect(
      classifyIncidentEvidence('notes.docx', 'application/octet-stream'),
    ).toBeNull();
  });
});

describe('incident evidence size limits', () => {
  it('caps images smaller than videos by default', () => {
    expect(incidentEvidenceImageMaxBytes()).toBeLessThan(
      incidentEvidenceVideoMaxBytes(),
    );
  });

  it('resolves the per-media-type cap', () => {
    expect(incidentEvidenceMaxBytesFor('image')).toBe(
      incidentEvidenceImageMaxBytes(),
    );
    expect(incidentEvidenceMaxBytesFor('video')).toBe(
      incidentEvidenceVideoMaxBytes(),
    );
  });

  it('uses the larger cap as the hard multer limit', () => {
    expect(incidentEvidenceUploadMaxBytes()).toBe(
      Math.max(incidentEvidenceImageMaxBytes(), incidentEvidenceVideoMaxBytes()),
    );
  });
});
