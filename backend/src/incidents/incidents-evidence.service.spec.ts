import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { IncidentsService } from './incidents.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { incidentEvidenceImageMaxBytes } from '../common/file-storage.util';

// Phase 3F - security-focused tests for incident evidence attachments. All
// tenant / branch / incident-ownership decisions are made server-side from
// the authenticated user; the request body / file never carries authority.
describe('IncidentsService - evidence (Phase 3F)', () => {
  let service: IncidentsService;
  let prisma: {
    $queryRaw: jest.Mock;
    incidentEvidence: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };

  const TENANT_A = 'tenant-a';
  const adminA = {
    sub: 'admin-a',
    tenantId: TENANT_A,
    role: 'admin',
    isSuperAdmin: true,
  } as ActiveUser;

  const imageFile = (over: Partial<Express.Multer.File> = {}) =>
    ({
      originalname: 'scene.jpg',
      mimetype: 'image/jpeg',
      filename: '1700000000000-abc123-scene.jpg',
      size: 1024,
      ...over,
    }) as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      incidentEvidence: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: WebhooksService, useValue: { triggerEvent: jest.fn() } },
      ],
    }).compile();

    service = module.get(IncidentsService);
  });

  const incidentInScope = () =>
    prisma.$queryRaw.mockResolvedValue([{ id: 'inc-1', title: 'Break-in' }]);
  const incidentOutOfScope = () => prisma.$queryRaw.mockResolvedValue([]);

  describe('addEvidenceForAdmin', () => {
    it('stores authorized image evidence and associates it with the incident', async () => {
      incidentInScope();
      prisma.incidentEvidence.create.mockImplementation(({ data }) => ({
        id: 'ev-1',
        createdAt: new Date(),
        ...data,
      }));

      const result = await service.addEvidenceForAdmin(
        adminA,
        'inc-1',
        imageFile(),
      );

      expect(prisma.incidentEvidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            incidentId: 'inc-1',
            mediaType: 'image',
            mimeType: 'image/jpeg',
            fileName: 'scene.jpg',
            storedFileName: '1700000000000-abc123-scene.jpg',
            uploadedById: 'admin-a',
          }),
        }),
      );
      // storedFileName must never be serialized back to a client
      expect(result).not.toHaveProperty('storedFileName');
      expect(result.mediaType).toBe('image');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_EVIDENCE_UPLOADED' }),
      );
    });

    it("rejects attaching evidence to an incident outside the caller's tenant/branch", async () => {
      incidentOutOfScope();

      await expect(
        service.addEvidenceForAdmin(adminA, 'inc-other-tenant', imageFile()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.incidentEvidence.create).not.toHaveBeenCalled();
    });

    it('rejects a disallowed MIME type / disguised file', async () => {
      incidentInScope();

      await expect(
        service.addEvidenceForAdmin(
          adminA,
          'inc-1',
          imageFile({ originalname: 'shell.png', mimetype: 'application/x-msdownload' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.incidentEvidence.create).not.toHaveBeenCalled();
    });

    it('rejects an oversized image', async () => {
      incidentInScope();

      await expect(
        service.addEvidenceForAdmin(
          adminA,
          'inc-1',
          imageFile({ size: incidentEvidenceImageMaxBytes() + 1 }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.incidentEvidence.create).not.toHaveBeenCalled();
    });
  });

  describe('listEvidenceForAdmin', () => {
    it('scopes the query to the tenant and incident once access is confirmed', async () => {
      incidentInScope();
      prisma.incidentEvidence.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          incidentId: 'inc-1',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          fileName: 'scene.jpg',
          storedFileName: 'secret-on-disk.jpg',
          fileSizeBytes: 10,
          uploadedById: 'admin-a',
          createdAt: new Date(),
        },
      ]);

      const rows = await service.listEvidenceForAdmin(adminA, 'inc-1');

      expect(prisma.incidentEvidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, incidentId: 'inc-1' },
        }),
      );
      expect(rows[0]).not.toHaveProperty('storedFileName');
    });

    it('refuses to list evidence for an incident the caller cannot see', async () => {
      incidentOutOfScope();
      await expect(
        service.listEvidenceForAdmin(adminA, 'inc-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.incidentEvidence.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvidenceForAdmin', () => {
    it('rejects deletion when the incident is out of scope', async () => {
      incidentOutOfScope();
      await expect(
        service.deleteEvidenceForAdmin(adminA, 'inc-x', 'ev-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.incidentEvidence.delete).not.toHaveBeenCalled();
    });

    it('rejects deletion of an evidence id that is not on that incident', async () => {
      incidentInScope();
      prisma.incidentEvidence.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteEvidenceForAdmin(adminA, 'inc-1', 'ev-elsewhere'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.incidentEvidence.delete).not.toHaveBeenCalled();
    });

    it('deletes evidence and writes an audit entry', async () => {
      incidentInScope();
      prisma.incidentEvidence.findFirst.mockResolvedValue({
        id: 'ev-1',
        incidentId: 'inc-1',
        mediaType: 'image',
        storedFileName: 'x.jpg',
      });

      const res = await service.deleteEvidenceForAdmin(adminA, 'inc-1', 'ev-1');

      expect(res).toEqual({ success: true });
      expect(prisma.incidentEvidence.delete).toHaveBeenCalledWith({
        where: { id: 'ev-1' },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INCIDENT_EVIDENCE_DELETED' }),
      );
    });
  });

  describe('client access', () => {
    it("rejects listing evidence for an incident that is not the client's approved incident", async () => {
      prisma.$queryRaw.mockResolvedValue([]); // approved + client_id gate fails

      await expect(
        service.listEvidenceForClient(TENANT_A, 'client-1', 'cu-1', 'inc-9'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.incidentEvidence.findMany).not.toHaveBeenCalled();
    });

    it('lists evidence once the approved + owned-site gate passes', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'inc-1', title: 'ok' }]);
      prisma.incidentEvidence.findMany.mockResolvedValue([]);

      await service.listEvidenceForClient(TENANT_A, 'client-1', 'cu-1', 'inc-1');

      expect(prisma.incidentEvidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, incidentId: 'inc-1' },
        }),
      );
    });

    it('rejects fetching an evidence file for an incident the client cannot see', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(
        service.getEvidenceFileForClient(TENANT_A, 'client-1', 'inc-9', 'ev-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
