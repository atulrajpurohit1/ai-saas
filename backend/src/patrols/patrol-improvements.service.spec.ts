import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PatrolsService } from './patrols.service';
import {
  CheckpointQrVerificationStatus,
  CheckpointVerificationStatus,
} from './checkpoint-verification.constants';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

// Covers the Guard Tour hardening pass: QR checkpoint-identity verification,
// QR value uniqueness, duplicate-run prevention, empty-route rejection,
// route-composition validation, patrol run status filter validation,
// guard-side audit logging, and the corrected "today" figures on the admin
// patrol overview.
describe('PatrolsService - guard tour hardening', () => {
  let service: PatrolsService;
  let audit: { log: jest.Mock };
  let prisma: {
    site: { findFirst: jest.Mock };
    checkpoint: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    patrolRoute: { findFirst: jest.Mock; findUnique: jest.Mock };
    patrolRouteCheckpoint: { deleteMany: jest.Mock; createMany: jest.Mock };
    patrolRun: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    patrolEvent: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      createMany: jest.Mock;
    };
    assignment: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const TENANT_ID = 'tenant-1';
  const GUARD_ID = 'guard-1';
  const SHIFT_ID = 'shift-1';
  const SITE_ID = 'site-1';
  const ROUTE_ID = 'route-1';
  const RUN_ID = 'run-1';
  const CHECKPOINT_ID = 'checkpoint-1';

  const adminUser = {
    sub: 'admin-1',
    tenantId: TENANT_ID,
    role: 'admin',
  } as ActiveUser;

  beforeEach(async () => {
    prisma = {
      site: { findFirst: jest.fn() },
      checkpoint: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      patrolRoute: { findFirst: jest.fn(), findUnique: jest.fn() },
      patrolRouteCheckpoint: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      patrolRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      patrolEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
      assignment: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatrolsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<PatrolsService>(PatrolsService);
    prisma.patrolEvent.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'event-1', ...data }),
    );
    prisma.patrolEvent.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'event-1', ...data }),
    );
  });

  function mockRunWithCheckpoint(checkpoint: Record<string, unknown>) {
    prisma.patrolRun.findFirst.mockResolvedValue({
      id: RUN_ID,
      tenantId: TENANT_ID,
      guardId: GUARD_ID,
      status: 'in_progress',
      patrolRoute: {
        checkpoints: [{ checkpointId: CHECKPOINT_ID, checkpoint }],
      },
    });
  }

  const qrCheckpoint = {
    id: CHECKPOINT_ID,
    name: 'Loading Bay Door',
    qrCodeValue: 'CP-LOADING-BAY-01',
    latitude: null,
    longitude: null,
    geofenceRadiusMeters: null,
    status: 'active',
  };

  // --- 1. QR checkpoint-identity verification ----------------------------

  describe('scanCheckpoint - QR verification', () => {
    it('marks SUCCESS when the decoded QR value matches the checkpoint', async () => {
      mockRunWithCheckpoint(qrCheckpoint);

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        { qr_code_value: 'CP-LOADING-BAY-01' },
      );

      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.SUCCESS,
      );
      expect(event.submittedQrValue).toBe('CP-LOADING-BAY-01');
    });

    it('tolerates surrounding whitespace and letter case from the scanner', async () => {
      mockRunWithCheckpoint(qrCheckpoint);

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        { qr_code_value: '  cp-loading-bay-01\n' },
      );

      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.SUCCESS,
      );
    });

    it('marks MISMATCH, records the scan anyway, and keeps the wrong value for review', async () => {
      mockRunWithCheckpoint(qrCheckpoint);

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        { qr_code_value: 'CP-FRONT-GATE-07' },
      );

      // Recorded, not rejected - a wrong sticker must never strand a guard.
      expect(event.status).toBe('completed');
      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.MISMATCH,
      );
      expect(event.submittedQrValue).toBe('CP-FRONT-GATE-07');
    });

    it('marks NOT_PROVIDED when the checkpoint has a QR code but none was scanned', async () => {
      mockRunWithCheckpoint(qrCheckpoint);

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        {},
      );

      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.NOT_PROVIDED,
      );
      expect(event.submittedQrValue).toBeNull();
    });

    it('marks NO_QR_CONFIGURED when the checkpoint itself has no QR code', async () => {
      mockRunWithCheckpoint({ ...qrCheckpoint, qrCodeValue: null });

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        {},
      );

      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.NO_QR_CONFIGURED,
      );
    });

    it('never accepts a verification verdict from the client body', async () => {
      mockRunWithCheckpoint(qrCheckpoint);

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        {
          qr_code_value: 'CP-WRONG',
          // Not part of ScanCheckpointDto - a hostile client trying to
          // self-certify the scan.
          qrVerificationStatus: 'SUCCESS',
        } as never,
      );

      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.MISMATCH,
      );
    });

    it('verifies QR identity independently of the geofence verdict', async () => {
      mockRunWithCheckpoint({
        ...qrCheckpoint,
        latitude: 37.8199,
        longitude: -122.4783,
        geofenceRadiusMeters: 50,
      });

      // Right sticker, but the device reported a position far from the
      // checkpoint: the two verdicts must disagree rather than collapse.
      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        {
          qr_code_value: 'CP-LOADING-BAY-01',
          latitude: 37.7749,
          longitude: -122.4194,
        },
      );

      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.SUCCESS,
      );
      expect(event.verificationStatus).toBe(
        CheckpointVerificationStatus.OUTSIDE_GEOFENCE,
      );
    });
  });

  // --- 2. QR value uniqueness -------------------------------------------

  describe('checkpoint QR value uniqueness', () => {
    beforeEach(() => {
      prisma.site.findFirst.mockResolvedValue({ id: SITE_ID, name: 'HQ' });
      prisma.checkpoint.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: CHECKPOINT_ID, ...data }),
      );
    });

    it('rejects creating a checkpoint whose QR value is already in use', async () => {
      prisma.checkpoint.findFirst.mockResolvedValue({
        id: 'other-checkpoint',
        name: 'Front Gate',
        site: { name: 'HQ' },
      });

      await expect(
        service.createCheckpoint(adminUser, {
          name: 'Loading Bay',
          site_id: SITE_ID,
          qr_code_value: 'CP-LOADING-BAY-01',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.checkpoint.create).not.toHaveBeenCalled();
    });

    it('matches an existing QR value case-insensitively within the tenant', async () => {
      prisma.checkpoint.findFirst.mockResolvedValue(null);

      await service.createCheckpoint(adminUser, {
        name: 'Loading Bay',
        site_id: SITE_ID,
        qr_code_value: '  CP-LOADING-BAY-01  ',
      });

      const where = prisma.checkpoint.findFirst.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT_ID);
      expect(where.qrCodeValue).toEqual({
        equals: 'CP-LOADING-BAY-01',
        mode: 'insensitive',
      });
      // Stored trimmed, so the stored value and a scanned value compare equal.
      expect(prisma.checkpoint.create.mock.calls[0][0].data.qrCodeValue).toBe(
        'CP-LOADING-BAY-01',
      );
    });

    it('allows any number of checkpoints with no QR code at all', async () => {
      await service.createCheckpoint(adminUser, {
        name: 'Unmarked Post',
        site_id: SITE_ID,
      });

      expect(prisma.checkpoint.findFirst).not.toHaveBeenCalled();
      expect(prisma.checkpoint.create).toHaveBeenCalled();
    });

    it('does not treat a checkpoint as clashing with its own QR value on update', async () => {
      prisma.checkpoint.findFirst
        .mockResolvedValueOnce({
          id: CHECKPOINT_ID,
          qrCodeValue: 'CP-LOADING-BAY-01',
          latitude: null,
          longitude: null,
          geofenceRadiusMeters: null,
        })
        .mockResolvedValueOnce(null);
      prisma.checkpoint.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: CHECKPOINT_ID, name: 'Loading Bay', ...data }),
      );

      await service.updateCheckpoint(adminUser, CHECKPOINT_ID, {
        qr_code_value: 'CP-LOADING-BAY-01',
      });

      const where = prisma.checkpoint.findFirst.mock.calls[1][0].where;
      expect(where.id).toEqual({ not: CHECKPOINT_ID });
    });
  });

  // --- 3 & 4. startPatrolRun guards -------------------------------------

  describe('startPatrolRun - run integrity', () => {
    beforeEach(() => {
      prisma.assignment.findFirst.mockResolvedValue({
        shiftId: SHIFT_ID,
        guardId: GUARD_ID,
        shift: { id: SHIFT_ID, siteId: SITE_ID, tenantId: TENANT_ID },
      });
      prisma.patrolRun.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: RUN_ID, ...data }),
      );
    });

    it('refuses to start a route that has no checkpoints', async () => {
      prisma.patrolRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID,
        name: 'Empty Loop',
        _count: { checkpoints: 0 },
      });

      await expect(
        service.startPatrolRun(TENANT_ID, GUARD_ID, SHIFT_ID, {
          patrol_route_id: ROUTE_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.patrolRun.create).not.toHaveBeenCalled();
    });

    it('refuses a second concurrent run on the same shift', async () => {
      prisma.patrolRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID,
        name: 'North Loop',
        _count: { checkpoints: 4 },
      });
      prisma.patrolRun.findFirst.mockResolvedValue({
        id: 'existing-run',
        patrolRoute: { name: 'South Loop' },
      });

      await expect(
        service.startPatrolRun(TENANT_ID, GUARD_ID, SHIFT_ID, {
          patrol_route_id: ROUTE_ID,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.patrolRun.create).not.toHaveBeenCalled();
    });

    it('only considers in-progress runs on THIS shift, so a stale earlier run cannot lock the guard out', async () => {
      prisma.patrolRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID,
        name: 'North Loop',
        _count: { checkpoints: 4 },
      });
      prisma.patrolRun.findFirst.mockResolvedValue(null);

      await service.startPatrolRun(TENANT_ID, GUARD_ID, SHIFT_ID, {
        patrol_route_id: ROUTE_ID,
      });

      expect(prisma.patrolRun.findFirst.mock.calls[0][0].where).toEqual({
        tenantId: TENANT_ID,
        guardId: GUARD_ID,
        shiftId: SHIFT_ID,
        status: 'in_progress',
      });
    });

    it('audit-logs the patrol start against the JWT-derived guard', async () => {
      prisma.patrolRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID,
        name: 'North Loop',
        _count: { checkpoints: 4 },
      });
      prisma.patrolRun.findFirst.mockResolvedValue(null);

      await service.startPatrolRun(TENANT_ID, GUARD_ID, SHIFT_ID, {
        patrol_route_id: ROUTE_ID,
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: GUARD_ID,
          action: 'PATROL_RUN_STARTED',
          entityType: 'PatrolRun',
          entityId: RUN_ID,
        }),
      );
    });
  });

  // --- 5. attachCheckpoints validation ----------------------------------

  describe('attachCheckpoints - route composition validation', () => {
    beforeEach(() => {
      prisma.patrolRoute.findFirst.mockResolvedValue({
        id: ROUTE_ID,
        name: 'North Loop',
        siteId: SITE_ID,
      });
      prisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => unknown) =>
          fn({
            patrolRouteCheckpoint: prisma.patrolRouteCheckpoint,
            patrolRoute: prisma.patrolRoute,
          }),
      );
    });

    it('rejects the same checkpoint listed twice instead of failing mid-transaction', async () => {
      await expect(
        service.attachCheckpoints(adminUser, ROUTE_ID, {
          checkpoints: [
            { checkpoint_id: CHECKPOINT_ID, sequence_order: 1 },
            { checkpoint_id: CHECKPOINT_ID, sequence_order: 2 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects two checkpoints sharing one position in the route order', async () => {
      await expect(
        service.attachCheckpoints(adminUser, ROUTE_ID, {
          checkpoints: [
            { checkpoint_id: 'cp-a', sequence_order: 1 },
            { checkpoint_id: 'cp-b', sequence_order: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects attaching an inactive (retired) checkpoint', async () => {
      prisma.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-a', name: 'Front Gate', status: 'active' },
        { id: 'cp-b', name: 'Old Side Door', status: 'inactive' },
      ]);

      await expect(
        service.attachCheckpoints(adminUser, ROUTE_ID, {
          checkpoints: [
            { checkpoint_id: 'cp-a', sequence_order: 1 },
            { checkpoint_id: 'cp-b', sequence_order: 2 },
          ],
        }),
      ).rejects.toThrow(/Old Side Door/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('attaches a well-formed, all-active checkpoint list', async () => {
      prisma.checkpoint.findMany.mockResolvedValue([
        { id: 'cp-a', name: 'Front Gate', status: 'active' },
        { id: 'cp-b', name: 'Loading Bay', status: 'active' },
      ]);
      prisma.patrolRoute.findUnique.mockResolvedValue({ id: ROUTE_ID });

      await service.attachCheckpoints(adminUser, ROUTE_ID, {
        checkpoints: [
          { checkpoint_id: 'cp-a', sequence_order: 1 },
          { checkpoint_id: 'cp-b', sequence_order: 2 },
        ],
      });

      expect(prisma.patrolRouteCheckpoint.createMany).toHaveBeenCalled();
    });
  });

  // --- 6. patrol run status filter validation ---------------------------

  describe('findAllPatrolRuns - status filter validation', () => {
    it('rejects an unknown status instead of silently returning nothing', async () => {
      await expect(
        service.findAllPatrolRuns(adminUser, 'in-progress'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.patrolRun.findMany).not.toHaveBeenCalled();
    });

    it('accepts every status the application writes', async () => {
      prisma.patrolRun.findMany.mockResolvedValue([]);

      for (const status of [
        'not_started',
        'in_progress',
        'active',
        'completed',
        'missed',
      ]) {
        await expect(
          service.findAllPatrolRuns(adminUser, status),
        ).resolves.toEqual([]);
      }
    });

    it('still returns every run when no filter is supplied', async () => {
      prisma.patrolRun.findMany.mockResolvedValue([]);

      await service.findAllPatrolRuns(adminUser);

      expect(
        prisma.patrolRun.findMany.mock.calls[0][0].where.status,
      ).toBeUndefined();
    });
  });

  // --- 7. guard-side audit logging --------------------------------------

  describe('guard patrol audit trail', () => {
    it('audit-logs a scan that lands outside the checkpoint geofence', async () => {
      mockRunWithCheckpoint({
        ...qrCheckpoint,
        qrCodeValue: null,
        latitude: 37.8199,
        longitude: -122.4783,
        geofenceRadiusMeters: 50,
      });

      await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: 37.7749,
        longitude: -122.4194,
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PATROL_CHECKPOINT_SCAN_FLAGGED',
          userId: GUARD_ID,
          entityType: 'PatrolEvent',
        }),
      );
      const details = audit.log.mock.calls[0][0].details as string;
      expect(details).toContain('Loading Bay Door');
      expect(details).toContain('outside the checkpoint geofence');
    });

    it('audit-logs a QR mismatch', async () => {
      mockRunWithCheckpoint(qrCheckpoint);

      await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        qr_code_value: 'CP-SOMEWHERE-ELSE',
      });

      expect(audit.log.mock.calls[0][0].details).toContain(
        'QR code did not match this checkpoint',
      );
    });

    it('does not log a clean scan, so the audit trail stays readable', async () => {
      mockRunWithCheckpoint({
        ...qrCheckpoint,
        latitude: 37.8199,
        longitude: -122.4783,
        geofenceRadiusMeters: 50,
      });

      await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        qr_code_value: 'CP-LOADING-BAY-01',
        latitude: 37.8199,
        longitude: -122.4783,
      });

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('does not log the soft outcomes, which would be one row per checkpoint per patrol', async () => {
      // A QR-configured checkpoint scanned with no code and no GPS fix:
      // verification did not happen, which the patrol log already shows.
      mockRunWithCheckpoint({
        ...qrCheckpoint,
        latitude: 37.8199,
        longitude: -122.4783,
        geofenceRadiusMeters: 50,
      });

      const event = await service.scanCheckpoint(
        TENANT_ID,
        GUARD_ID,
        RUN_ID,
        CHECKPOINT_ID,
        {},
      );

      expect(event.verificationStatus).toBe(
        CheckpointVerificationStatus.LOCATION_UNAVAILABLE,
      );
      expect(event.qrVerificationStatus).toBe(
        CheckpointQrVerificationStatus.NOT_PROVIDED,
      );
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('audit-logs patrol completion with a scanned/missed/skipped summary', async () => {
      prisma.patrolRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        tenantId: TENANT_ID,
        guardId: GUARD_ID,
        status: 'in_progress',
        patrolRoute: {
          name: 'North Loop',
          checkpoints: [
            { checkpointId: 'cp-a' },
            { checkpointId: 'cp-b' },
            { checkpointId: 'cp-c' },
          ],
        },
        events: [
          { checkpointId: 'cp-a', status: 'completed' },
          { checkpointId: 'cp-b', status: 'skipped' },
        ],
      });
      prisma.patrolRun.update.mockResolvedValue({
        id: RUN_ID,
        status: 'completed',
        events: [
          { checkpointId: 'cp-a', status: 'completed' },
          { checkpointId: 'cp-b', status: 'skipped' },
          { checkpointId: 'cp-c', status: 'missed' },
        ],
      });

      await service.completePatrolRun(TENANT_ID, GUARD_ID, RUN_ID);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PATROL_RUN_COMPLETED',
          userId: GUARD_ID,
          entityId: RUN_ID,
        }),
      );
      const details = audit.log.mock.calls[0][0].details as string;
      expect(details).toContain('1/3 checkpoints scanned');
      expect(details).toContain('1 missed');
      expect(details).toContain('1 skipped');
    });
  });

  // --- 8. corrected overview figures ------------------------------------

  describe('getPatrolOverview - "today" figures', () => {
    const todayAt = (hour: number) => {
      const d = new Date();
      d.setHours(hour, 0, 0, 0);
      return d;
    };
    const yesterdayAt = (hour: number) => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    function run(overrides: Record<string, unknown>) {
      return {
        id: RUN_ID,
        status: 'in_progress',
        startedAt: todayAt(8),
        completedAt: null,
        guard: { id: GUARD_ID, name: 'Alex Guard' },
        patrolRoute: {
          id: ROUTE_ID,
          name: 'North Loop',
          _count: { checkpoints: 3 },
        },
        shift: {
          id: SHIFT_ID,
          startTime: todayAt(8),
          endTime: todayAt(16),
          site: { id: SITE_ID, name: 'HQ' },
        },
        lastLatitude: null,
        lastLongitude: null,
        lastAccuracyMeters: null,
        lastLocationAt: null,
        events: [],
        ...overrides,
      };
    }

    it("counts an in-progress patrol's scans toward today's checkpoint total", async () => {
      prisma.patrolRun.findMany.mockResolvedValue([
        run({
          events: [
            {
              id: 'e1',
              status: 'completed',
              verificationStatus: 'SUCCESS',
              qrVerificationStatus: 'SUCCESS',
              scannedAt: todayAt(9),
            },
            {
              id: 'e2',
              status: 'completed',
              verificationStatus: 'SUCCESS',
              qrVerificationStatus: 'SUCCESS',
              scannedAt: todayAt(10),
            },
          ],
        }),
      ]);

      const overview = await service.getPatrolOverview(adminUser);

      // Previously 0: the run has no completedAt, so its scans were skipped.
      expect(overview.summary.checkpointsScannedToday).toBe(2);
      expect(overview.summary.activeRuns).toBe(1);
    });

    it("excludes yesterday's events from today's missed and geofence figures", async () => {
      prisma.patrolRun.findMany.mockResolvedValue([
        run({
          startedAt: yesterdayAt(22),
          events: [
            {
              id: 'e1',
              status: 'missed',
              verificationStatus: null,
              qrVerificationStatus: null,
              scannedAt: yesterdayAt(23),
            },
            {
              id: 'e2',
              status: 'completed',
              verificationStatus: 'OUTSIDE_GEOFENCE',
              qrVerificationStatus: null,
              scannedAt: yesterdayAt(23),
            },
            {
              id: 'e3',
              status: 'missed',
              verificationStatus: null,
              qrVerificationStatus: null,
              scannedAt: todayAt(1),
            },
          ],
        }),
      ]);

      const overview = await service.getPatrolOverview(adminUser);

      expect(overview.summary.missedCheckpointsToday).toBe(1);
      expect(overview.summary.geofenceFailuresToday).toBe(0);
    });

    it("surfaces today's QR mismatches, per run and in the summary", async () => {
      prisma.patrolRun.findMany.mockResolvedValue([
        run({
          events: [
            {
              id: 'e1',
              status: 'completed',
              verificationStatus: 'SUCCESS',
              qrVerificationStatus: 'MISMATCH',
              scannedAt: todayAt(9),
            },
            {
              id: 'e2',
              status: 'completed',
              verificationStatus: 'SUCCESS',
              qrVerificationStatus: 'SUCCESS',
              scannedAt: todayAt(10),
            },
          ],
        }),
      ]);

      const overview = await service.getPatrolOverview(adminUser);

      expect(overview.summary.qrMismatchesToday).toBe(1);
      expect(overview.activeRuns[0].qrMismatches).toBe(1);
    });
  });
});
