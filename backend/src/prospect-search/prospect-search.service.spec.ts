import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { ProspectCompanyDto } from './dto/prospect-company.dto';
import { CompanyRepository } from './interfaces/prospect-search.interface';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ProspectSearchService } from './prospect-search.service';
import { ProspectCompany } from './types/prospect-search.types';

describe('ProspectSearchService', () => {
  let service: ProspectSearchService;
  let aiService: {
    generateProspectSearchFilters: jest.Mock;
    generateProspectCompanyInsight: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let leadsService: { create: jest.Mock; findPotentialDuplicate: jest.Mock };
  let notesService: { create: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock };
  let historyService: { record: jest.Mock };
  let companyRepository: CompanyRepository;
  const providerName = 'apollo';

  const tenantId = 'tenant-1';
  const user: ActiveUser = { sub: 'user-1', tenantId, role: 'admin' };

  const sampleCompanies: ProspectCompany[] = [
    {
      id: 'co-1',
      name: 'Lone Star Guard Services',
      industry: 'Security Services',
      website: 'https://lonestarguard.example.com',
      city: 'Austin',
      state: 'Texas',
      country: 'United States',
      employeeCount: 120,
      revenueRange: '$10M-$50M',
      description: 'Provides commercial security guard services across Texas.',
    },
    {
      id: 'co-2',
      name: 'Pacific Retail Solutions',
      industry: 'Retail',
      website: 'https://pacificretail.example.com',
      city: 'Los Angeles',
      state: 'California',
      country: 'United States',
      employeeCount: 300,
      revenueRange: '$100M-$500M',
      description: 'Multi-location retail chain specializing in home goods.',
    },
  ];

  const prospectDto: ProspectCompanyDto = {
    id: 'co-1',
    name: 'Lone Star Guard Services',
    industry: 'Security Services',
    website: 'https://lonestarguard.example.com',
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    employeeCount: 120,
    revenueRange: '$10M-$50M',
    description: 'Provides commercial security guard services across Texas.',
    matchScore: 80,
  };

  beforeEach(() => {
    aiService = {
      generateProspectSearchFilters: jest.fn(),
      generateProspectCompanyInsight: jest.fn(),
    };
    auditService = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    leadsService = {
      create: jest.fn().mockResolvedValue({
        id: 'lead-1',
        name: prospectDto.name,
        company: prospectDto.name,
        email: null,
        status: 'new',
      }),
      findPotentialDuplicate: jest.fn().mockResolvedValue(null),
    };
    notesService = { create: jest.fn().mockResolvedValue({ id: 'note-1' }) };
    cacheService = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    };
    historyService = {
      record: jest.fn().mockResolvedValue({ id: 'history-1' }),
    };
    companyRepository = {
      search: jest.fn().mockResolvedValue(sampleCompanies),
    };

    service = new ProspectSearchService(
      aiService as unknown as AiService,
      auditService as unknown as AuditService,
      leadsService as unknown as LeadsService,
      notesService as unknown as NotesService,
      cacheService as unknown as ProspectSearchCacheService,
      historyService as unknown as ProspectSearchHistoryService,
      companyRepository,
      providerName,
    );
  });

  it('ranks companies matching the AI-generated filters above non-matching ones', async () => {
    aiService.generateProspectSearchFilters.mockResolvedValue({
      industry: 'Security Services',
      city: null,
      state: 'Texas',
      country: 'United States',
      employeeMin: 50,
      employeeMax: 200,
      revenueRange: null,
      keywords: ['security'],
    });

    const result = await service.search(
      { prompt: 'Find security companies in Texas with 50-200 employees' },
      user,
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('co-1');
    expect(result.results[0].matchScore).toBeGreaterThan(0);
    expect(result.totalMatches).toBe(1);
  });

  it('excludes companies that do not match any filter or keyword', async () => {
    aiService.generateProspectSearchFilters.mockResolvedValue({
      industry: 'Security Services',
      city: null,
      state: 'Texas',
      country: 'United States',
      employeeMin: 50,
      employeeMax: 200,
      revenueRange: null,
      keywords: ['security'],
    });

    const result = await service.search(
      { prompt: 'Find security companies in Texas' },
      user,
    );

    expect(result.results.map((company) => company.id)).not.toContain('co-2');
  });

  it('returns no results when nothing in the provider results matches', async () => {
    aiService.generateProspectSearchFilters.mockResolvedValue({
      industry: 'Aerospace',
      city: null,
      state: 'Wyoming',
      country: 'United States',
      employeeMin: 10000,
      employeeMax: 20000,
      revenueRange: '$1B+',
      keywords: ['satellites'],
    });

    const result = await service.search(
      { prompt: 'Find aerospace companies' },
      user,
    );

    expect(result.results).toHaveLength(0);
    expect(result.totalMatches).toBe(0);
  });

  it('logs a tenant-scoped audit event for every search', async () => {
    aiService.generateProspectSearchFilters.mockResolvedValue({
      industry: null,
      city: null,
      state: null,
      country: null,
      employeeMin: null,
      employeeMax: null,
      revenueRange: null,
      keywords: [],
    });

    await service.search({ prompt: 'Find any companies' }, user);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId: user.sub,
        action: 'PROSPECT_SEARCH_PERFORMED',
        entityType: 'PROSPECT_SEARCH',
      }),
    );
  });

  it('delegates filter generation to AiService rather than calling Gemini directly', async () => {
    aiService.generateProspectSearchFilters.mockResolvedValue({
      industry: null,
      city: null,
      state: null,
      country: null,
      employeeMin: null,
      employeeMax: null,
      revenueRange: null,
      keywords: [],
    });

    await service.search({ prompt: 'Find any companies' }, user);

    expect(aiService.generateProspectSearchFilters).toHaveBeenCalledWith(
      'Find any companies',
    );
  });

  it('records search history on a cache miss', async () => {
    aiService.generateProspectSearchFilters.mockResolvedValue({
      industry: null,
      city: null,
      state: null,
      country: null,
      employeeMin: null,
      employeeMax: null,
      revenueRange: null,
      keywords: [],
    });

    await service.search({ prompt: 'Find any companies' }, user);

    expect(historyService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId: user.sub,
        prompt: 'Find any companies',
        provider: providerName,
      }),
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      tenantId,
      'Find any companies',
      providerName,
      expect.objectContaining({ prompt: 'Find any companies' }),
    );
  });

  it('returns the cached result and skips AI/provider calls on a cache hit', async () => {
    const cachedResult = {
      prompt: 'Find any companies',
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
    };
    cacheService.get.mockReturnValue(cachedResult);

    const result = await service.search({ prompt: 'Find any companies' }, user);

    expect(result).toBe(cachedResult);
    expect(aiService.generateProspectSearchFilters).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest mock assertion on an interface-typed test double, never actually invoked unbound
    expect(companyRepository.search).not.toHaveBeenCalled();
    expect(historyService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId: user.sub,
        prompt: 'Find any companies',
      }),
    );
  });

  describe('recordView', () => {
    it('logs a PROSPECT_VIEWED audit event scoped to the tenant and user', async () => {
      const result = await service.recordView(
        { companyId: 'co-1', companyName: 'Lone Star Guard Services' },
        user,
      );

      expect(result).toEqual({ ok: true });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          action: 'PROSPECT_VIEWED',
          entityType: 'PROSPECT_SEARCH',
          entityId: 'co-1',
        }),
      );
    });
  });

  describe('getCompanyInsight', () => {
    it('delegates to AiService and logs an AI_INSIGHT_GENERATED audit event', async () => {
      const insight = {
        whyMatch: 'Matches on industry and location.',
        opportunity: 'Growing security services company.',
        outreachStrategy: 'Lead with risk reduction.',
        securityNeeds: 'Likely needs guard staffing.',
        nextConversation: 'Ask about current provider.',
      };
      aiService.generateProspectCompanyInsight.mockResolvedValue(insight);

      const result = await service.getCompanyInsight(
        { company: prospectDto, prompt: 'Find security companies in Texas' },
        user,
      );

      expect(result).toEqual(insight);
      expect(aiService.generateProspectCompanyInsight).toHaveBeenCalledWith(
        prospectDto,
        'Find security companies in Texas',
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          action: 'AI_INSIGHT_GENERATED',
          entityType: 'PROSPECT_SEARCH',
          entityId: prospectDto.id,
        }),
      );
    });
  });

  describe('importCompany', () => {
    it('creates a lead, attaches a note, and logs LEAD_IMPORTED when there is no duplicate', async () => {
      const result = await service.importCompany(
        { company: prospectDto },
        user,
      );

      expect(leadsService.findPotentialDuplicate).toHaveBeenCalledWith(
        tenantId,
        prospectDto.name,
        'lonestarguard.example.com',
      );
      expect(leadsService.create).toHaveBeenCalledWith(
        { name: prospectDto.name, company: prospectDto.name },
        tenantId,
        user.sub,
      );
      expect(notesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 'lead-1',
          tenantId,
          userId: user.sub,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.stringContaining() is typed `any` in @types/jest
          content: expect.stringContaining(prospectDto.website),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          action: 'LEAD_IMPORTED',
          entityType: 'PROSPECT_SEARCH',
          entityId: prospectDto.id,
        }),
      );
      expect(result).toEqual({
        duplicate: false,
        lead: {
          id: 'lead-1',
          name: prospectDto.name,
          company: prospectDto.name,
          email: null,
          status: 'new',
        },
      });
    });

    it('returns the existing lead instead of creating a new one when a duplicate is found', async () => {
      leadsService.findPotentialDuplicate.mockResolvedValue({
        id: 'lead-existing',
        name: 'Lone Star Guard Services',
        company: 'Lone Star Guard Services',
        email: null,
        createdAt: new Date(),
      });

      const result = await service.importCompany(
        { company: prospectDto },
        user,
      );

      expect(leadsService.create).not.toHaveBeenCalled();
      expect(notesService.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEAD_IMPORTED' }),
      );
      expect(result).toEqual({
        duplicate: true,
        existingLead: {
          id: 'lead-existing',
          name: 'Lone Star Guard Services',
          company: 'Lone Star Guard Services',
        },
      });
    });

    it('bypasses the duplicate check and imports anyway when force is true', async () => {
      leadsService.findPotentialDuplicate.mockResolvedValue({
        id: 'lead-existing',
        name: 'Lone Star Guard Services',
        company: 'Lone Star Guard Services',
        email: null,
        createdAt: new Date(),
      });

      const result = await service.importCompany(
        { company: prospectDto, force: true },
        user,
      );

      expect(leadsService.findPotentialDuplicate).not.toHaveBeenCalled();
      expect(leadsService.create).toHaveBeenCalled();
      expect(result.duplicate).toBe(false);
    });
  });
});
