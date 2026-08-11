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
var ProspectSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProspectSearchService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const leads_service_1 = require("../leads/leads.service");
const notes_service_1 = require("../notes/notes.service");
const blackpearl_insight_provider_1 = require("./providers/blackpearl-insight.provider");
const blackpearl_prospecting_provider_1 = require("./providers/blackpearl-prospecting.provider");
const prospect_discovery_cache_service_1 = require("./prospect-discovery-cache.service");
const prospect_search_cache_service_1 = require("./prospect-search-cache.service");
const prospect_search_history_service_1 = require("./prospect-search-history.service");
const PROVIDER_NAME = 'blackpearl';
const DISCOVERY_PROVIDER_NAME = 'blackpearl_prospecting';
let ProspectSearchService = ProspectSearchService_1 = class ProspectSearchService {
    aiService;
    auditService;
    leadsService;
    notesService;
    cacheService;
    discoveryCacheService;
    historyService;
    blackPearlInsightProvider;
    blackPearlProspectingProvider;
    logger = new common_1.Logger(ProspectSearchService_1.name);
    constructor(aiService, auditService, leadsService, notesService, cacheService, discoveryCacheService, historyService, blackPearlInsightProvider, blackPearlProspectingProvider) {
        this.aiService = aiService;
        this.auditService = auditService;
        this.leadsService = leadsService;
        this.notesService = notesService;
        this.cacheService = cacheService;
        this.discoveryCacheService = discoveryCacheService;
        this.historyService = historyService;
        this.blackPearlInsightProvider = blackPearlInsightProvider;
        this.blackPearlProspectingProvider = blackPearlProspectingProvider;
    }
    async search(dto, user) {
        const companyName = dto.companyName.trim();
        const cached = this.cacheService.get(user.tenantId, companyName, PROVIDER_NAME);
        if (cached) {
            this.logger.log(`Prospect search cache hit: tenant=${user.tenantId} provider=${PROVIDER_NAME} company="${companyName}"`);
            await this.recordHistory(companyName, user);
            return { status: 'completed', companyName, insight: cached.insight };
        }
        if (!this.blackPearlInsightProvider.isConfigured()) {
            this.logger.error('BLACKPEARL_API_KEY is not configured. Prospect Search cannot return results.');
            throw new common_1.ServiceUnavailableException('Prospect Search is temporarily unavailable. Please contact your administrator.');
        }
        const jobId = await this.blackPearlInsightProvider.submitPlaybookJob({
            name: companyName,
        });
        if (!jobId) {
            throw new common_1.ServiceUnavailableException("We couldn't start researching this company right now. Please try again shortly.");
        }
        this.logger.log(`Prospect search job submitted: tenant=${user.tenantId} provider=${PROVIDER_NAME} jobId=${jobId} company="${companyName}"`);
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PROSPECT_SEARCH_PERFORMED',
            entityType: 'PROSPECT_SEARCH',
            details: `Company: "${companyName}" (BlackPearl job ${jobId})`,
        });
        return { status: 'pending', jobId, companyName };
    }
    async getSearchJobStatus(jobId, user) {
        this.logger.debug(`Checking prospect search job status: tenant=${user.tenantId} jobId=${jobId}`);
        const result = await this.blackPearlInsightProvider.getJobResult(jobId);
        if (!result) {
            this.logger.error(`Prospect search job status check FAILED: tenant=${user.tenantId} jobId=${jobId} - returning 503. See BlackPearlInsightProvider logs above for the exact cause.`);
            throw new common_1.ServiceUnavailableException('Could not check playbook status right now. Please try again shortly.');
        }
        if (result.status === 'pending') {
            return { status: 'pending', progress: result.progress };
        }
        if (result.status === 'completed' && result.insight) {
            const companyName = result.companyName ?? '';
            const searchResult = {
                companyName,
                insight: result.insight,
            };
            this.cacheService.set(user.tenantId, companyName, PROVIDER_NAME, searchResult);
            await this.recordHistory(companyName, user);
            this.logger.log(`Prospect search job completed: tenant=${user.tenantId} provider=${PROVIDER_NAME} jobId=${jobId}`);
            return { status: 'completed', companyName, insight: result.insight };
        }
        this.logger.warn(`Prospect search job failed: tenant=${user.tenantId} provider=${PROVIDER_NAME} jobId=${jobId}`);
        return {
            status: 'failed',
            message: "We couldn't generate a sales playbook for this company. Please try again.",
        };
    }
    async recordHistory(companyName, user) {
        try {
            await this.historyService.record({
                tenantId: user.tenantId,
                userId: user.sub,
                prompt: companyName,
                provider: PROVIDER_NAME,
                resultCount: 1,
            });
        }
        catch (error) {
            this.logger.warn(`Failed to record prospect search history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async discover(dto, user) {
        const objective = dto.objective.trim();
        const cacheKey = this.discoveryCacheService.buildKey(user.tenantId, DISCOVERY_PROVIDER_NAME, this.normalizeDiscoveryQuery(dto));
        const cached = this.discoveryCacheService.get(cacheKey);
        if (cached) {
            this.logger.log(`Prospect discovery cache hit: tenant=${user.tenantId} objective="${objective}"`);
            await this.recordDiscoveryHistory(objective, cached.prospects.length, user);
            return { status: 'completed', query: objective, result: cached };
        }
        if (!this.blackPearlProspectingProvider.isConfigured()) {
            this.logger.error('BLACKPEARL_API_KEY is not configured. Prospect discovery cannot return results.');
            throw new common_1.ServiceUnavailableException('Prospect Search is temporarily unavailable. Please contact your administrator.');
        }
        const jobId = await this.blackPearlProspectingProvider.submitProspectingJob({
            objective,
            target: {
                locations: dto.locations,
                industries: dto.industries,
                jobTitles: dto.jobTitles,
                keywords: dto.keywords,
                companyHeadcountMin: dto.companyHeadcountMin,
                companyHeadcountMax: dto.companyHeadcountMax,
            },
            limit: dto.limit,
        });
        if (!jobId) {
            throw new common_1.ServiceUnavailableException("We couldn't start this search right now. Please try again shortly.");
        }
        this.logger.log(`Prospect discovery job submitted: tenant=${user.tenantId} jobId=${jobId} objective="${objective}"`);
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PROSPECT_DISCOVERY_PERFORMED',
            entityType: 'PROSPECT_SEARCH',
            details: `Objective: "${objective}" (BlackPearl prospecting job ${jobId})`,
        });
        return { status: 'pending', jobId, query: objective };
    }
    async getDiscoveryJobStatus(jobId, dto, user) {
        const poll = await this.blackPearlProspectingProvider.getJobResult(jobId);
        if (!poll) {
            this.logger.error(`Prospect discovery job status check FAILED: tenant=${user.tenantId} jobId=${jobId} - returning 503.`);
            throw new common_1.ServiceUnavailableException('Could not check search status right now. Please try again shortly.');
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
            const cacheKey = this.discoveryCacheService.buildKey(user.tenantId, DISCOVERY_PROVIDER_NAME, this.normalizeDiscoveryQuery(dto));
            this.discoveryCacheService.set(cacheKey, result);
            await this.recordDiscoveryHistory(objective, result.prospects.length, user);
            this.logger.log(`Prospect discovery job completed: tenant=${user.tenantId} jobId=${jobId} prospects=${result.prospects.length}`);
            return { status: 'completed', query: objective, result };
        }
        this.logger.warn(`Prospect discovery job failed: tenant=${user.tenantId} jobId=${jobId}`);
        return {
            status: 'failed',
            message: "We couldn't complete this search. Please try again.",
        };
    }
    async recordDiscoveryHistory(objective, resultCount, user) {
        try {
            await this.historyService.record({
                tenantId: user.tenantId,
                userId: user.sub,
                prompt: objective,
                provider: DISCOVERY_PROVIDER_NAME,
                resultCount,
            });
        }
        catch (error) {
            this.logger.warn(`Failed to record prospect discovery history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    normalizeDiscoveryQuery(dto) {
        const parts = [
            dto.objective.trim().toLowerCase(),
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
        let source = 'gemini';
        try {
            const playbook = await this.blackPearlInsightProvider.getPlaybook(dto.company);
            if (playbook) {
                insight = playbook;
                source = 'blackpearl';
            }
            else {
                insight = await this.aiService.generateProspectCompanyInsight(dto.company, dto.prompt);
            }
        }
        catch (error) {
            this.logger.error(`Company insight generation failed: tenant=${user.tenantId} company=${dto.company.id} error=${error instanceof Error ? error.message : String(error)}`);
            throw new common_1.ServiceUnavailableException("We couldn't generate an AI insight for this company right now. Please try again shortly.");
        }
        this.logger.log(`Company insight generated: tenant=${user.tenantId} company=${dto.company.id} source=${source} ms=${Date.now() - aiStartedAt}`);
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
        const lines = ['Imported from Prospect Search.'];
        if (company.website)
            lines.push(`Website: ${company.website}`);
        if (company.industry)
            lines.push(`Industry: ${company.industry}`);
        const location = [company.city, company.state, company.country]
            .filter(Boolean)
            .join(', ');
        if (location)
            lines.push(`Location: ${location}`);
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
};
exports.ProspectSearchService = ProspectSearchService;
exports.ProspectSearchService = ProspectSearchService = ProspectSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        audit_service_1.AuditService,
        leads_service_1.LeadsService,
        notes_service_1.NotesService,
        prospect_search_cache_service_1.ProspectSearchCacheService,
        prospect_discovery_cache_service_1.ProspectDiscoveryCacheService,
        prospect_search_history_service_1.ProspectSearchHistoryService,
        blackpearl_insight_provider_1.BlackPearlInsightProvider,
        blackpearl_prospecting_provider_1.BlackPearlProspectingProvider])
], ProspectSearchService);
//# sourceMappingURL=prospect-search.service.js.map