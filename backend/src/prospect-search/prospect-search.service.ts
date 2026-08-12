import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService, ProspectCompanyInsight } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { CompanyInsightDto } from './dto/company-insight.dto';
import { DiscoverProspectsDto } from './dto/discover-prospects.dto';
import { ImportProspectDto } from './dto/import-prospect.dto';
import { ProspectCompanyDto } from './dto/prospect-company.dto';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ViewProspectDto } from './dto/view-prospect.dto';
import { BlackPearlInsightProvider } from './providers/blackpearl-insight.provider';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';
import { ProspectDiscoveryCacheService } from './prospect-discovery-cache.service';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import {
  ImportProspectResult,
  ProspectDiscoveryJobStatusResult,
  ProspectDiscoverySubmission,
  ProspectSearchJobStatusResult,
  ProspectSearchResult,
  ProspectSearchSubmission,
} from './types/prospect-search.types';

const PROVIDER_NAME = 'blackpearl';
const DISCOVERY_PROVIDER_NAME = 'blackpearl_prospecting';

@Injectable()
export class ProspectSearchService {
  private readonly logger = new Logger(ProspectSearchService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly auditService: AuditService,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
    private readonly cacheService: ProspectSearchCacheService,
    private readonly discoveryCacheService: ProspectDiscoveryCacheService,
    private readonly historyService: ProspectSearchHistoryService,
    private readonly blackPearlInsightProvider: BlackPearlInsightProvider,
    private readonly blackPearlProspectingProvider: BlackPearlProspectingProvider,
  ) {}

  /**
   * BlackPearl playbook generation is asynchronous and commonly takes
   * minutes, so this only submits the job (or returns a cached result
   * instantly) - the caller polls getSearchJobStatus() for completion.
   */
  async search(
    dto: SearchProspectsDto,
    user: ActiveUser,
  ): Promise<ProspectSearchSubmission> {
    const companyName = dto.companyName.trim();

    const cached = this.cacheService.get(
      user.tenantId,
      companyName,
      PROVIDER_NAME,
    );

    if (cached) {
      this.logger.log(
        `Prospect search cache hit: tenant=${user.tenantId} provider=${PROVIDER_NAME} company="${companyName}"`,
      );
      await this.recordHistory(companyName, user);
      return { status: 'completed', companyName, insight: cached.insight };
    }

    if (!this.blackPearlInsightProvider.isConfigured()) {
      this.logger.error(
        'BLACKPEARL_API_KEY is not configured. Prospect Search cannot return results.',
      );
      throw new ServiceUnavailableException(
        'Prospect Search is temporarily unavailable. Please contact your administrator.',
      );
    }

    const jobId = await this.blackPearlInsightProvider.submitPlaybookJob({
      name: companyName,
    });

    if (!jobId) {
      throw new ServiceUnavailableException(
        "We couldn't start researching this company right now. Please try again shortly.",
      );
    }

    this.logger.log(
      `Prospect search job submitted: tenant=${user.tenantId} provider=${PROVIDER_NAME} jobId=${jobId} company="${companyName}"`,
    );

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'PROSPECT_SEARCH_PERFORMED',
      entityType: 'PROSPECT_SEARCH',
      details: `Company: "${companyName}" (BlackPearl job ${jobId})`,
    });

    return { status: 'pending', jobId, companyName };
  }

  /**
   * Polled by the caller until the BlackPearl job is no longer "pending".
   * Writes to cache/history only once a result actually completes, since
   * search() itself no longer waits for that. Deliberately never calls
   * submitPlaybookJob() - per BlackPearl's guidance, the same job id is
   * reused for every poll (including retries after a transient 503), and a
   * new playbook must never be submitted just because a status check failed.
   */
  async getSearchJobStatus(
    jobId: string,
    user: ActiveUser,
  ): Promise<ProspectSearchJobStatusResult> {
    this.logger.debug(
      `Checking prospect search job status: tenant=${user.tenantId} jobId=${jobId}`,
    );

    const result = await this.blackPearlInsightProvider.getJobResult(jobId);

    if (!result) {
      // This is a 503 from THIS line: getJobResult() returned null, which
      // only happens when the BlackPearl status-check request itself could
      // not be completed after its internal retries (auth failure, or a
      // network/5xx failure that persisted across all retry attempts) - see
      // BlackPearlInsightProvider's logs immediately above this line for the
      // exact HTTP failure that caused it. This is NOT the same as the
      // BlackPearl job having failed - the job may still be running fine.
      this.logger.error(
        `Prospect search job status check FAILED: tenant=${user.tenantId} jobId=${jobId} - returning 503. See BlackPearlInsightProvider logs above for the exact cause.`,
      );
      throw new ServiceUnavailableException(
        'Could not check playbook status right now. Please try again shortly.',
      );
    }

    if (result.status === 'pending') {
      return { status: 'pending', progress: result.progress };
    }

    if (result.status === 'completed' && result.insight) {
      const companyName = result.companyName ?? '';
      const searchResult: ProspectSearchResult = {
        companyName,
        insight: result.insight,
      };

      this.cacheService.set(
        user.tenantId,
        companyName,
        PROVIDER_NAME,
        searchResult,
      );
      await this.recordHistory(companyName, user);

      this.logger.log(
        `Prospect search job completed: tenant=${user.tenantId} provider=${PROVIDER_NAME} jobId=${jobId}`,
      );

      return { status: 'completed', companyName, insight: result.insight };
    }

    this.logger.warn(
      `Prospect search job failed: tenant=${user.tenantId} provider=${PROVIDER_NAME} jobId=${jobId}`,
    );

    return {
      status: 'failed',
      message:
        "We couldn't generate a sales playbook for this company. Please try again.",
    };
  }

  private async recordHistory(
    companyName: string,
    user: ActiveUser,
  ): Promise<void> {
    try {
      await this.historyService.record({
        tenantId: user.tenantId,
        userId: user.sub,
        prompt: companyName,
        provider: PROVIDER_NAME,
        resultCount: 1,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record prospect search history: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Real, multi-company/multi-contact prospect discovery
   * (BlackPearl's "Prospecting" capability, confirmed enabled on this
   * account). Same async job-submission shape as single-company search()
   * above, but our own live testing showed prospecting jobs typically
   * complete in about a minute in turbo mode - much faster than Playbooks.
   */
  async discover(
    dto: DiscoverProspectsDto,
    user: ActiveUser,
  ): Promise<ProspectDiscoverySubmission> {
    const objective = dto.objective.trim();
    const cacheKey = this.discoveryCacheService.buildKey(
      user.tenantId,
      DISCOVERY_PROVIDER_NAME,
      this.normalizeDiscoveryQuery(dto),
    );

    const cached = this.discoveryCacheService.get(cacheKey);
    if (cached) {
      this.logger.log(
        `Prospect discovery cache hit: tenant=${user.tenantId} objective="${objective}"`,
      );
      await this.recordDiscoveryHistory(
        objective,
        cached.prospects.length,
        user,
      );
      return { status: 'completed', query: objective, result: cached };
    }

    if (!this.blackPearlProspectingProvider.isConfigured()) {
      this.logger.error(
        'BLACKPEARL_API_KEY is not configured. Prospect discovery cannot return results.',
      );
      throw new ServiceUnavailableException(
        'Prospect Search is temporarily unavailable. Please contact your administrator.',
      );
    }

    const jobId = await this.blackPearlProspectingProvider.submitProspectingJob(
      {
        objective,
        target: {
          companyNames: dto.companyNames,
          locations: dto.locations,
          industries: dto.industries,
          jobTitles: dto.jobTitles,
          keywords: dto.keywords,
          companyHeadcountMin: dto.companyHeadcountMin,
          companyHeadcountMax: dto.companyHeadcountMax,
        },
        limit: dto.limit,
      },
    );

    if (!jobId) {
      throw new ServiceUnavailableException(
        "We couldn't start this search right now. Please try again shortly.",
      );
    }

    this.logger.log(
      `Prospect discovery job submitted: tenant=${user.tenantId} jobId=${jobId} objective="${objective}"`,
    );

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'PROSPECT_DISCOVERY_PERFORMED',
      entityType: 'PROSPECT_SEARCH',
      details: `Objective: "${objective}" (BlackPearl prospecting job ${jobId})`,
    });

    return { status: 'pending', jobId, query: objective };
  }

  /**
   * Polled by the caller until the prospecting job is no longer "pending".
   * Never resubmits - same job id is reused for every poll, matching the
   * single-company search's polling contract.
   */
  async getDiscoveryJobStatus(
    jobId: string,
    dto: DiscoverProspectsDto,
    user: ActiveUser,
  ): Promise<ProspectDiscoveryJobStatusResult> {
    const poll = await this.blackPearlProspectingProvider.getJobResult(jobId);

    if (!poll) {
      this.logger.error(
        `Prospect discovery job status check FAILED: tenant=${user.tenantId} jobId=${jobId} - returning 503.`,
      );
      throw new ServiceUnavailableException(
        'Could not check search status right now. Please try again shortly.',
      );
    }

    if (poll.status === 'pending') {
      return {
        status: 'pending',
        progress: poll.progress,
        stageLabel: poll.stageLabel,
      };
    }

    if (poll.status === 'completed' && poll.result) {
      const objective = dto.objective.trim();
      const result = { ...poll.result, query: objective };

      const cacheKey = this.discoveryCacheService.buildKey(
        user.tenantId,
        DISCOVERY_PROVIDER_NAME,
        this.normalizeDiscoveryQuery(dto),
      );
      this.discoveryCacheService.set(cacheKey, result);
      await this.recordDiscoveryHistory(
        objective,
        result.prospects.length,
        user,
      );

      this.logger.log(
        `Prospect discovery job completed: tenant=${user.tenantId} jobId=${jobId} prospects=${result.prospects.length}`,
      );

      return { status: 'completed', query: objective, result };
    }

    this.logger.warn(
      `Prospect discovery job failed: tenant=${user.tenantId} jobId=${jobId}`,
    );

    return {
      status: 'failed',
      message: "We couldn't complete this search. Please try again.",
    };
  }

  private async recordDiscoveryHistory(
    objective: string,
    resultCount: number,
    user: ActiveUser,
  ): Promise<void> {
    try {
      await this.historyService.record({
        tenantId: user.tenantId,
        userId: user.sub,
        prompt: objective,
        provider: DISCOVERY_PROVIDER_NAME,
        resultCount,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record prospect discovery history: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** A stable cache key from the objective plus every optional filter, order-independent. */
  private normalizeDiscoveryQuery(dto: DiscoverProspectsDto): string {
    const parts = [
      dto.objective.trim().toLowerCase(),
      (dto.companyNames ?? [])
        .map((v) => v.toLowerCase())
        .sort()
        .join(','),
      (dto.locations ?? [])
        .map((v) => v.toLowerCase())
        .sort()
        .join(','),
      (dto.industries ?? [])
        .map((v) => v.toLowerCase())
        .sort()
        .join(','),
      (dto.jobTitles ?? [])
        .map((v) => v.toLowerCase())
        .sort()
        .join(','),
      (dto.keywords ?? [])
        .map((v) => v.toLowerCase())
        .sort()
        .join(','),
      dto.companyHeadcountMin ?? '',
      dto.companyHeadcountMax ?? '',
      dto.limit ?? '',
    ];
    return parts.join('|');
  }

  async recordView(
    dto: ViewProspectDto,
    user: ActiveUser,
  ): Promise<{ ok: true }> {
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'PROSPECT_VIEWED',
      entityType: 'PROSPECT_SEARCH',
      entityId: dto.companyId,
      details: `Viewed prospect "${dto.companyName}"`,
    });

    return { ok: true };
  }

  async getCompanyInsight(
    dto: CompanyInsightDto,
    user: ActiveUser,
  ): Promise<ProspectCompanyInsight> {
    const aiStartedAt = Date.now();
    let insight: ProspectCompanyInsight;
    let source: 'blackpearl' | 'gemini' = 'gemini';
    try {
      const playbook = await this.blackPearlInsightProvider.getPlaybook(
        dto.company,
      );
      if (playbook) {
        insight = playbook;
        source = 'blackpearl';
      } else {
        insight = await this.aiService.generateProspectCompanyInsight(
          dto.company,
          dto.prompt,
        );
      }
    } catch (error) {
      // Log the real cause (which may name internal config like GEMINI_API_KEY
      // or the AI provider) server-side only - never forward it to the client.
      this.logger.error(
        `Company insight generation failed: tenant=${user.tenantId} company=${
          dto.company.id
        } error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        "We couldn't generate an AI insight for this company right now. Please try again shortly.",
      );
    }
    this.logger.log(
      `Company insight generated: tenant=${user.tenantId} company=${dto.company.id} source=${source} ms=${
        Date.now() - aiStartedAt
      }`,
    );

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'AI_INSIGHT_GENERATED',
      entityType: 'PROSPECT_SEARCH',
      entityId: dto.company.id,
      details: `Generated ${source} insight for "${dto.company.name}"`,
    });

    return insight;
  }

  async importCompany(
    dto: ImportProspectDto,
    user: ActiveUser,
  ): Promise<ImportProspectResult> {
    const { company, force } = dto;

    if (!force) {
      const domain = this.extractDomain(company.website);
      const duplicate = await this.leadsService.findPotentialDuplicate(
        user.tenantId,
        company.name,
        domain,
      );

      if (duplicate) {
        return {
          duplicate: true,
          existingLead: {
            id: duplicate.id,
            name: duplicate.name,
            company: duplicate.company,
          },
        };
      }
    }

    // Prefer the real discovered contact's name for the Lead's "name" field;
    // only a BlackPearl Prospecting result carries one. Fall back to the
    // company name (not a fabrication - it's the same behavior this always
    // had) when no contact was found for this company.
    const lead = await this.leadsService.create(
      {
        name: company.contactName?.trim() || company.name,
        company: company.name,
        email: company.contactEmail?.trim() || undefined,
      },
      user.tenantId,
      user.sub,
    );

    await this.notesService.create({
      content: this.buildImportNote(company),
      leadId: lead.id,
      tenantId: user.tenantId,
      userId: user.sub,
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'LEAD_IMPORTED',
      entityType: 'PROSPECT_SEARCH',
      entityId: company.id,
      details: `Imported prospect "${company.name}" as lead ${lead.id}`,
    });

    return {
      duplicate: false,
      lead: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        email: lead.email,
        status: lead.status,
      },
    };
  }

  private extractDomain(website?: string | null): string | null {
    if (!website) return null;

    try {
      const url = new URL(
        website.includes('://') ? website : `https://${website}`,
      );
      return url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Only renders fields that are actually present - a single-company deep
   * research result only ever has a name, so most of these are typically
   * absent there; a BlackPearl Prospecting discovery result is usually
   * richer (contact, qualification reasoning, signals) and that context has
   * nowhere else to live, since the Lead model has no columns for it. This
   * note is also read as free-text signal by Sales Accelerator's
   * marketSignalProfile() (see sales-accelerator.service.ts), so a fuller
   * note here directly improves that deterministic scoring - not a separate
   * cosmetic detail.
   */
  private buildImportNote(company: ProspectCompanyDto): string {
    const lines = ['Imported from Prospect Search.'];

    if (company.contactName) {
      const titleSuffix = company.contactTitle
        ? ` (${company.contactTitle})`
        : '';
      lines.push(`Contact: ${company.contactName}${titleSuffix}`);
    } else if (company.contactTitle) {
      lines.push(`Contact title: ${company.contactTitle}`);
    }
    if (company.contactEmail)
      lines.push(`Contact email: ${company.contactEmail}`);
    if (company.contactProfileUrl)
      lines.push(`Contact profile: ${company.contactProfileUrl}`);

    if (company.website) lines.push(`Website: ${company.website}`);
    if (company.industry) lines.push(`Industry: ${company.industry}`);

    const location = [company.city, company.state, company.country]
      .filter(Boolean)
      .join(', ');
    if (location) lines.push(`Location: ${location}`);

    if (company.employeeCount !== undefined) {
      lines.push(`Employees: ${company.employeeCount}`);
    }
    if (company.revenueRange) {
      lines.push(`Revenue range: ${company.revenueRange}`);
    }

    if (company.qualificationReason) {
      lines.push(
        '',
        `Why this prospect matched: ${company.qualificationReason}`,
      );
    }
    if (company.signals && company.signals.length > 0) {
      lines.push(
        '',
        'Signals:',
        ...company.signals.map((signal) => `- ${signal}`),
      );
    }

    if (company.description) {
      lines.push('', company.description);
    }

    return lines.join('\n');
  }
}
