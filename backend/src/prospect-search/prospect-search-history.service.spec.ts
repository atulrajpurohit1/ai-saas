import { PrismaService } from '../prisma/prisma.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';

describe('ProspectSearchHistoryService', () => {
  let service: ProspectSearchHistoryService;
  let prisma: {
    prospectSearchHistory: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  const result = {
    query: 'Security guards in Chicago',
    discoveredCount: 20,
    qualifiedCount: 20,
    prospects: [{ id: 'p1' }],
  };

  beforeEach(() => {
    prisma = {
      prospectSearchHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
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
      prompt: 'Lone Star Guard Services',
      provider: 'blackpearl',
      resultCount: 1,
    });

    expect(prisma.prospectSearchHistory.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        prompt: 'Lone Star Guard Services',
        filters: {},
        provider: 'blackpearl',
        resultCount: 1,
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

  it('stores the results a search produced, so reopening it costs nothing', async () => {
    await service.record({
      tenantId: 'tenant-1',
      userId: 'user-1',
      prompt: 'Security guards in Chicago',
      provider: 'blackpearl-prospecting',
      resultCount: 20,
      result: result as never,
    });

    expect(prisma.prospectSearchHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ filters: { result } }),
    });
  });

  it('reports which listed entries have results, without sending them', async () => {
    prisma.prospectSearchHistory.findMany.mockResolvedValue([
      { id: 'h1', prompt: 'with', filters: { result } },
      { id: 'h2', prompt: 'without', filters: {} },
    ]);

    const entries = await service.list('tenant-1', 'user-1');

    expect(entries).toEqual([
      { id: 'h1', prompt: 'with', hasResult: true },
      { id: 'h2', prompt: 'without', hasResult: false },
    ]);
    // The prospects themselves must not ride along in the list payload.
    expect(JSON.stringify(entries)).not.toContain('discoveredCount');
  });

  it('returns one entry\'s stored results', async () => {
    prisma.prospectSearchHistory.findFirst.mockResolvedValue({
      id: 'h1',
      prompt: 'Security guards in Chicago',
      filters: { result },
    });

    await expect(service.getSnapshot('tenant-1', 'user-1', 'h1')).resolves.toEqual(
      { id: 'h1', prompt: 'Security guards in Chicago', result },
    );

    // Another user's search is not this user's to reopen.
    expect(prisma.prospectSearchHistory.findFirst).toHaveBeenCalledWith({
      where: { id: 'h1', tenantId: 'tenant-1', userId: 'user-1' },
    });
  });

  it('refuses an entry that was never found, rather than inventing one', async () => {
    await expect(
      service.getSnapshot('tenant-1', 'user-1', 'missing'),
    ).rejects.toThrow('no longer in your history');
  });

  it('refuses an entry recorded before snapshots existed', async () => {
    prisma.prospectSearchHistory.findFirst.mockResolvedValue({
      id: 'old',
      prompt: 'old search',
      filters: {},
    });

    await expect(
      service.getSnapshot('tenant-1', 'user-1', 'old'),
    ).rejects.toThrow('no saved results');
  });
});
