import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SavedProspectSearchService } from './saved-prospect-search.service';

describe('SavedProspectSearchService', () => {
  let service: SavedProspectSearchService;
  let prisma: {
    savedProspectSearch: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let auditService: { log: jest.Mock };

  const filters = {
    industry: null,
    city: null,
    state: 'Texas',
    country: null,
    employeeMin: null,
    employeeMax: null,
    revenueRange: null,
    keywords: [],
  };

  beforeEach(() => {
    prisma = {
      savedProspectSearch: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'saved-1',
          name: 'Texas security prospects',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'saved-1',
          name: 'Renamed search',
        }),
        delete: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({
          id: 'saved-1',
          name: 'Texas security prospects',
        }),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

    service = new SavedProspectSearchService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it('lists saved searches scoped to the tenant only (not per-user)', async () => {
    await service.list('tenant-1');

    expect(prisma.savedProspectSearch.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates a saved search and logs a SAVED_SEARCH_CREATED audit event', async () => {
    const result = await service.create({
      tenantId: 'tenant-1',
      userId: 'user-1',
      name: '  Texas security prospects  ',
      prompt: 'Find security companies in Texas',
      filters,
    });

    expect(prisma.savedProspectSearch.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        name: 'Texas security prospects',
        prompt: 'Find security companies in Texas',
      }),
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SAVED_SEARCH_CREATED',
        entityId: 'saved-1',
      }),
    );
    expect(result.id).toBe('saved-1');
  });

  it('renames a saved search and logs a SAVED_SEARCH_RENAMED audit event', async () => {
    await service.rename('saved-1', 'tenant-1', 'user-1', 'Renamed search');

    expect(prisma.savedProspectSearch.update).toHaveBeenCalledWith({
      where: { id: 'saved-1' },
      data: { name: 'Renamed search' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SAVED_SEARCH_RENAMED',
        entityId: 'saved-1',
      }),
    );
  });

  it('deletes a saved search and logs a SAVED_SEARCH_DELETED audit event', async () => {
    await service.remove('saved-1', 'tenant-1', 'user-1');

    expect(prisma.savedProspectSearch.delete).toHaveBeenCalledWith({
      where: { id: 'saved-1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SAVED_SEARCH_DELETED',
        entityId: 'saved-1',
      }),
    );
  });

  it('throws NotFoundException when renaming a saved search outside the tenant', async () => {
    prisma.savedProspectSearch.findFirst.mockResolvedValue(null);

    await expect(
      service.rename('saved-1', 'tenant-2', 'user-1', 'Renamed'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.savedProspectSearch.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deleting a saved search outside the tenant', async () => {
    prisma.savedProspectSearch.findFirst.mockResolvedValue(null);

    await expect(
      service.remove('saved-1', 'tenant-2', 'user-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.savedProspectSearch.delete).not.toHaveBeenCalled();
  });
});
