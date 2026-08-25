import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GuardComplianceService } from './guard-compliance.service';
import { ComplianceStatus } from './compliance-status.util';
import { GUARD_COMPLIANCE_TYPES } from './compliance-types.constants';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('GuardComplianceService', () => {
  let service: GuardComplianceService;
  let prisma: {
    guard: { findFirst: jest.Mock; findMany: jest.Mock };
    guardCompliance: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const TENANT_A = 'tenant-a';
  const adminA = {
    sub: 'admin-a',
    tenantId: TENANT_A,
    role: 'admin',
  } as ActiveUser;

  const guardInTenantA = {
    id: 'guard-1',
    name: 'Alex Guard',
    tenantId: TENANT_A,
    branchId: null,
  };

  beforeEach(async () => {
    prisma = {
      guard: { findFirst: jest.fn(), findMany: jest.fn() },
      guardCompliance: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardComplianceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<GuardComplianceService>(GuardComplianceService);
  });

  describe('create', () => {
    it("creates a compliance record for a guard in the caller's own tenant", async () => {
      prisma.guard.findFirst.mockResolvedValue(guardInTenantA);
      prisma.guardCompliance.create.mockResolvedValue({
        id: 'rec-1',
        guardId: 'guard-1',
        type: 'guard_license',
        documentNumber: null,
        issuingAuthority: null,
        issueDate: null,
        expirationDate: new Date('2027-01-01'),
        notes: null,
        fileName: null,
        storedFileName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(adminA, {
        guard_id: 'guard-1',
        type: 'guard_license',
      });

      expect(prisma.guard.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'guard-1', tenantId: TENANT_A }),
        }),
      );
      expect(result.guardName).toBe('Alex Guard');
      expect(result.status).toBe(ComplianceStatus.VALID);
    });

    it("rejects creating a record for another tenant's guard (guard simply not found in scope)", async () => {
      // The where clause is scoped to the caller's own tenantId, so a guard
      // belonging to a different tenant never matches - this IS the
      // cross-tenant authorization check, not a separate mechanism.
      prisma.guard.findFirst.mockResolvedValue(null);

      await expect(
        service.create(adminA, {
          guard_id: 'guard-in-tenant-b',
          type: 'guard_license',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.guardCompliance.create).not.toHaveBeenCalled();
    });

    it('rejects an expiration date before the issue date', async () => {
      prisma.guard.findFirst.mockResolvedValue(guardInTenantA);

      await expect(
        service.create(adminA, {
          guard_id: 'guard-1',
          type: 'guard_license',
          issue_date: '2026-06-01T00:00:00.000Z',
          expiration_date: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.guardCompliance.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const existingRecord = {
      id: 'rec-1',
      guardId: 'guard-1',
      type: 'guard_license',
      documentNumber: null,
      issuingAuthority: null,
      issueDate: null,
      expirationDate: new Date('2027-01-01'),
      notes: null,
      fileName: null,
      storedFileName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      guard: { id: 'guard-1', name: 'Alex Guard' },
    };

    it("updates an existing record scoped to the caller's tenant", async () => {
      prisma.guardCompliance.findFirst.mockResolvedValue(existingRecord);
      prisma.guardCompliance.update.mockResolvedValue({
        ...existingRecord,
        notes: 'Renewed',
      });

      const result = await service.update(adminA, 'rec-1', {
        notes: 'Renewed',
      });

      expect(prisma.guardCompliance.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'rec-1', tenantId: TENANT_A }),
        }),
      );
      expect(result.notes).toBe('Renewed');
    });

    it("rejects updating a record outside the caller's tenant (not found in scope)", async () => {
      prisma.guardCompliance.findFirst.mockResolvedValue(null);

      await expect(
        service.update(adminA, 'rec-in-tenant-b', { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.guardCompliance.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllForTenant - status computation and MISSING detection', () => {
    const NOW_TYPES = GUARD_COMPLIANCE_TYPES;

    it('computes VALID / EXPIRING_SOON / EXPIRED correctly for existing records', async () => {
      prisma.guard.findMany.mockResolvedValue([
        { id: 'guard-1', name: 'Alex Guard' },
      ]);
      const now = Date.now();
      prisma.guardCompliance.findMany.mockResolvedValue([
        {
          id: 'valid-rec',
          guardId: 'guard-1',
          type: 'guard_license',
          expirationDate: new Date(now + 365 * 24 * 60 * 60 * 1000),
          documentNumber: null,
          issuingAuthority: null,
          issueDate: null,
          notes: null,
          fileName: null,
          storedFileName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'expiring-rec',
          guardId: 'guard-1',
          type: 'firearm_permit',
          expirationDate: new Date(now + 5 * 24 * 60 * 60 * 1000),
          documentNumber: null,
          issuingAuthority: null,
          issueDate: null,
          notes: null,
          fileName: null,
          storedFileName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'expired-rec',
          guardId: 'guard-1',
          type: 'training_certification',
          expirationDate: new Date(now - 24 * 60 * 60 * 1000),
          documentNumber: null,
          issuingAuthority: null,
          issueDate: null,
          notes: null,
          fileName: null,
          storedFileName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const results = await service.findAllForTenant(adminA);

      expect(results.find((r) => r.id === 'valid-rec')?.status).toBe(
        ComplianceStatus.VALID,
      );
      expect(results.find((r) => r.id === 'expiring-rec')?.status).toBe(
        ComplianceStatus.EXPIRING_SOON,
      );
      expect(results.find((r) => r.id === 'expired-rec')?.status).toBe(
        ComplianceStatus.EXPIRED,
      );
    });

    it('synthesizes MISSING entries for every tracked type with no record for a guard', async () => {
      prisma.guard.findMany.mockResolvedValue([
        { id: 'guard-1', name: 'Alex Guard' },
      ]);
      prisma.guardCompliance.findMany.mockResolvedValue([]); // no records at all

      const results = await service.findAllForTenant(adminA);

      expect(results).toHaveLength(NOW_TYPES.length);
      expect(results.every((r) => r.status === ComplianceStatus.MISSING)).toBe(
        true,
      );
      expect(new Set(results.map((r) => r.type))).toEqual(new Set(NOW_TYPES));
    });

    it('does not synthesize a MISSING entry for a type that already has a record', async () => {
      prisma.guard.findMany.mockResolvedValue([
        { id: 'guard-1', name: 'Alex Guard' },
      ]);
      prisma.guardCompliance.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          guardId: 'guard-1',
          type: 'guard_license',
          expirationDate: null,
          documentNumber: null,
          issuingAuthority: null,
          issueDate: null,
          notes: null,
          fileName: null,
          storedFileName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const results = await service.findAllForTenant(adminA);

      const licenseEntries = results.filter((r) => r.type === 'guard_license');
      expect(licenseEntries).toHaveLength(1);
      expect(licenseEntries[0].status).toBe(ComplianceStatus.VALID); // real record, no expiry set
      expect(results).toHaveLength(NOW_TYPES.length); // one real + (types-1) missing
    });

    it('scopes results to the requested guard_id filter', async () => {
      prisma.guard.findMany.mockResolvedValue([
        { id: 'guard-1', name: 'Alex Guard' },
      ]);
      prisma.guardCompliance.findMany.mockResolvedValue([]);

      await service.findAllForTenant(adminA, 'guard-1');

      const guardFindManyArgs = prisma.guard.findMany.mock.calls[0][0];
      expect(guardFindManyArgs.where.id).toBe('guard-1');
    });

    it("never returns another tenant's guards, since the query is scoped to the caller's tenantId", async () => {
      prisma.guard.findMany.mockResolvedValue([]);
      prisma.guardCompliance.findMany.mockResolvedValue([]);

      await service.findAllForTenant(adminA);

      const guardFindManyArgs = prisma.guard.findMany.mock.calls[0][0];
      expect(guardFindManyArgs.where.tenantId).toBe(TENANT_A);
    });
  });
});
