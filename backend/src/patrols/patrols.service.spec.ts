import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PatrolsService } from './patrols.service';
import { CheckpointVerificationStatus } from './checkpoint-verification.constants';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('PatrolsService - geofence verification', () => {
  let service: PatrolsService;
  let prisma: {
    site: { findFirst: jest.Mock };
    checkpoint: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    patrolRun: { findFirst: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    patrolEvent: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  const TENANT_ID = 'tenant-1';
  const GUARD_ID = 'guard-1';
  const RUN_ID = 'run-1';
  const CHECKPOINT_ID = 'checkpoint-1';

  // A checkpoint at the Golden Gate Bridge with a 50m geofence.
  const geofencedCheckpoint = {
    id: CHECKPOINT_ID,
    latitude: 37.8199,
    longitude: -122.4783,
    geofenceRadiusMeters: 50,
    status: 'active',
  };

  const nonGpsCheckpoint = {
    id: CHECKPOINT_ID,
    latitude: null,
    longitude: null,
    geofenceRadiusMeters: null,
    status: 'active',
  };

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

  beforeEach(async () => {
    prisma = {
      site: { findFirst: jest.fn() },
      checkpoint: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      patrolRun: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      patrolEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatrolsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<PatrolsService>(PatrolsService);
    prisma.patrolEvent.create.mockImplementation(({ data }) => Promise.resolve(data));
    prisma.patrolEvent.update.mockImplementation(({ data }) => Promise.resolve(data));
  });

  describe('scanCheckpoint - verification outcomes', () => {
    it('marks SUCCESS when the guard scans at the exact checkpoint location', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: geofencedCheckpoint.latitude,
        longitude: geofencedCheckpoint.longitude,
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.SUCCESS);
      expect(event.distanceMeters).toBeLessThanOrEqual(1);
    });

    it('marks SUCCESS when the guard is inside the configured radius', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      // ~30m north of the checkpoint, well inside the 50m radius.
      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: geofencedCheckpoint.latitude + 0.00027,
        longitude: geofencedCheckpoint.longitude,
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.SUCCESS);
    });

    it('marks OUTSIDE_GEOFENCE when the guard is beyond the configured radius', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      // ~500m away - well outside the 50m radius.
      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: geofencedCheckpoint.latitude + 0.0045,
        longitude: geofencedCheckpoint.longitude,
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.OUTSIDE_GEOFENCE);
      expect(event.distanceMeters).toBeGreaterThan(50);
    });

    it('marks LOCATION_UNAVAILABLE when the device could not provide a location', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        status: 'completed',
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.LOCATION_UNAVAILABLE);
      expect(event.distanceMeters).toBeNull();
    });

    it('marks INVALID_LOCATION for out-of-range coordinates', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: 200,
        longitude: -122.4783,
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.INVALID_LOCATION);
    });

    it('marks NO_GEOFENCE_CONFIGURED for a checkpoint without GPS data, and the scan still succeeds', async () => {
      mockRunWithCheckpoint(nonGpsCheckpoint);

      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: 37.8199,
        longitude: -122.4783,
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.NO_GEOFENCE_CONFIGURED);
      expect(event.status).toBe('completed');
    });

    it('never trusts a client-supplied verification verdict - only raw coordinates are accepted', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      // A malicious/buggy client sending a fabricated "verified" flag and a
      // location far outside the geofence - the server must compute its own
      // result from the coordinates, not honor any extra field.
      const event = await service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, {
        latitude: geofencedCheckpoint.latitude + 0.0045,
        longitude: geofencedCheckpoint.longitude,
        // @ts-expect-error - simulating a hostile payload with fabricated verdict fields
        verificationStatus: 'SUCCESS',
        isWithinGeofence: true,
      });

      expect(event.verificationStatus).toBe(CheckpointVerificationStatus.OUTSIDE_GEOFENCE);
    });
  });

  describe('scanCheckpoint - authorization (regression)', () => {
    it('rejects scanning when no active run belongs to this guard', async () => {
      prisma.patrolRun.findFirst.mockResolvedValue(null);

      await expect(
        service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, CHECKPOINT_ID, { latitude: 1, longitude: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects scanning a checkpoint that is not part of the run route', async () => {
      mockRunWithCheckpoint(geofencedCheckpoint);

      await expect(
        service.scanCheckpoint(TENANT_ID, GUARD_ID, RUN_ID, 'some-other-checkpoint', {
          latitude: 1,
          longitude: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createCheckpoint - geofence configuration validation', () => {
    const user = { sub: 'user-1', tenantId: TENANT_ID, role: 'admin' } as ActiveUser;

    beforeEach(() => {
      prisma.site.findFirst.mockResolvedValue({ id: 'site-1', name: 'Test Site' });
      prisma.checkpoint.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...data, site: { id: 'site-1', name: 'Test Site' } }),
      );
    });

    it('rejects latitude without longitude', async () => {
      await expect(
        service.createCheckpoint(user, {
          name: 'Lobby',
          site_id: 'site-1',
          latitude: 37.8,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults the geofence radius when coordinates are given without one', async () => {
      const checkpoint = await service.createCheckpoint(user, {
        name: 'Lobby',
        site_id: 'site-1',
        latitude: 37.8,
        longitude: -122.4,
      } as never);

      expect(checkpoint.geofenceRadiusMeters).toBe(50);
    });

    it('leaves the geofence unset when no coordinates are provided (existing behavior preserved)', async () => {
      const checkpoint = await service.createCheckpoint(user, {
        name: 'Lobby',
        site_id: 'site-1',
      } as never);

      expect(checkpoint.latitude).toBeNull();
      expect(checkpoint.geofenceRadiusMeters).toBeNull();
    });
  });

  describe('updateLocation - Phase 3B live tracking', () => {
    beforeEach(() => {
      prisma.patrolRun.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: RUN_ID, ...data }),
      );
    });

    it('persists a location update for an authorized guard on an active patrol', async () => {
      prisma.patrolRun.findFirst.mockResolvedValue({ id: RUN_ID });

      const result = await service.updateLocation(TENANT_ID, GUARD_ID, RUN_ID, {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 12,
      });

      expect(prisma.patrolRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RUN_ID, tenantId: TENANT_ID, guardId: GUARD_ID, status: 'in_progress' },
        }),
      );
      expect(result.lastLatitude).toBe(37.7749);
      expect(result.lastLongitude).toBe(-122.4194);
      expect(result.lastAccuracyMeters).toBe(12);
      expect(result.lastLocationAt).toBeInstanceOf(Date);
    });

    it("rejects a location update for another guard's patrol (run not found for this guardId)", async () => {
      // The mock query is scoped by guardId - a run belonging to a different
      // guard simply won't match, exactly like the real Prisma `where` clause.
      prisma.patrolRun.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLocation(TENANT_ID, 'a-different-guard', RUN_ID, {
          latitude: 37.7749,
          longitude: -122.4194,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.patrolRun.update).not.toHaveBeenCalled();
    });

    it('rejects location updates once the patrol has ended', async () => {
      // completePatrolRun sets status to 'completed', so the in_progress
      // filter in the findFirst query no longer matches this run.
      prisma.patrolRun.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLocation(TENANT_ID, GUARD_ID, RUN_ID, { latitude: 1, longitude: 1 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.patrolRun.update).not.toHaveBeenCalled();
    });

    it('defensively rejects invalid coordinates even if they reach the service', async () => {
      prisma.patrolRun.findFirst.mockResolvedValue({ id: RUN_ID });

      await expect(
        service.updateLocation(TENANT_ID, GUARD_ID, RUN_ID, {
          // @ts-expect-error - simulating a bypass of DTO validation
          latitude: 'not-a-number',
          longitude: -122.4194,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.patrolRun.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllPatrolRuns - Phase 3B admin visibility', () => {
    const adminUser = { sub: 'admin-1', tenantId: TENANT_ID, role: 'admin' } as ActiveUser;

    it("scopes the query to the admin's own tenant, never a client-supplied tenant", async () => {
      prisma.patrolRun.findMany.mockResolvedValue([]);

      await service.findAllPatrolRuns(adminUser);

      const callArgs = prisma.patrolRun.findMany.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe(TENANT_ID);
    });

    it('filters to only in_progress runs when a status filter is requested (for the live view)', async () => {
      prisma.patrolRun.findMany.mockResolvedValue([]);

      await service.findAllPatrolRuns(adminUser, 'in_progress');

      const callArgs = prisma.patrolRun.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('in_progress');
    });

    it("returns the run's latest location fields to an authorized admin", async () => {
      prisma.patrolRun.findMany.mockResolvedValue([
        {
          id: RUN_ID,
          status: 'in_progress',
          lastLatitude: 37.7749,
          lastLongitude: -122.4194,
          lastAccuracyMeters: 10,
          lastLocationAt: new Date(),
        },
      ]);

      const runs = await service.findAllPatrolRuns(adminUser, 'in_progress');

      expect(runs[0].lastLatitude).toBe(37.7749);
      expect(runs[0].lastLocationAt).toBeInstanceOf(Date);
    });
  });
});
