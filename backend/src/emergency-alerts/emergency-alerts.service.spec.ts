import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmergencyAlertsService } from './emergency-alerts.service';
import { EmergencyAlertStatus } from './emergency-alert-status.util';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('EmergencyAlertsService', () => {
  let service: EmergencyAlertsService;
  let prisma: {
    guard: { findFirst: jest.Mock };
    patrolRun: { findFirst: jest.Mock };
    emergencyAlert: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: { log: jest.Mock };

  const TENANT_A = 'tenant-a';
  const GUARD_A = 'guard-a';
  const adminA = {
    sub: 'admin-a',
    tenantId: TENANT_A,
    role: 'admin',
  } as ActiveUser;

  const baseAlertRow = {
    id: 'alert-1',
    tenantId: TENANT_A,
    guardId: GUARD_A,
    branchId: null,
    patrolRunId: null,
    status: EmergencyAlertStatus.ACTIVE,
    triggeredAt: new Date(),
    acknowledgedAt: null,
    resolvedAt: null,
    acknowledgedById: null,
    resolvedById: null,
    notes: null,
    lastLatitude: null,
    lastLongitude: null,
    lastAccuracyMeters: null,
    locationCapturedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    guard: { id: GUARD_A, name: 'Alex Guard', phone: null },
    branch: null,
    patrolRun: null,
    acknowledgedBy: null,
    resolvedBy: null,
  };

  beforeEach(async () => {
    prisma = {
      guard: { findFirst: jest.fn() },
      patrolRun: { findFirst: jest.fn() },
      emergencyAlert: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyAlertsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<EmergencyAlertsService>(EmergencyAlertsService);
  });

  describe('triggerForGuard', () => {
    it('creates an ACTIVE alert associated with the authenticated guard, with tenant derived from the caller (not the client)', async () => {
      prisma.guard.findFirst.mockResolvedValue({
        id: GUARD_A,
        name: 'Alex Guard',
        branchId: null,
      });
      prisma.emergencyAlert.findFirst.mockResolvedValue(null); // no existing active alert
      prisma.patrolRun.findFirst.mockResolvedValue(null); // no active patrol
      prisma.emergencyAlert.create.mockResolvedValue(baseAlertRow);

      const result = await service.triggerForGuard(TENANT_A, GUARD_A);

      expect(prisma.emergencyAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            guardId: GUARD_A,
            status: EmergencyAlertStatus.ACTIVE,
          }),
        }),
      );
      expect(result.guard?.id).toBe(GUARD_A);
      expect(result.status).toBe(EmergencyAlertStatus.ACTIVE);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_A,
          userId: GUARD_A,
          action: 'EMERGENCY_ALERT_TRIGGERED',
          entityId: 'alert-1',
        }),
      );
    });

    it("rejects triggering for a guardId that doesn't resolve within the caller's own tenant", async () => {
      prisma.guard.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerForGuard(TENANT_A, 'guard-in-tenant-b'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.emergencyAlert.create).not.toHaveBeenCalled();
    });

    it("associates the alert with the guard's active (in_progress) patrol run and copies its location snapshot", async () => {
      prisma.guard.findFirst.mockResolvedValue({
        id: GUARD_A,
        name: 'Alex Guard',
        branchId: null,
      });
      prisma.emergencyAlert.findFirst.mockResolvedValue(null);
      const locationAt = new Date();
      prisma.patrolRun.findFirst.mockResolvedValue({
        id: 'run-1',
        lastLatitude: 12.34,
        lastLongitude: 56.78,
        lastAccuracyMeters: 8,
        lastLocationAt: locationAt,
      });
      prisma.emergencyAlert.create.mockResolvedValue({
        ...baseAlertRow,
        patrolRunId: 'run-1',
        lastLatitude: 12.34,
        lastLongitude: 56.78,
        lastAccuracyMeters: 8,
        locationCapturedAt: locationAt,
      });

      const result = await service.triggerForGuard(TENANT_A, GUARD_A);

      expect(prisma.emergencyAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patrolRunId: 'run-1',
            lastLatitude: 12.34,
            lastLongitude: 56.78,
            lastAccuracyMeters: 8,
            locationCapturedAt: locationAt,
          }),
        }),
      );
      expect(result.location).toEqual({
        latitude: 12.34,
        longitude: 56.78,
        accuracyMeters: 8,
        capturedAt: locationAt,
      });
    });

    it('still creates the alert when the guard has no active patrol and no location is known', async () => {
      prisma.guard.findFirst.mockResolvedValue({
        id: GUARD_A,
        name: 'Alex Guard',
        branchId: null,
      });
      prisma.emergencyAlert.findFirst.mockResolvedValue(null);
      prisma.patrolRun.findFirst.mockResolvedValue(null);
      prisma.emergencyAlert.create.mockResolvedValue(baseAlertRow);

      const result = await service.triggerForGuard(TENANT_A, GUARD_A);

      expect(prisma.emergencyAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patrolRunId: null,
            lastLatitude: null,
            lastLongitude: null,
          }),
        }),
      );
      expect(result.status).toBe(EmergencyAlertStatus.ACTIVE);
      expect(result.location).toBeNull();
    });

    it('is idempotent: returns the existing ACTIVE alert instead of creating a duplicate on a rapid repeat trigger', async () => {
      prisma.guard.findFirst.mockResolvedValue({
        id: GUARD_A,
        name: 'Alex Guard',
        branchId: null,
      });
      prisma.emergencyAlert.findFirst.mockResolvedValue(baseAlertRow);

      const result = await service.triggerForGuard(TENANT_A, GUARD_A);

      expect(prisma.emergencyAlert.create).not.toHaveBeenCalled();
      expect(result.id).toBe('alert-1');
    });
  });

  describe('findAllForAdmin - tenant isolation', () => {
    it("scopes the query to the caller's own tenantId", async () => {
      prisma.emergencyAlert.findMany.mockResolvedValue([]);

      await service.findAllForAdmin(adminA);

      const args = prisma.emergencyAlert.findMany.mock.calls[0][0] as {
        where: { tenantId: string };
      };
      expect(args.where.tenantId).toBe(TENANT_A);
    });
  });

  describe('acknowledge', () => {
    it('allows an authorized admin to acknowledge an ACTIVE alert and records who/when', async () => {
      prisma.emergencyAlert.findFirst.mockResolvedValue(baseAlertRow);
      const acknowledgedAt = new Date();
      prisma.emergencyAlert.update.mockResolvedValue({
        ...baseAlertRow,
        status: EmergencyAlertStatus.ACKNOWLEDGED,
        acknowledgedAt,
        acknowledgedById: adminA.sub,
      });

      const result = await service.acknowledge(adminA, 'alert-1', {});

      expect(prisma.emergencyAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmergencyAlertStatus.ACKNOWLEDGED,
            acknowledgedById: adminA.sub,
          }),
        }),
      );
      expect(result.status).toBe(EmergencyAlertStatus.ACKNOWLEDGED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EMERGENCY_ALERT_ACKNOWLEDGED',
          userId: adminA.sub,
        }),
      );
    });

    it('rejects acknowledging an alert that is not ACTIVE (invalid transition)', async () => {
      prisma.emergencyAlert.findFirst.mockResolvedValue({
        ...baseAlertRow,
        status: EmergencyAlertStatus.RESOLVED,
      });

      await expect(service.acknowledge(adminA, 'alert-1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.emergencyAlert.update).not.toHaveBeenCalled();
    });

    it("rejects acknowledging an alert outside the caller's tenant/branch scope (not found)", async () => {
      prisma.emergencyAlert.findFirst.mockResolvedValue(null);

      await expect(
        service.acknowledge(adminA, 'alert-in-tenant-b', {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.emergencyAlert.update).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('allows an authorized admin to resolve an ACKNOWLEDGED alert and records who/when', async () => {
      prisma.emergencyAlert.findFirst.mockResolvedValue({
        ...baseAlertRow,
        status: EmergencyAlertStatus.ACKNOWLEDGED,
      });
      const resolvedAt = new Date();
      prisma.emergencyAlert.update.mockResolvedValue({
        ...baseAlertRow,
        status: EmergencyAlertStatus.RESOLVED,
        resolvedAt,
        resolvedById: adminA.sub,
      });

      const result = await service.resolve(adminA, 'alert-1', {
        notes: 'False alarm, guard confirmed safe.',
      });

      expect(prisma.emergencyAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: EmergencyAlertStatus.RESOLVED,
            resolvedById: adminA.sub,
            notes: 'False alarm, guard confirmed safe.',
          }),
        }),
      );
      expect(result.status).toBe(EmergencyAlertStatus.RESOLVED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EMERGENCY_ALERT_RESOLVED',
          userId: adminA.sub,
        }),
      );
    });

    it('rejects resolving an alert that is still ACTIVE (must be acknowledged first)', async () => {
      prisma.emergencyAlert.findFirst.mockResolvedValue(baseAlertRow);

      await expect(service.resolve(adminA, 'alert-1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.emergencyAlert.update).not.toHaveBeenCalled();
    });
  });
});
