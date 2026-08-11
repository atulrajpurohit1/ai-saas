import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { ProspectCompanyDto } from './dto/prospect-company.dto';
import { BlackPearlInsightProvider } from './providers/blackpearl-insight.provider';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';
import { ProspectDiscoveryCacheService } from './prospect-discovery-cache.service';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ProspectSearchService } from './prospect-search.service';

describe('ProspectSearchService', () => {
  let service: ProspectSearchService;
  let aiService: { generateProspectCompanyInsight: jest.Mock };
  let auditService: { log: jest.Mock };
  let leadsService: { create: jest.Mock; findPotentialDuplicate: jest.Mock };
  let notesService: { create: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock };
  let discoveryCacheService: {
    buildKey: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
  };
  let historyService: { record: jest.Mock };
  let blackPearlInsightProvider: {
    isConfigured: jest.Mock;
    getPlaybook: jest.Mock;
    submitPlaybookJob: jest.Mock;
    getJobResult: jest.Mock;
  };
  let blackPearlProspectingProvider: {
    isConfigured: jest.Mock;
    submitProspectingJob: jest.Mock;
    getJobResult: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const user: ActiveUser = { sub: 'user-1', tenantId, role: 'admin' };

  const insight = {
    companyName: 'Lone Star Guard Services',
    businessSummary: 'Growing security services company.',
    valueProps: ['Risk-reduction assessment.'],
    salesAngles: ['Lead with risk reduction.'],
    keyPersonas: [],
    potentialObjections: [],
  };

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
  };

  beforeEach(() => {
    aiService = { generateProspectCompanyInsight: jest.fn() };
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
    discoveryCacheService = {
      buildKey: jest.fn().mockReturnValue('cache-key'),
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    };
    historyService = {
      record: jest.fn().mockResolvedValue({ id: 'history-1' }),
    };
    blackPearlInsightProvider = {
      isConfigured: jest.fn().mockReturnValue(true),
      getPlaybook: jest.fn().mockResolvedValue(insight),
      submitPlaybookJob: jest.fn().mockResolvedValue('job-1'),
      getJobResult: jest.fn().mockResolvedValue({
        jobId: 'job-1',
        status: 'completed',
        progress: 100,
        companyName: 'Acme Corp',
        insight,
      }),
    };
    blackPearlProspectingProvider = {
      isConfigured: jest.fn().mockReturnValue(true),
      submitProspectingJob: jest.fn().mockResolvedValue('discovery-job-1'),
      getJobResult: jest.fn().mockResolvedValue({
        status: 'completed',
        progress: 100,
        stageLabel: null,
        result: {
          query: '',
          discoveredCount: 0,
          qualifiedCount: 0,
          prospects: [],
        },
      }),
    };

    service = new ProspectSearchService(
      aiService as unknown as AiService,
      auditService as unknown as AuditService,
      leadsService as unknown as LeadsService,
      notesService as unknown as NotesService,
      cacheService as unknown as ProspectSearchCacheService,
      discoveryCacheService as unknown as ProspectDiscoveryCacheService,
      historyService as unknown as ProspectSearchHistoryService,
      blackPearlInsightProvider as unknown as BlackPearlInsightProvider,
      blackPearlProspectingProvider as unknown as BlackPearlProspectingProvider,
    );
  });

  describe('search', () => {
    it('submits a BlackPearl job and returns a pending result with the job id', async () => {
      const result = await service.search(
        { companyName: 'Lone Star Guard Services' },
        user,
      );

      expect(result).toEqual({
        status: 'pending',
        jobId: 'job-1',
        companyName: 'Lone Star Guard Services',
      });
      expect(blackPearlInsightProvider.submitPlaybookJob).toHaveBeenCalledWith({
        name: 'Lone Star Guard Services',
      });
    });

    it('trims the submitted company name', async () => {
      await service.search({ companyName: '  Acme Corp  ' }, user);

      expect(blackPearlInsightProvider.submitPlaybookJob).toHaveBeenCalledWith({
        name: 'Acme Corp',
      });
    });

    it('throws a clean, non-internal error when BLACKPEARL_API_KEY is not configured', async () => {
      blackPearlInsightProvider.isConfigured.mockReturnValue(false);

      await expect(
        service.search({ companyName: 'Acme Corp' }, user),
      ).rejects.toThrow(ServiceUnavailableException);
      // The user-facing message must never name internal config (env var
      // names, provider names) - that detail belongs in the server log only.
      await expect(
        service.search({ companyName: 'Acme Corp' }, user),
      ).rejects.not.toThrow(/BLACKPEARL_API_KEY/);
      expect(
        blackPearlInsightProvider.submitPlaybookJob,
      ).not.toHaveBeenCalled();
    });

    it('throws a clear error when BlackPearl cannot even start the job', async () => {
      blackPearlInsightProvider.submitPlaybookJob.mockResolvedValue(null);

      await expect(
        service.search({ companyName: 'Acme Corp' }, user),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('logs a tenant-scoped audit event for every submitted job', async () => {
      await service.search({ companyName: 'Acme Corp' }, user);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          action: 'PROSPECT_SEARCH_PERFORMED',
          entityType: 'PROSPECT_SEARCH',
        }),
      );
    });

    it('returns the cached result immediately and skips submitting a new job on a cache hit', async () => {
      const cachedResult = { companyName: 'Acme Corp', insight };
      cacheService.get.mockReturnValue(cachedResult);

      const result = await service.search({ companyName: 'Acme Corp' }, user);

      expect(result).toEqual({
        status: 'completed',
        companyName: 'Acme Corp',
        insight,
      });
      expect(
        blackPearlInsightProvider.submitPlaybookJob,
      ).not.toHaveBeenCalled();
      expect(historyService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          prompt: 'Acme Corp',
        }),
      );
    });
  });

  describe('getSearchJobStatus', () => {
    it('returns pending with progress while the job is still running', async () => {
      blackPearlInsightProvider.getJobResult.mockResolvedValue({
        jobId: 'job-1',
        status: 'pending',
        progress: 42,
        companyName: 'Acme Corp',
        insight: null,
      });

      const result = await service.getSearchJobStatus('job-1', user);

      expect(result).toEqual({ status: 'pending', progress: 42 });
      expect(cacheService.set).not.toHaveBeenCalled();
      expect(historyService.record).not.toHaveBeenCalled();
    });

    it('caches and records history once the job completes', async () => {
      const result = await service.getSearchJobStatus('job-1', user);

      expect(result).toEqual({
        status: 'completed',
        companyName: 'Acme Corp',
        insight,
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        tenantId,
        'Acme Corp',
        'blackpearl',
        { companyName: 'Acme Corp', insight },
      );
      expect(historyService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          prompt: 'Acme Corp',
          provider: 'blackpearl',
        }),
      );
    });

    it('returns failed without caching anything when the job errors out', async () => {
      blackPearlInsightProvider.getJobResult.mockResolvedValue({
        jobId: 'job-1',
        status: 'failed',
        progress: null,
        companyName: 'Acme Corp',
        insight: null,
      });

      const result = await service.getSearchJobStatus('job-1', user);

      expect(result.status).toBe('failed');
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('throws when the status check itself fails', async () => {
      blackPearlInsightProvider.getJobResult.mockResolvedValue(null);

      await expect(service.getSearchJobStatus('job-1', user)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
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
    it('prefers the BlackPearl playbook over the Gemini fallback', async () => {
      const result = await service.getCompanyInsight(
        { company: prospectDto, prompt: 'Find security companies in Texas' },
        user,
      );

      expect(result).toEqual(insight);
      expect(aiService.generateProspectCompanyInsight).not.toHaveBeenCalled();
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

    it('falls back to Gemini when BlackPearl has no playbook', async () => {
      blackPearlInsightProvider.getPlaybook.mockResolvedValue(null);
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
          content: expect.stringContaining(prospectDto.website as string),
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

    it('creates a lead with a name-only note when no profile fields are available', async () => {
      const nameOnly: ProspectCompanyDto = { id: 'co-9', name: 'Acme Corp' };

      await service.importCompany({ company: nameOnly }, user);

      expect(notesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Imported from Prospect Search.',
        }),
      );
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

  describe('discover', () => {
    const dto = { objective: 'Marketing agencies in India' };

    it('submits a BlackPearl prospecting job and returns a pending result with the job id', async () => {
      const result = await service.discover(dto, user);

      expect(result).toEqual({
        status: 'pending',
        jobId: 'discovery-job-1',
        query: 'Marketing agencies in India',
      });
      expect(
        blackPearlProspectingProvider.submitProspectingJob,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ objective: 'Marketing agencies in India' }),
      );
    });

    it('throws a clean, non-internal error when BLACKPEARL_API_KEY is not configured', async () => {
      blackPearlProspectingProvider.isConfigured.mockReturnValue(false);

      await expect(service.discover(dto, user)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.discover(dto, user)).rejects.not.toThrow(
        /BLACKPEARL_API_KEY/,
      );
      expect(
        blackPearlProspectingProvider.submitProspectingJob,
      ).not.toHaveBeenCalled();
    });

    it('throws a clear error when BlackPearl cannot even start the job', async () => {
      blackPearlProspectingProvider.submitProspectingJob.mockResolvedValue(
        null,
      );

      await expect(service.discover(dto, user)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('logs a tenant-scoped audit event for every submitted discovery job', async () => {
      await service.discover(dto, user);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          userId: user.sub,
          action: 'PROSPECT_DISCOVERY_PERFORMED',
          entityType: 'PROSPECT_SEARCH',
        }),
      );
    });

    it('returns the cached result immediately and skips submitting a new job on a cache hit', async () => {
      const cachedResult = {
        query: 'Marketing agencies in India',
        discoveredCount: 1,
        qualifiedCount: 1,
        prospects: [
          {
            id: 'pros-1',
            companyName: 'Acme Marketing',
            contact: {},
            qualificationScore: 0.9,
            signals: [],
          },
        ],
      };
      discoveryCacheService.get.mockReturnValue(cachedResult);

      const result = await service.discover(dto, user);

      expect(result).toEqual({
        status: 'completed',
        query: 'Marketing agencies in India',
        result: cachedResult,
      });
      expect(
        blackPearlProspectingProvider.submitProspectingJob,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getDiscoveryJobStatus', () => {
    const dto = { objective: 'Marketing agencies in India' };

    it('returns pending with progress and stage label while the job runs', async () => {
      blackPearlProspectingProvider.getJobResult.mockResolvedValue({
        status: 'pending',
        progress: 40,
        stageLabel: 'Finding contacts',
        result: null,
      });

      const result = await service.getDiscoveryJobStatus(
        'discovery-job-1',
        dto,
        user,
      );

      expect(result).toEqual({
        status: 'pending',
        progress: 40,
        stageLabel: 'Finding contacts',
      });
    });

    it('caches and records history once the job completes', async () => {
      const prospects = [
        {
          id: 'pros-1',
          companyName: 'Acme Marketing',
          contact: { fullName: 'Jane Doe', jobTitle: 'CEO' },
          qualificationScore: 0.9,
          signals: [],
        },
      ];
      blackPearlProspectingProvider.getJobResult.mockResolvedValue({
        status: 'completed',
        progress: 100,
        stageLabel: null,
        result: { query: '', discoveredCount: 1, qualifiedCount: 1, prospects },
      });

      const result = await service.getDiscoveryJobStatus(
        'discovery-job-1',
        dto,
        user,
      );

      expect(result).toEqual({
        status: 'completed',
        query: 'Marketing agencies in India',
        result: {
          query: 'Marketing agencies in India',
          discoveredCount: 1,
          qualifiedCount: 1,
          prospects,
        },
      });
      expect(discoveryCacheService.set).toHaveBeenCalledWith(
        'cache-key',
        expect.objectContaining({ prospects }),
      );
      expect(historyService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          prompt: 'Marketing agencies in India',
          provider: 'blackpearl_prospecting',
          resultCount: 1,
        }),
      );
    });

    it('reports a clean failure message without exposing internals when the job fails', async () => {
      blackPearlProspectingProvider.getJobResult.mockResolvedValue({
        status: 'failed',
        progress: null,
        stageLabel: null,
        result: null,
      });

      const result = await service.getDiscoveryJobStatus(
        'discovery-job-1',
        dto,
        user,
      );

      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.message).not.toMatch(/BlackPearl/i);
      }
    });

    it('throws a clean 503 when the status check itself fails after retries', async () => {
      blackPearlProspectingProvider.getJobResult.mockResolvedValue(null);

      await expect(
        service.getDiscoveryJobStatus('discovery-job-1', dto, user),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
