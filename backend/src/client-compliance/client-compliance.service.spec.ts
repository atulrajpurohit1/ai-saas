import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ComplianceStatus } from '../guard-compliance/compliance-status.util';
import { clientInsuranceUploadMaxBytes } from '../common/file-storage.util';
import { ClientComplianceService } from './client-compliance.service';

const DAY = 24 * 60 * 60 * 1000;

describe('ClientComplianceService (Phase 3G)', () => {
  let service: ClientComplianceService;
  let prisma: {
    client: { findFirst: jest.Mock; findMany: jest.Mock };
    site: { findFirst: jest.Mock };
    clientInsurancePolicy: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };

  const TENANT_A = 'tenant-a';
  const superAdminA = {
    sub: 'admin-a',
    tenantId: TENANT_A,
    role: 'admin',
    isSuperAdmin: true,
  } as ActiveUser;
  const branchAdminA = {
    sub: 'badmin-a',
    tenantId: TENANT_A,
    role: 'admin',
    isSuperAdmin: false,
    branchId: 'branch-1',
  } as ActiveUser;

  const clientA = { id: 'client-1', name: 'Acme Corp' };

  const policyFile = (over: Partial<Express.Multer.File> = {}) =>
    ({
      originalname: 'coi.pdf',
      mimetype: 'application/pdf',
      filename: '1700000000000-abc123-coi.pdf',
      size: 2048,
      ...over,
    }) as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      client: { findFirst: jest.fn(), findMany: jest.fn() },
      site: { findFirst: jest.fn() },
      clientInsurancePolicy: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientComplianceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(ClientComplianceService);
  });

  // ---- create --------------------------------------------------------

  describe('create', () => {
    it('creates a client-wide policy (null siteId) for a client in scope', async () => {
      prisma.client.findFirst.mockResolvedValue(clientA);
      prisma.clientInsurancePolicy.create.mockImplementation(({ data }) => ({
        id: 'pol-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        site: null,
        ...data,
      }));

      const result = await service.create(superAdminA, {
        client_id: 'client-1',
        type: 'general_liability',
        expiration_date: new Date(Date.now() + 200 * DAY).toISOString(),
      });

      expect(prisma.site.findFirst).not.toHaveBeenCalled();
      expect(prisma.clientInsurancePolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            clientId: 'client-1',
            siteId: null,
            type: 'general_liability',
            createdBy: 'admin-a',
          }),
        }),
      );
      expect(result.scope).toBe('client_wide');
      expect(result.status).toBe(ComplianceStatus.VALID);
      expect(result).not.toHaveProperty('storedFileName');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_INSURANCE_POLICY_CREATED' }),
      );
    });

    it('creates a site-specific policy after validating the site belongs to the client', async () => {
      prisma.client.findFirst.mockResolvedValue(clientA);
      prisma.site.findFirst.mockResolvedValue({ id: 'site-9' });
      prisma.clientInsurancePolicy.create.mockImplementation(({ data }) => ({
        id: 'pol-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        site: { name: 'North Gate' },
        ...data,
      }));

      const result = await service.create(superAdminA, {
        client_id: 'client-1',
        site_id: 'site-9',
        type: 'certificate_of_insurance',
      });

      expect(prisma.site.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'site-9',
            tenantId: TENANT_A,
            clientId: 'client-1',
          }),
        }),
      );
      expect(result.scope).toBe('site');
      expect(result.siteId).toBe('site-9');
    });

    it("rejects a site that does not belong to the target client", async () => {
      prisma.client.findFirst.mockResolvedValue(clientA);
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.create(superAdminA, {
          client_id: 'client-1',
          site_id: 'someone-elses-site',
          type: 'general_liability',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.clientInsurancePolicy.create).not.toHaveBeenCalled();
    });

    it("rejects creating a policy for another tenant's client (not found in scope)", async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create(superAdminA, {
          client_id: 'client-in-tenant-b',
          type: 'general_liability',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.clientInsurancePolicy.create).not.toHaveBeenCalled();
    });

    it('scopes the client lookup to the branch for a non-super-admin (cross-branch rejected)', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create(branchAdminA, {
          client_id: 'client-in-other-branch',
          type: 'general_liability',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const whereArg = prisma.client.findFirst.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      // branchWhere() injects an OR branch filter for a branch-scoped admin
      expect(whereArg.OR).toEqual([
        { branchId: 'branch-1' },
        { branchId: null },
      ]);
    });

    it('rejects an expiration date before the effective date', async () => {
      prisma.client.findFirst.mockResolvedValue(clientA);

      await expect(
        service.create(superAdminA, {
          client_id: 'client-1',
          type: 'general_liability',
          effective_date: '2027-01-01T00:00:00.000Z',
          expiration_date: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.clientInsurancePolicy.create).not.toHaveBeenCalled();
    });
  });

  // ---- findAll: status + MISSING synthesis + scoping ----------------

  describe('findAll', () => {
    const basePolicy = {
      clientId: 'client-1',
      siteId: null,
      policyNumber: null,
      insurer: null,
      coverageAmount: null,
      effectiveDate: null,
      notes: null,
      fileName: null,
      storedFileName: 'internal-secret.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
      site: null,
    };

    it('derives VALID / EXPIRING_SOON / EXPIRED for real policies', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme' }]);
      prisma.clientInsurancePolicy.findMany.mockResolvedValue([
        { ...basePolicy, id: 'p-valid', type: 'general_liability', expirationDate: new Date(Date.now() + 200 * DAY) },
        { ...basePolicy, id: 'p-soon', type: 'workers_comp', expirationDate: new Date(Date.now() + 10 * DAY) },
        { ...basePolicy, id: 'p-exp', type: 'certificate_of_insurance', expirationDate: new Date(Date.now() - DAY) },
      ]);

      const rows = await service.findAll(superAdminA);

      expect(rows.find((r) => r.id === 'p-valid')?.status).toBe(ComplianceStatus.VALID);
      expect(rows.find((r) => r.id === 'p-soon')?.status).toBe(ComplianceStatus.EXPIRING_SOON);
      expect(rows.find((r) => r.id === 'p-exp')?.status).toBe(ComplianceStatus.EXPIRED);
      // storedFileName never serialized
      rows.forEach((r) => expect(r).not.toHaveProperty('storedFileName'));
    });

    it('synthesizes a MISSING row for every required type with no policy', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme' }]);
      prisma.clientInsurancePolicy.findMany.mockResolvedValue([]);

      const rows = await service.findAll(superAdminA);

      expect(rows).toHaveLength(3); // GL, WC, COI
      expect(rows.every((r) => r.status === ComplianceStatus.MISSING)).toBe(true);
      expect(new Set(rows.map((r) => r.type))).toEqual(
        new Set(['general_liability', 'workers_comp', 'certificate_of_insurance']),
      );
    });

    it('does not synthesize MISSING for a type that already has a policy', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme' }]);
      prisma.clientInsurancePolicy.findMany.mockResolvedValue([
        { ...basePolicy, id: 'p1', type: 'general_liability', expirationDate: null },
      ]);

      const rows = await service.findAll(superAdminA);

      expect(rows.filter((r) => r.type === 'general_liability')).toHaveLength(1);
      expect(rows).toHaveLength(3); // 1 real + 2 synthesized (WC, COI)
    });

    it('scopes the policy query to the tenant and the in-scope client ids', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme' }]);
      prisma.clientInsurancePolicy.findMany.mockResolvedValue([]);

      await service.findAll(superAdminA, { clientId: 'client-1' });

      const clientWhere = prisma.client.findMany.mock.calls[0][0].where;
      expect(clientWhere.tenantId).toBe(TENANT_A);
      expect(clientWhere.id).toBe('client-1');

      const policyWhere = prisma.clientInsurancePolicy.findMany.mock.calls[0][0].where;
      expect(policyWhere.tenantId).toBe(TENANT_A);
      expect(policyWhere.clientId).toEqual({ in: ['client-1'] });
    });

    it('applies a status filter after synthesis', async () => {
      prisma.client.findMany.mockResolvedValue([{ id: 'client-1', name: 'Acme' }]);
      prisma.clientInsurancePolicy.findMany.mockResolvedValue([
        { ...basePolicy, id: 'p-valid', type: 'general_liability', expirationDate: new Date(Date.now() + 200 * DAY) },
      ]);

      const rows = await service.findAll(superAdminA, { status: 'MISSING' });
      expect(rows.every((r) => r.status === ComplianceStatus.MISSING)).toBe(true);
      expect(rows.map((r) => r.type).sort()).toEqual(['certificate_of_insurance', 'workers_comp']);
    });

    it('returns nothing (no leakage) when the tenant has no clients in scope', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      const rows = await service.findAll(superAdminA);
      expect(rows).toEqual([]);
      expect(prisma.clientInsurancePolicy.findMany).not.toHaveBeenCalled();
    });
  });

  // ---- document upload validation ---------------------------------

  describe('attachDocument', () => {
    const scopedRecord = {
      id: 'pol-1',
      clientId: 'client-1',
      siteId: null,
      type: 'certificate_of_insurance',
      storedFileName: null,
      client: { id: 'client-1', name: 'Acme' },
    };

    it('rejects a disallowed / disguised file type', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(scopedRecord);

      await expect(
        service.attachDocument(
          superAdminA,
          'pol-1',
          policyFile({ originalname: 'x.png', mimetype: 'application/x-msdownload' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.clientInsurancePolicy.update).not.toHaveBeenCalled();
    });

    it('rejects an oversized document', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(scopedRecord);

      await expect(
        service.attachDocument(
          superAdminA,
          'pol-1',
          policyFile({ size: clientInsuranceUploadMaxBytes() + 1 }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.clientInsurancePolicy.update).not.toHaveBeenCalled();
    });

    it('rejects uploading to a policy outside the caller scope', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(null);
      await expect(
        service.attachDocument(superAdminA, 'pol-other', policyFile()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stores fileName + storedFileName for a valid PDF', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(scopedRecord);
      prisma.clientInsurancePolicy.update.mockResolvedValue({
        ...scopedRecord,
        fileName: 'coi.pdf',
        storedFileName: '1700000000000-abc123-coi.pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
        expirationDate: null,
        effectiveDate: null,
        coverageAmount: null,
        insurer: null,
        policyNumber: null,
        notes: null,
        site: null,
      });

      const result = await service.attachDocument(superAdminA, 'pol-1', policyFile());

      expect(prisma.clientInsurancePolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pol-1' },
          data: { fileName: 'coi.pdf', storedFileName: '1700000000000-abc123-coi.pdf' },
        }),
      );
      expect(result.hasDocument).toBe(true);
      expect(result).not.toHaveProperty('storedFileName');
    });
  });

  // ---- delete / secure document access ---------------------------

  describe('remove & document access', () => {
    it('rejects deleting a policy outside the caller scope', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(null);
      await expect(
        service.remove(superAdminA, 'pol-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.clientInsurancePolicy.delete).not.toHaveBeenCalled();
    });

    it('rejects downloading a document for an out-of-scope policy', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(null);
      await expect(
        service.getDocumentForDownload(superAdminA, 'pol-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the in-scope policy has no document', async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue({
        id: 'pol-1',
        clientId: 'client-1',
        type: 'general_liability',
        storedFileName: null,
        fileName: null,
        client: { id: 'client-1', name: 'Acme' },
      });
      await expect(
        service.getDocumentForDownload(superAdminA, 'pol-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---- client portal isolation ----------------------------------

  describe('client portal reads', () => {
    it('scopes the list strictly to the JWT tenant + client', async () => {
      prisma.client.findFirst.mockResolvedValue({ name: 'Acme' });
      prisma.clientInsurancePolicy.findMany.mockResolvedValue([]);

      await service.findAllForClient(TENANT_A, 'client-1', 'cu-1');

      expect(prisma.clientInsurancePolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_A, clientId: 'client-1' },
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_INSURANCE_LIST_VIEWED' }),
      );
    });

    it("404s a document that is not the client's own policy", async () => {
      prisma.clientInsurancePolicy.findFirst.mockResolvedValue(null);

      await expect(
        service.getDocumentForClient(TENANT_A, 'client-1', 'policy-of-client-2'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.clientInsurancePolicy.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'policy-of-client-2', tenantId: TENANT_A, clientId: 'client-1' },
        }),
      );
    });
  });
});
