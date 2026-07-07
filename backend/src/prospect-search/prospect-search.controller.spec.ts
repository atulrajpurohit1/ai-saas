import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ProspectSearchController } from './prospect-search.controller';
import { ProspectSearchService } from './prospect-search.service';
import { SavedProspectSearchService } from './saved-prospect-search.service';

describe('ProspectSearchController', () => {
  let controller: ProspectSearchController;
  let service: {
    search: jest.Mock;
    recordView: jest.Mock;
    getCompanyInsight: jest.Mock;
    importCompany: jest.Mock;
  };
  let historyService: { list: jest.Mock };
  let savedSearchService: {
    list: jest.Mock;
    create: jest.Mock;
    rename: jest.Mock;
    remove: jest.Mock;
  };

  const user: ActiveUser = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    role: 'admin',
  };

  beforeEach(() => {
    service = {
      search: jest.fn().mockResolvedValue({
        prompt: 'Find security companies',
        filters: {
          industry: null,
          city: null,
          state: null,
          country: null,
          employeeMin: null,
          employeeMax: null,
          revenueRange: null,
          keywords: [],
        },
        results: [],
        totalMatches: 0,
      }),
      recordView: jest.fn().mockResolvedValue({ ok: true }),
      getCompanyInsight: jest.fn().mockResolvedValue({
        whyMatch: 'x',
        opportunity: 'x',
        outreachStrategy: 'x',
        securityNeeds: 'x',
        nextConversation: 'x',
      }),
      importCompany: jest.fn().mockResolvedValue({
        duplicate: false,
        lead: {
          id: 'lead-1',
          name: 'x',
          company: 'x',
          email: null,
          status: 'new',
        },
      }),
    };
    historyService = { list: jest.fn().mockResolvedValue([]) };
    savedSearchService = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'saved-1' }),
      rename: jest.fn().mockResolvedValue({ id: 'saved-1', name: 'Renamed' }),
      remove: jest.fn().mockResolvedValue({ success: true }),
    };

    controller = new ProspectSearchController(
      service as unknown as ProspectSearchService,
      historyService as unknown as ProspectSearchHistoryService,
      savedSearchService as unknown as SavedProspectSearchService,
    );
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates search requests to the service with the DTO and active user', async () => {
    const dto = { prompt: 'Find security companies in Texas' };

    const result = await controller.search(dto, user);

    expect(service.search).toHaveBeenCalledWith(dto, user);
    expect(result.totalMatches).toBe(0);
  });

  it('delegates view requests to the service with the DTO and active user', async () => {
    const dto = { companyId: 'co-1', companyName: 'Lone Star Guard Services' };

    const result = await controller.recordView(dto, user);

    expect(service.recordView).toHaveBeenCalledWith(dto, user);
    expect(result).toEqual({ ok: true });
  });

  it('delegates insight requests to the service with the DTO and active user', async () => {
    const dto = {
      company: {
        id: 'co-1',
        name: 'Lone Star Guard Services',
        industry: 'Security Services',
        website: 'https://lonestarguard.example.com',
        city: 'Austin',
        state: 'Texas',
        country: 'United States',
        employeeCount: 120,
        revenueRange: '$10M-$50M',
        description: 'desc',
        matchScore: 80,
      },
    };

    await controller.getCompanyInsight(dto, user);

    expect(service.getCompanyInsight).toHaveBeenCalledWith(dto, user);
  });

  it('delegates import requests to the service with the DTO and active user', async () => {
    const dto = {
      company: {
        id: 'co-1',
        name: 'Lone Star Guard Services',
        industry: 'Security Services',
        website: 'https://lonestarguard.example.com',
        city: 'Austin',
        state: 'Texas',
        country: 'United States',
        employeeCount: 120,
        revenueRange: '$10M-$50M',
        description: 'desc',
        matchScore: 80,
      },
    };

    const result = await controller.importCompany(dto, user);

    expect(service.importCompany).toHaveBeenCalledWith(dto, user);
    expect(result.duplicate).toBe(false);
  });

  it('delegates history requests to the history service, scoped to the tenant and user', async () => {
    await controller.getHistory(user, '10');

    expect(historyService.list).toHaveBeenCalledWith('tenant-1', 'user-1', 10);
  });

  it('passes undefined limit through when no query param is given', async () => {
    await controller.getHistory(user);

    expect(historyService.list).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      undefined,
    );
  });

  it('delegates saved-search listing to the saved-search service, scoped to the tenant', async () => {
    await controller.getSavedSearches(user);

    expect(savedSearchService.list).toHaveBeenCalledWith('tenant-1');
  });

  it('delegates saved-search creation with the tenant/user and DTO fields', async () => {
    const dto = {
      name: 'Texas security prospects',
      prompt: 'Find security companies in Texas',
      filters: {
        industry: null,
        city: null,
        state: 'Texas',
        country: null,
        employeeMin: null,
        employeeMax: null,
        revenueRange: null,
        keywords: [],
      },
    };

    await controller.createSavedSearch(dto, user);

    expect(savedSearchService.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      name: dto.name,
      prompt: dto.prompt,
      filters: dto.filters,
    });
  });

  it('delegates saved-search rename to the saved-search service', async () => {
    await controller.renameSavedSearch('saved-1', { name: 'Renamed' }, user);

    expect(savedSearchService.rename).toHaveBeenCalledWith(
      'saved-1',
      'tenant-1',
      'user-1',
      'Renamed',
    );
  });

  it('delegates saved-search deletion to the saved-search service', async () => {
    const result = await controller.removeSavedSearch('saved-1', user);

    expect(savedSearchService.remove).toHaveBeenCalledWith(
      'saved-1',
      'tenant-1',
      'user-1',
    );
    expect(result).toEqual({ success: true });
  });
});
