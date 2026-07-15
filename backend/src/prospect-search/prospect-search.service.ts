import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiService,
  ProspectCompanyInsight,
  ProspectSearchFilters,
} from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { CompanyInsightDto } from './dto/company-insight.dto';
import { ImportProspectDto } from './dto/import-prospect.dto';
import { ProspectCompanyDto } from './dto/prospect-company.dto';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ViewProspectDto } from './dto/view-prospect.dto';
import {
  COMPANY_PROVIDER_NAME,
  COMPANY_REPOSITORY,
  CompanyRepository,
} from './interfaces/prospect-search.interface';
import { ProspectSearchCacheService } from './prospect-search-cache.service';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import {
  ImportProspectResult,
  ProspectCompany,
  ProspectSearchResult,
  RankedProspectCompany,
} from './types/prospect-search.types';

const MIN_KEYWORD_LENGTH = 3;

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
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: CompanyRepository,
    @Inject(COMPANY_PROVIDER_NAME)
    private readonly providerName: string,
  ) {}

  async search(
    dto: SearchProspectsDto,
    user: ActiveUser,
  ): Promise<ProspectSearchResult> {
    const startedAt = Date.now();
    const cached = this.cacheService.get(
      user.tenantId,
      dto.prompt,
      this.providerName,
    );

    if (cached) {
      this.logger.log(
        `Prospect search cache hit: tenant=${user.tenantId} provider=${this.providerName} results=${cached.results.length}`,
      );
      await this.recordHistory(
        dto.prompt,
        cached.filters,
        cached.results.length,
        user,
      );
      return cached;
    }

    let filters: ProspectSearchFilters;
    const aiStartedAt = Date.now();
    try {
      filters = await this.aiService.generateProspectSearchFilters(dto.prompt);
    } catch (error) {
      this.logger.error(
        `Prospect search AI filter generation failed: tenant=${user.tenantId} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
    const aiDurationMs = Date.now() - aiStartedAt;

    let companies: ProspectCompany[];
    const providerStartedAt = Date.now();
    try {
      companies = await this.companyRepository.search(filters);
    } catch (error) {
      this.logger.error(
        `Prospect search provider failed: tenant=${user.tenantId} provider=${
          this.providerName
        } error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
    const providerDurationMs = Date.now() - providerStartedAt;

    const results = this.rankCompanies(companies, filters, dto.prompt);
    const totalDurationMs = Date.now() - startedAt;

    this.logger.log(
      `Prospect search completed: tenant=${user.tenantId} provider=${this.providerName} ` +
        `aiMs=${aiDurationMs} providerMs=${providerDurationMs} totalMs=${totalDurationMs} ` +
        `results=${results.length} cacheHit=false`,
    );

    const searchResult: ProspectSearchResult = {
      prompt: dto.prompt,
      filters,
      results,
      totalMatches: results.length,
    };

    this.cacheService.set(
      user.tenantId,
      dto.prompt,
      this.providerName,
      searchResult,
    );

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'PROSPECT_SEARCH_PERFORMED',
      entityType: 'PROSPECT_SEARCH',
      details: `Prompt: "${dto.prompt}" -> ${results.length} match(es)`,
    });

    await this.recordHistory(dto.prompt, filters, results.length, user);

    return searchResult;
  }

  private async recordHistory(
    prompt: string,
    filters: ProspectSearchFilters,
    resultCount: number,
    user: ActiveUser,
  ): Promise<void> {
    try {
      await this.historyService.record({
        tenantId: user.tenantId,
        userId: user.sub,
        prompt,
        filters,
        provider: this.providerName,
        resultCount,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record prospect search history: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private rankCompanies(
    companies: ProspectCompany[],
    filters: ProspectSearchFilters,
    prompt: string,
  ): RankedProspectCompany[] {
    const promptTokens = this.tokenize(prompt);

    return companies
      .map((company) => ({
        ...company,
        matchScore: this.scoreCompany(company, filters, promptTokens),
      }))
      .filter((company) => company.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Country match alone (e.g. "United States") is too generic to qualify a
   * result on its own - nearly every mock company shares it. It only ever
   * adds to a score that another, more specific signal already qualified.
   */
  private scoreCompany(
    company: ProspectCompany,
    filters: ProspectSearchFilters,
    promptTokens: string[],
  ): number {
    let qualifyingScore = 0;

    if (
      filters.industry &&
      company.industry.toLowerCase().includes(filters.industry.toLowerCase())
    ) {
      qualifyingScore += 30;
    }

    if (
      filters.state &&
      company.state.toLowerCase() === filters.state.toLowerCase()
    ) {
      qualifyingScore += 20;
    }

    if (
      filters.city &&
      company.city.toLowerCase() === filters.city.toLowerCase()
    ) {
      qualifyingScore += 10;
    }

    if (filters.employeeMin !== null || filters.employeeMax !== null) {
      const min = filters.employeeMin ?? 0;
      const max = filters.employeeMax ?? Number.MAX_SAFE_INTEGER;
      if (company.employeeCount >= min && company.employeeCount <= max) {
        qualifyingScore += 20;
      }
    }

    if (
      filters.revenueRange &&
      company.revenueRange.toLowerCase() === filters.revenueRange.toLowerCase()
    ) {
      qualifyingScore += 10;
    }

    const haystack =
      `${company.name} ${company.industry} ${company.description}`.toLowerCase();
    const keywordSource = filters.keywords.length
      ? filters.keywords
      : promptTokens;
    const matchedKeywords = keywordSource.filter((keyword) =>
      haystack.includes(keyword.toLowerCase()),
    );
    qualifyingScore += Math.min(matchedKeywords.length * 5, 15);

    if (qualifyingScore === 0) return 0;

    const countryBonus =
      filters.country &&
      company.country.toLowerCase() === filters.country.toLowerCase()
        ? 5
        : 0;

    return Math.min(qualifyingScore + countryBonus, 100);
  }

  private tokenize(prompt: string): string[] {
    return prompt
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z0-9-]/g, ''))
      .filter((word) => word.length > MIN_KEYWORD_LENGTH);
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
    try {
      insight = await this.aiService.generateProspectCompanyInsight(
        dto.company,
        dto.prompt,
      );
    } catch (error) {
      this.logger.error(
        `AI insight generation failed: tenant=${user.tenantId} company=${
          dto.company.id
        } error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
    this.logger.log(
      `AI insight generated: tenant=${user.tenantId} company=${dto.company.id} aiMs=${
        Date.now() - aiStartedAt
      }`,
    );

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'AI_INSIGHT_GENERATED',
      entityType: 'PROSPECT_SEARCH',
      entityId: dto.company.id,
      details: `Generated AI insight for "${dto.company.name}"`,
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

  private buildImportNote(company: ProspectCompanyDto): string {
    return [
      'Imported from Prospect Search.',
      `Website: ${company.website}`,
      `Industry: ${company.industry}`,
      `Location: ${company.city}, ${company.state}, ${company.country}`,
      `Employees: ${company.employeeCount}`,
      `Revenue range: ${company.revenueRange}`,
      `Match score: ${company.matchScore}%`,
      '',
      company.description,
    ].join('\n');
  }
}
