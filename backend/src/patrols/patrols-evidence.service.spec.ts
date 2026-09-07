import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PatrolsService } from './patrols.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { patrolEvidenceImageMaxBytes } from '../common/file-storage.util';

// Phase 3H - security-focused tests for checkpoint photo evidence. Every
// tenant / patrol / checkpoint / guard decision is made server-side from the
// authenticated identity; the request body / file never carries authority.

// Pulls the `where` clause of the first call to a mocked Prisma finder so the
// authorization scoping can be asserted without repeating the loose-typed
// mock.calls indexing at every call site.
function firstCallWhere(mock: jest.Mock): Record<string, unknown> {
  const calls = mock.mock.calls as unknown as Array<
    [{ where?: Record<string, unknown> }?]
  >;
  return calls[0]?.[0]?.where ?? {};
}

describe('PatrolsService - checkpoint evidence (Phase 3H)', () => {
  let service: PatrolsService;
  let prisma: {
    patrolEvent: { findFirst: jest.Mock };
    patrolEvidence: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };

  const TENANT_A = 'tenant-a';
  const GUARD_A = 'guard-a';
  const RUN_A = 'run-a';
  const EVENT_A = 'event-a';

  const adminA = {
    sub: 'admin-a',
    tenantId: TENANT_A,
    role: 'admin',
    isSuperAdmin: true,
  } as ActiveUser;

  const photoFile = (over: Partial<Express.Multer.File> = {}) =>
    ({
      originalname: 'checkpoint.jpg',
      mimetype: 'image/jpeg',
      filename: '1700000000000-abc123-checkpoint.jpg',
      size: 2048,
      ...over,
    }) as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      patrolEvent: { findFirst: jest.fn() },
      patrolEvidence: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatrolsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(PatrolsService);
  });

  const eventInScope = () =>
    prisma.patrolEvent.findFirst.mockResolvedValue({
      id: EVENT_A,
      patrolRunId: RUN_A,
      checkpoint: { name: 'Lobby' },
    });
  const eventOutOfScope = () =>
    prisma.patrolEvent.findFirst.mockResolvedValue(null);

  describe('addCheckpointEvidenceForGuard', () => {
    it('stores an authorized photo and links it to the correct event / run / guard / tenant', async () => {
      eventInScope();
      prisma.patrolEvidence.create.mockImplementation(
        (args: { data: Record<string, unknown> }) => ({
          id: 'ev-1',
          createdAt: new Date(),
          ...args.data,
        }),
      );

      const result = await service.addCheckpointEvidenceForGuard(
        TENANT_A,
        GUARD_A,
        RUN_A,
        EVENT_A,
        photoFile(),
      );

      expect(prisma.patrolEvidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            patrolEventId: EVENT_A,
            patrolRunId: RUN_A,
            guardId: GUARD_A,
            mediaType: 'image',
            mimeType: 'image/jpeg',
            fileName: 'checkpoint.jpg',
            storedFileName: '1700000000000-abc123-checkpoint.jpg',
            uploadedById: GUARD_A,
          }),
        }),
      );
      // The upload query is the authorization gate: it pins guardId, tenantId,
      // the run id AND an in_progress run.
      const whereArg = firstCallWhere(prisma.patrolEvent.findFirst);
      expect(whereArg).toMatchObject({
        id: EVENT_A,
        tenantId: TENANT_A,
        guardId: GUARD_A,
        patrolRunId: RUN_A,
        patrolRun: {
          tenantId: TENANT_A,
          guardId: GUARD_A,
          status: 'in_progress',
        },
      });
      // storedFileName must never be serialized back to a client
      expect(result).not.toHaveProperty('storedFileName');
      expect(result.mediaType).toBe('image');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PATROL_EVIDENCE_UPLOADED' }),
      );
    });

    it("rejects attaching evidence to another guard's / tenant's / run's event", async () => {
      eventOutOfScope();

      await expect(
        service.addCheckpointEvidenceForGuard(
          TENANT_A,
          GUARD_A,
          RUN_A,
          'event-elsewhere',
          photoFile(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.patrolEvidence.create).not.toHaveBeenCalled();
    });

    it('rejects a non-image / disguised file', async () => {
      eventInScope();

      await expect(
        service.addCheckpointEvidenceForGuard(
          TENANT_A,
          GUARD_A,
          RUN_A,
          EVENT_A,
          photoFile({ originalname: 'clip.mp4', mimetype: 'video/mp4' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.addCheckpointEvidenceForGuard(
          TENANT_A,
          GUARD_A,
          RUN_A,
          EVENT_A,
          photoFile({
            originalname: 'shell.png',
            mimetype: 'application/x-msdownload',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.patrolEvidence.create).not.toHaveBeenCalled();
    });

    it('rejects an oversized photo', async () => {
      eventInScope();

      await expect(
        service.addCheckpointEvidenceForGuard(
          TENANT_A,
          GUARD_A,
          RUN_A,
          EVENT_A,
          photoFile({ size: patrolEvidenceImageMaxBytes() + 1 }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.patrolEvidence.create).not.toHaveBeenCalled();
    });
  });

  describe('listCheckpointEvidenceForAdmin', () => {
    it('scopes the query to the tenant + event once branch-scoped access is confirmed', async () => {
      prisma.patrolEvent.findFirst.mockResolvedValue({
        id: EVENT_A,
        patrolRunId: RUN_A,
        checkpoint: { name: 'Lobby' },
      });
      prisma.patrolEvidence.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          patrolEventId: EVENT_A,
          patrolRunId: RUN_A,
          guardId: GUARD_A,
          mediaType: 'image',
          mimeType: 'image/jpeg',
          fileName: 'checkpoint.jpg',
          storedFileName: 'secret-on-disk.jpg',
          fileSizeBytes: 10,
          uploadedById: GUARD_A,
          createdAt: new Date(),
        },
      ]);

      const rows = await service.listCheckpointEvidenceForAdmin(
        adminA,
        RUN_A,
        EVENT_A,
      );

      expect(prisma.patrolEvidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, patrolEventId: EVENT_A },
        }),
      );
      expect(rows[0]).not.toHaveProperty('storedFileName');
    });

    it('refuses to list evidence for an event the admin cannot see (tenant/branch)', async () => {
      prisma.patrolEvent.findFirst.mockResolvedValue(null);
      await expect(
        service.listCheckpointEvidenceForAdmin(adminA, RUN_A, 'event-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.patrolEvidence.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getCheckpointEvidenceFileForAdmin', () => {
    it('refuses to stream a file for an out-of-scope event', async () => {
      prisma.patrolEvent.findFirst.mockResolvedValue(null);
      await expect(
        service.getCheckpointEvidenceFileForAdmin(
          adminA,
          RUN_A,
          'event-x',
          'ev-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the evidence id is not on that event even if the event is in scope', async () => {
      prisma.patrolEvent.findFirst.mockResolvedValue({
        id: EVENT_A,
        patrolRunId: RUN_A,
        checkpoint: { name: 'Lobby' },
      });
      prisma.patrolEvidence.findFirst.mockResolvedValue(null);
      await expect(
        service.getCheckpointEvidenceFileForAdmin(
          adminA,
          RUN_A,
          EVENT_A,
          'ev-elsewhere',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('guard read access', () => {
    it('rejects a guard listing evidence on an event that is not theirs', async () => {
      prisma.patrolEvent.findFirst.mockResolvedValue(null);
      await expect(
        service.listCheckpointEvidenceForGuard(
          TENANT_A,
          GUARD_A,
          RUN_A,
          EVENT_A,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.patrolEvidence.findMany).not.toHaveBeenCalled();
    });

    it('lets a guard list evidence on their own event (no in_progress requirement for reads)', async () => {
      prisma.patrolEvent.findFirst.mockResolvedValue({ id: EVENT_A });
      prisma.patrolEvidence.findMany.mockResolvedValue([]);

      await service.listCheckpointEvidenceForGuard(
        TENANT_A,
        GUARD_A,
        RUN_A,
        EVENT_A,
      );

      const whereArg = firstCallWhere(prisma.patrolEvent.findFirst);
      expect(whereArg).toEqual({
        id: EVENT_A,
        tenantId: TENANT_A,
        guardId: GUARD_A,
        patrolRunId: RUN_A,
      });
    });
  });
});
