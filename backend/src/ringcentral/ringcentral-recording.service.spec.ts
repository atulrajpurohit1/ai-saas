import { TelephonyConnection } from '@prisma/client';
import { RingCentralApiError } from './ringcentral-client.service';
import { RingCentralRecordingService } from './ringcentral-recording.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('../common/object-storage.util', () => ({
  persistUpload: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as { writeFileSync: jest.Mock; unlinkSync: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const storage = require('../common/object-storage.util') as {
  persistUpload: jest.Mock;
};

const connection = {
  id: 'conn-1',
  tenantId: 'tenant-1',
} as TelephonyConnection;

describe('RingCentralRecordingService', () => {
  let service: RingCentralRecordingService;
  let prisma: { callRecord: { findMany: jest.Mock; update: jest.Mock } };
  let client: { downloadContent: jest.Mock };
  let connections: { credentialOf: jest.Mock };

  const pending = [{ id: 'call-1', externalRecordingId: 'rec-9' }];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RINGCENTRAL_SERVER_URL = 'https://platform.devtest.ringcentral.com';

    prisma = {
      callRecord: {
        findMany: jest.fn().mockResolvedValue(pending),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    client = {
      downloadContent: jest.fn().mockResolvedValue({
        buffer: Buffer.from('fake-mp3-bytes'),
        contentType: 'audio/mpeg',
      }),
    };
    connections = { credentialOf: jest.fn().mockReturnValue('jwt') };

    service = new RingCentralRecordingService(
      prisma as never,
      client as never,
      connections as never,
    );
  });

  it('downloads the recording and attaches it to the call', async () => {
    const result = await service.downloadPending(connection);

    expect(result.downloaded).toBe(1);
    expect(client.downloadContent).toHaveBeenCalledWith(
      'conn-1',
      'jwt',
      expect.stringContaining('/restapi/v1.0/account/~/recording/rec-9/content'),
    );
    expect(prisma.callRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'call-1' },
        data: expect.objectContaining({
          recordingMimeType: 'audio/mpeg',
          recordingSizeBytes: 14,
        }),
      }),
    );
  });

  it('uploads to durable storage BEFORE pointing the row at the file', async () => {
    // A row referencing a file that was never uploaded is worse than no row:
    // playback 404s forever and nothing retries it.
    const order: string[] = [];
    storage.persistUpload.mockImplementation(async () => {
      order.push('persist');
    });
    prisma.callRecord.update.mockImplementation(async () => {
      order.push('update');
      return {};
    });

    await service.downloadPending(connection);

    expect(order).toEqual(['persist', 'update']);
  });

  it('treats a missing recording as normal, not an error', async () => {
    // RingCentral does not retain recordings under 30 seconds, so a 404 here
    // is an expected outcome for short calls.
    client.downloadContent.mockRejectedValue(
      new RingCentralApiError(404, 'Not found'),
    );

    await expect(service.downloadPending(connection)).resolves.toEqual({
      downloaded: 0,
      pending: 1,
    });
    expect(prisma.callRecord.update).not.toHaveBeenCalled();
  });

  it('rejects an empty recording rather than storing a zero-byte file', async () => {
    client.downloadContent.mockResolvedValue({
      buffer: Buffer.alloc(0),
      contentType: 'audio/mpeg',
    });

    await service.downloadPending(connection);

    expect(prisma.callRecord.update).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('refuses a recording past the upload size ceiling', async () => {
    process.env.CALL_RECORDING_UPLOAD_MAX_MB = '1';
    client.downloadContent.mockResolvedValue({
      buffer: Buffer.alloc(2 * 1024 * 1024),
      contentType: 'audio/mpeg',
    });

    await service.downloadPending(connection);

    expect(prisma.callRecord.update).not.toHaveBeenCalled();
    delete process.env.CALL_RECORDING_UPLOAD_MAX_MB;
  });

  it('removes the local file when the row cannot be written', async () => {
    prisma.callRecord.update.mockRejectedValue(new Error('database is down'));

    await service.downloadPending(connection);

    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('falls back to audio/mpeg when the content type is unhelpful', async () => {
    client.downloadContent.mockResolvedValue({
      buffer: Buffer.from('bytes'),
      contentType: 'application/octet-stream',
    });

    await service.downloadPending(connection);

    expect(prisma.callRecord.update.mock.calls[0][0].data.recordingMimeType).toBe(
      'audio/mpeg',
    );
  });

  it('never writes a filename built from provider-supplied text', async () => {
    // The recording id comes from RingCentral. A path separator in it must not
    // be able to escape the upload directory.
    prisma.callRecord.findMany.mockResolvedValue([
      { id: 'call-1', externalRecordingId: '../../etc/passwd' },
    ]);

    await service.downloadPending(connection);

    const written = fs.writeFileSync.mock.calls[0]?.[0] as string | undefined;
    expect(written ?? '').not.toContain('..');
  });

  it('does nothing when no call is waiting on a recording', async () => {
    prisma.callRecord.findMany.mockResolvedValue([]);

    await expect(service.downloadPending(connection)).resolves.toEqual({
      downloaded: 0,
      pending: 0,
    });
    expect(client.downloadContent).not.toHaveBeenCalled();
  });
});
