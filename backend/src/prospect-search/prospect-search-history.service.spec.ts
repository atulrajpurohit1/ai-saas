import { PrismaService } from '../prisma/prisma.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';

describe('ProspectSearchHistoryService', () => {
  let service: ProspectSearchHistoryService;
  let prisma: {
    prospectSearchHistory: { create: jest.Mock; findMany: jest.Mock };
  };

  const filters = {
    industry: 'Security Services',
    city: null,
    state: 'Texas',
    country: null,
    employeeMin: 50,
    employeeMax: 200,
    revenueRange: null,
    keywords: ['security'],
  };

  beforeEach(() => {
    prisma = {
      prospectSearchHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new ProspectSearchHistoryService(
      prisma as unknown as PrismaService,
    );
  });

  it('records a search history entry scoped to the tenant and user', async () => {
    await service.record({
      tenantId: 'tenant-1',
      userId: 'user-1',
      prompt: 'Find security companies in Texas',
      filters,
      provider: 'mock',
      resultCount: 3,
    });

    expect(prisma.prospectSearchHistory.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        prompt: 'Find security companies in Texas',
        filters,
        provider: 'mock',
        resultCount: 3,
      },
    });
  });

  it('lists history scoped to the tenant and user, most recent first', async () => {
    await service.list('tenant-1', 'user-1');

    expect(prisma.prospectSearchHistory.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', userId: 'user-1' },
      orderBy: { searchedAt: 'desc' },
      take: 20,
    });
  });

  it('clamps the requested limit to the maximum page size', async () => {
    await service.list('tenant-1', 'user-1', 500);

    expect(prisma.prospectSearchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('clamps a non-positive limit up to at least 1', async () => {
    await service.list('tenant-1', 'user-1', -5);

    expect(prisma.prospectSearchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
