"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProspectSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProspectSearchService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const leads_service_1 = require("../leads/leads.service");
const notes_service_1 = require("../notes/notes.service");
const prospect_search_interface_1 = require("./interfaces/prospect-search.interface");
const prospect_search_cache_service_1 = require("./prospect-search-cache.service");
const prospect_search_history_service_1 = require("./prospect-search-history.service");
const MIN_KEYWORD_LENGTH = 3;
let ProspectSearchService = ProspectSearchService_1 = class ProspectSearchService {
    aiService;
    auditService;
    leadsService;
    notesService;
    cacheService;
    historyService;
    companyRepository;
    providerName;
    logger = new common_1.Logger(ProspectSearchService_1.name);
    constructor(aiService, auditService, leadsService, notesService, cacheService, historyService, companyRepository, providerName) {
        this.aiService = aiService;
        this.auditService = auditService;
        this.leadsService = leadsService;
        this.notesService = notesService;
        this.cacheService = cacheService;
        this.historyService = historyService;
        this.companyRepository = companyRepository;
        this.providerName = providerName;
    }
    async search(dto, user) {
        const startedAt = Date.now();
        const cached = this.cacheService.get(user.tenantId, dto.prompt, this.providerName);
        if (cached) {
            this.logger.log(`Prospect search cache hit: tenant=${user.tenantId} provider=${this.providerName} results=${cached.results.length}`);
            await this.recordHistory(dto.prompt, cached.filters, cached.results.length, user);
            return cached;
        }
        let filters;
        const aiStartedAt = Date.now();
        try {
            filters = await this.aiService.generateProspectSearchFilters(dto.prompt);
        }
        catch (error) {
            this.logger.error(`Prospect search AI filter generation failed: tenant=${user.tenantId} error=${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        const aiDurationMs = Date.now() - aiStartedAt;
        let companies;
        const providerStartedAt = Date.now();
        try {
            companies = await this.companyRepository.search(filters);
        }
        catch (error) {
            this.logger.error(`Prospect search provider failed: tenant=${user.tenantId} provider=${this.providerName} error=${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        const providerDurationMs = Date.now() - providerStartedAt;
        const results = this.rankCompanies(companies, filters, dto.prompt);
        const totalDurationMs = Date.now() - startedAt;
        this.logger.log(`Prospect search completed: tenant=${user.tenantId} provider=${this.providerName} ` +
            `aiMs=${aiDurationMs} providerMs=${providerDurationMs} totalMs=${totalDurationMs} ` +
            `results=${results.length} cacheHit=false`);
        const searchResult = {
            prompt: dto.prompt,
            filters,
            results,
            totalMatches: results.length,
        };
        this.cacheService.set(user.tenantId, dto.prompt, this.providerName, searchResult);
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
    async recordHistory(prompt, filters, resultCount, user) {
        try {
            await this.historyService.record({
                tenantId: user.tenantId,
                userId: user.sub,
                prompt,
                filters,
                provider: this.providerName,
                resultCount,
            });
        }
        catch (error) {
            this.logger.warn(`Failed to record prospect search history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    rankCompanies(companies, filters, prompt) {
        const promptTokens = this.tokenize(prompt);
        return companies
            .map((company) => ({
            ...company,
            matchScore: this.scoreCompany(company, filters, promptTokens),
        }))
            .filter((company) => company.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore);
    }
    scoreCompany(company, filters, promptTokens) {
        let qualifyingScore = 0;
        if (filters.industry &&
            company.industry.toLowerCase().includes(filters.industry.toLowerCase())) {
            qualifyingScore += 30;
        }
        if (filters.state &&
            company.state.toLowerCase() === filters.state.toLowerCase()) {
            qualifyingScore += 20;
        }
        if (filters.city &&
            company.city.toLowerCase() === filters.city.toLowerCase()) {
            qualifyingScore += 10;
        }
        if (filters.employeeMin !== null || filters.employeeMax !== null) {
            const min = filters.employeeMin ?? 0;
            const max = filters.employeeMax ?? Number.MAX_SAFE_INTEGER;
            if (company.employeeCount >= min && company.employeeCount <= max) {
                qualifyingScore += 20;
            }
        }
        if (filters.revenueRange &&
            company.revenueRange.toLowerCase() === filters.revenueRange.toLowerCase()) {
            qualifyingScore += 10;
        }
        const haystack = `${company.name} ${company.industry} ${company.description}`.toLowerCase();
        const keywordSource = filters.keywords.length
            ? filters.keywords
            : promptTokens;
        const matchedKeywords = keywordSource.filter((keyword) => haystack.includes(keyword.toLowerCase()));
        qualifyingScore += Math.min(matchedKeywords.length * 5, 15);
        if (qualifyingScore === 0)
            return 0;
        const countryBonus = filters.country &&
            company.country.toLowerCase() === filters.country.toLowerCase()
            ? 5
            : 0;
        return Math.min(qualifyingScore + countryBonus, 100);
    }
    tokenize(prompt) {
        return prompt
            .split(/\s+/)
            .map((word) => word.replace(/[^a-zA-Z0-9-]/g, ''))
            .filter((word) => word.length > MIN_KEYWORD_LENGTH);
    }
    async recordView(dto, user) {
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
    async getCompanyInsight(dto, user) {
        const aiStartedAt = Date.now();
        let insight;
        try {
            insight = await this.aiService.generateProspectCompanyInsight(dto.company, dto.prompt);
        }
        catch (error) {
            this.logger.error(`AI insight generation failed: tenant=${user.tenantId} company=${dto.company.id} error=${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        this.logger.log(`AI insight generated: tenant=${user.tenantId} company=${dto.company.id} aiMs=${Date.now() - aiStartedAt}`);
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
    async importCompany(dto, user) {
        const { company, force } = dto;
        if (!force) {
            const domain = this.extractDomain(company.website);
            const duplicate = await this.leadsService.findPotentialDuplicate(user.tenantId, company.name, domain);
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
        const lead = await this.leadsService.create({ name: company.name, company: company.name }, user.tenantId, user.sub);
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
    extractDomain(website) {
        if (!website)
            return null;
        try {
            const url = new URL(website.includes('://') ? website : `https://${website}`);
            return url.hostname.replace(/^www\./, '').toLowerCase();
        }
        catch {
            return null;
        }
    }
    buildImportNote(company) {
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
};
exports.ProspectSearchService = ProspectSearchService;
exports.ProspectSearchService = ProspectSearchService = ProspectSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Inject)(prospect_search_interface_1.COMPANY_REPOSITORY)),
    __param(7, (0, common_1.Inject)(prospect_search_interface_1.COMPANY_PROVIDER_NAME)),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        audit_service_1.AuditService,
        leads_service_1.LeadsService,
        notes_service_1.NotesService,
        prospect_search_cache_service_1.ProspectSearchCacheService,
        prospect_search_history_service_1.ProspectSearchHistoryService, Object, String])
], ProspectSearchService);
//# sourceMappingURL=prospect-search.service.js.map