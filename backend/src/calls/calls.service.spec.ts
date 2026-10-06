import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CallsService } from './calls.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { persistUpload, removeStoredFile } from '../common/object-storage.util';

jest.mock('../common/object-storage.util', () => ({
  persistUpload: jest.fn().mockResolvedValue(undefined),
  removeStoredFile: jest.fn(),
  openStoredFile: jest.fn(),
}));

describe('CallsService', () => {
  let service: CallsService;
  let prisma: {
    callRecord: Record<string, jest.Mock>;
    lead: Record<string, jest.Mock>;
    deal: Record<string, jest.Mock>;
  };
  let audit: { log: jest.Mock };

  const TENANT = 'tenant-a';

  beforeEach(async () => {
    prisma = {
      callRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      lead: { findFirst: jest.fn() },
      deal: { findFirst: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CallsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(CallsService);
    jest.clearAllMocks();
  });

  describe('logCall', () => {
    it('stores the number in E.164 regardless of how it was typed', async () => {
      prisma.callRecord.create.mockResolvedValue({
        id: 'c1',
        phoneNumber: '+14155551234',
      });

      await service.logCall(
        { phoneNumber: '+1 (415) 555-1234' },
        TENANT,
        'user-1',
      );

      expect(prisma.callRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: '+14155551234',
            tenantId: TENANT,
            outcome: 'dialed',
          }),
        }),
      );
    });

    it('rejects an unusable number before writing anything', async () => {
      await expect(
        service.logCall({ phoneNumber: 'call me maybe' }, TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.callRecord.create).not.toHaveBeenCalled();
    });

    it('refuses to attach a lead belonging to another tenant', async () => {
      // findFirst is scoped by tenantId, so another tenant's lead comes back null.
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(
        service.logCall(
          { phoneNumber: '+14155551234', leadId: 'lead-from-tenant-b' },
          TENANT,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.callRecord.create).not.toHaveBeenCalled();
    });

    it('refuses to attach a deal belonging to another tenant', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(
        service.logCall(
          { phoneNumber: '+14155551234', dealId: 'deal-from-tenant-b' },
          TENANT,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.callRecord.create).not.toHaveBeenCalled();
    });

    it('writes an audit entry for the dial', async () => {
      prisma.callRecord.create.mockResolvedValue({
        id: 'c1',
        phoneNumber: '+14155551234',
      });

      await service.logCall({ phoneNumber: '+14155551234' }, TENANT, 'user-1');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          userId: 'user-1',
          action: 'CREATE',
          entityType: 'CALL',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('does not return another tenant’s call', async () => {
      prisma.callRecord.findFirst.mockResolvedValue(null);

      await expect(service.findOne('c1', TENANT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('always scopes the query to the caller’s tenant', async () => {
      prisma.callRecord.findMany.mockResolvedValue([]);

      await service.findAll(TENANT, { leadId: 'lead-1' });

      expect(prisma.callRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            leadId: 'lead-1',
          }),
        }),
      );
    });

    it('caps an over-large limit so one request cannot pull the whole log', async () => {
      prisma.callRecord.findMany.mockResolvedValue([]);

      await service.findAll(TENANT, { limit: 100000 });

      expect(prisma.callRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });
  });

  describe('update', () => {
    it('checks tenant ownership before updating', async () => {
      prisma.callRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.update('c1', { outcome: 'connected' }, TENANT),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.callRecord.update).not.toHaveBeenCalled();
    });

    it('leaves fields the caller omitted untouched', async () => {
      prisma.callRecord.findFirst.mockResolvedValue({
        id: 'c1',
        tenantId: TENANT,
      });
      prisma.callRecord.update.mockResolvedValue({
        id: 'c1',
        phoneNumber: '+14155551234',
        outcome: 'connected',
      });

      await service.update('c1', { outcome: 'connected' }, TENANT);

      expect(prisma.callRecord.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { outcome: 'connected' },
      });
    });
  });

  describe('remove', () => {
    it('refuses to delete a call from another tenant', async () => {
      prisma.callRecord.findFirst.mockResolvedValue(null);

      await expect(service.remove('c1', TENANT)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(prisma.callRecord.delete).not.toHaveBeenCalled();
    });
  });

  describe('recordings', () => {
    const recording = (overrides: Partial<Express.Multer.File> = {}) =>
      ({
        originalname: 'call-c1.webm',
        filename: '123-abc-call-c1.webm',
        mimetype: 'audio/webm;codecs=opus',
        size: 2048,
        path: '/nonexistent/123-abc-call-c1.webm',
        ...overrides,
      }) as Express.Multer.File;

    it('refuses to attach a recording to another tenant’s call', async () => {
      prisma.callRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.attachRecording('c1', recording(), TENANT),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(persistUpload).not.toHaveBeenCalled();
      expect(prisma.callRecord.update).not.toHaveBeenCalled();
    });

    it('rejects a file whose type is not audio', async () => {
      prisma.callRecord.findFirst.mockResolvedValue({
        id: 'c1',
        tenantId: TENANT,
      });

      await expect(
        service.attachRecording(
          'c1',
          recording({
            originalname: 'notes.webm',
            mimetype: 'application/pdf',
          }),
          TENANT,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(persistUpload).not.toHaveBeenCalled();
    });

    it('stores the file before pointing the call at it, and replaces an older recording', async () => {
      prisma.callRecord.findFirst.mockResolvedValue({
        id: 'c1',
        tenantId: TENANT,
        recordingStoredFileName: 'old.webm',
      });
      prisma.callRecord.update.mockResolvedValue({
        id: 'c1',
        phoneNumber: '+14155551234',
        recordingStoredFileName: '123-abc-call-c1.webm',
      });

      const result = await service.attachRecording(
        'c1',
        recording(),
        TENANT,
        'user-1',
        95.4,
      );

      expect(persistUpload).toHaveBeenCalledWith(
        expect.any(String),
        '123-abc-call-c1.webm',
      );
      expect(prisma.callRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordingStoredFileName: '123-abc-call-c1.webm',
            recordingDurationSec: 95,
            recordingSizeBytes: 2048,
          }),
        }),
      );
      expect(removeStoredFile).toHaveBeenCalledWith(
        expect.any(String),
        'old.webm',
      );
      expect(result).toEqual(expect.objectContaining({ hasRecording: true }));
      expect(result).not.toHaveProperty('recordingStoredFileName');
    });

    it('never exposes the stored file name when listing calls', async () => {
      prisma.callRecord.findMany.mockResolvedValue([
        { id: 'c1', recordingStoredFileName: 'secret.webm' },
        { id: 'c2', recordingStoredFileName: null },
      ]);

      const rows = await service.findAll(TENANT, { hasRecording: false });

      expect(rows).toEqual([
        { id: 'c1', hasRecording: true },
        { id: 'c2', hasRecording: false },
      ]);
    });

    it('filters to recorded calls when asked', async () => {
      prisma.callRecord.findMany.mockResolvedValue([]);

      await service.findAll(TENANT, { hasRecording: true });

      expect(prisma.callRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            recordingStoredFileName: { not: null },
          }),
        }),
      );
    });

    it('removes the recording file when its call is deleted', async () => {
      prisma.callRecord.findFirst.mockResolvedValue({
        id: 'c1',
        tenantId: TENANT,
        phoneNumber: '+14155551234',
        recordingStoredFileName: 'rec.webm',
      });

      await service.remove('c1', TENANT);

      expect(removeStoredFile).toHaveBeenCalledWith(
        expect.any(String),
        'rec.webm',
      );
    });

    it('404s when a call has no recording to play', async () => {
      prisma.callRecord.findFirst.mockResolvedValue({
        id: 'c1',
        tenantId: TENANT,
        recordingStoredFileName: null,
      });

      await expect(
        service.getRecordingFile('c1', TENANT),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
