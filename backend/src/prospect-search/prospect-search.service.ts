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
import { ImportProspectDto } from './dto/import-prospect.dto';
import { ProspectCompanyDto } from './dto/prospect-company.dto';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ViewProspectDto } from './dto/view-prospect.dto';
import { BlackPearlInsightProvider } from './providers/blackpearl-insight.provider';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import {
  ImportProspectResult,
  ProspectSearchJobStatusResult,
  ProspectSearchResult,
  ProspectSearchSubmission,
} from './types/prospect-search.types';

const PROVIDER_NAME = 'blackpearl';

@Injectable()
export class ProspectSearchService {
  private readonly logger = new Logger(ProspectSearchService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly auditService: AuditService,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
    private readonly cacheService: ProspectSearchCacheService,
    private readonly historyService: ProspectSearchHistoryService,
    private readonly blackPearlInsightProvider: BlackPearlInsightProvider,
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
        'Prospect Search is not configured. Set BLACKPEARL_API_KEY in the backend environment and restart the server.',
      );
    }

    const jobId = await this.blackPearlInsightProvider.submitPlaybookJob({
      name: companyName,
    });

    if (!jobId) {
      throw new ServiceUnavailableException(
        'BlackPearl could not start playbook generation for this company right now. Please try again shortly.',
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
      message: 'BlackPearl could not generate a playbook for this company. Please try again.',
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
      this.logger.error(
        `Company insight generation failed: tenant=${user.tenantId} company=${
          dto.company.id
        } error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
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

    const lead = await this.leadsService.create(
      { name: company.name, company: company.name },
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
   * Only renders fields that are actually present - a BlackPearl-sourced
   * company only ever has a name, so most of these are typically absent.
   */
  private buildImportNote(company: ProspectCompanyDto): string {
    const lines = ['Imported from Prospect Search.'];

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

    if (company.description) {
      lines.push('', company.description);
    }

    return lines.join('\n');
  }
}
