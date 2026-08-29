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

  it('rejects an empty / missing MIME type', () => {
    expect(classifyIncidentEvidence('scene.jpg', '')).toBeNull();
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
