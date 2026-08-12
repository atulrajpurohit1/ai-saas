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
var BlackPearlProspectingProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlackPearlProspectingProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const blackpearl_http_util_1 = require("./blackpearl-http.util");
const DEFAULT_BASE_URL = 'https://api.blackpearl.com/v1';
const DEFAULT_PRODUCT_INFO = 'Commercial security guard services for businesses: on-site security guards, patrols, incident response, and site monitoring for commercial properties.';
const PENDING_JOB_STATUSES = new Set(['queued', 'running']);
const SUCCESS_JOB_STATUS = 'succeeded';
let BlackPearlProspectingProvider = BlackPearlProspectingProvider_1 = class BlackPearlProspectingProvider {
    configService;
    logger = new common_1.Logger(BlackPearlProspectingProvider_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    isConfigured() {
        return Boolean(this.configService.get('BLACKPEARL_API_KEY'));
    }
    async submitProspectingJob(input) {
        const apiKey = this.configService.get('BLACKPEARL_API_KEY');
        if (!apiKey) {
            this.logger.debug('BLACKPEARL_API_KEY is not configured; skipping prospecting submission.');
            return null;
        }
        const campaignName = `Prospect Search: ${input.objective}`.slice(0, 160);
        this.logger.log(`BlackPearl prospecting job creation: submitting objective="${input.objective}" limit=${input.limit ?? 10}`);
        const job = await (0, blackpearl_http_util_1.blackPearlRequest)(this.logger, `${this.getBaseUrl()}/prospects`, {
            method: 'POST',
            headers: (0, blackpearl_http_util_1.blackPearlHeaders)(apiKey),
            body: JSON.stringify({
                campaign_name: campaignName,
                product_info: this.getProductInfo(),
                objective: input.objective,
                limit: input.limit ?? 10,
                mode: 'turbo',
                target: {
                    company_names: input.target?.companyNames ?? [],
                    locations: input.target?.locations ?? [],
                    industries: input.target?.industries ?? [],
                    job_titles: input.target?.jobTitles ?? [],
                    keywords: input.target?.keywords ?? [],
                    company_headcount: input.target?.companyHeadcountMin ||
                        input.target?.companyHeadcountMax
                        ? {
                            min: input.target?.companyHeadcountMin ?? null,
                            max: input.target?.companyHeadcountMax ?? null,
                        }
                        : null,
                },
            }),
        }, `submit prospecting job for "${input.objective}"`);
        if (!job?.id) {
            this.logger.error(`BlackPearl prospecting job creation FAILED for objective="${input.objective}" - see the request log above for the exact HTTP failure.`);
            return null;
        }
        this.logger.log(`BlackPearl prospecting job creation succeeded: jobId=${job.id} initialStatus="${job.status}"`);
        return job.id;
    }
    async getJobResult(jobId) {
        const apiKey = this.configService.get('BLACKPEARL_API_KEY');
        if (!apiKey)
            return null;
        const job = await (0, blackpearl_http_util_1.blackPearlRequest)(this.logger, `${this.getBaseUrl()}/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', headers: (0, blackpearl_http_util_1.blackPearlHeaders)(apiKey) }, `check prospecting job ${jobId}`, jobId);
        if (!job) {
            this.logger.error(`BlackPearl prospecting job status check FAILED for jobId=${jobId} - see the request log above for the exact HTTP failure.`);
            return null;
        }
        if (PENDING_JOB_STATUSES.has(job.status)) {
            return {
                status: 'pending',
                progress: typeof job.progress === 'number' ? job.progress : null,
                stageLabel: currentStageLabel(job.stages),
                result: null,
            };
        }
        if (job.status === SUCCESS_JOB_STATUS && job.result) {
            const result = normalizeProspectingResult(job.result);
            this.logger.log(`BlackPearl prospecting job FINAL STATUS: jobId=${jobId} status="succeeded" prospects=${result.prospects.length}.`);
            return { status: 'completed', progress: 100, stageLabel: null, result };
        }
        this.logger.warn(`BlackPearl prospecting job FINAL STATUS: jobId=${jobId} status="${job.status}"${job.error ? ` (${job.error_code ?? 'error'}: ${job.error})` : ''} - treating as failed.`);
        return { status: 'failed', progress: null, stageLabel: null, result: null };
    }
    getBaseUrl() {
        return (this.configService.get('BLACKPEARL_BASE_URL') || DEFAULT_BASE_URL);
    }
    getProductInfo() {
        return (this.configService.get('BLACKPEARL_PROSPECTING_PRODUCT_INFO') ||
            DEFAULT_PRODUCT_INFO);
    }
};
exports.BlackPearlProspectingProvider = BlackPearlProspectingProvider;
exports.BlackPearlProspectingProvider = BlackPearlProspectingProvider = BlackPearlProspectingProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BlackPearlProspectingProvider);
function currentStageLabel(stages) {
    if (!Array.isArray(stages) || stages.length === 0)
        return null;
    const running = stages.find((stage) => stage.status === 'running');
    if (running?.label)
        return running.label;
    const lastCompleted = [...stages]
        .reverse()
        .find((stage) => stage.status === 'completed');
    return lastCompleted?.label ?? stages[0]?.label ?? null;
}
function toSignals(evidence) {
    if (!Array.isArray(evidence))
        return [];
    return evidence
        .map((item) => ({
        label: (0, blackpearl_http_util_1.normalizeString)(item.label) ?? '',
        snippet: (0, blackpearl_http_util_1.normalizeString)(item.snippet),
    }))
        .filter((item) => item.label);
}
function normalizeProspect(raw) {
    const company = raw.profile?.company ?? undefined;
    return {
        id: raw.id,
        companyName: (0, blackpearl_http_util_1.normalizeString)(company?.name),
        companyDomain: (0, blackpearl_http_util_1.normalizeString)(company?.domain),
        companyIndustry: (0, blackpearl_http_util_1.normalizeString)(company?.industry),
        companyHeadcount: typeof company?.headcount === 'number' ? company.headcount : undefined,
        companyLocation: (0, blackpearl_http_util_1.normalizeString)(company?.location),
        companyDescription: (0, blackpearl_http_util_1.normalizeString)(company?.description),
        contact: {
            fullName: (0, blackpearl_http_util_1.normalizeString)(raw.profile?.full_name),
            jobTitle: (0, blackpearl_http_util_1.normalizeString)(raw.profile?.job_title),
            headline: (0, blackpearl_http_util_1.normalizeString)(raw.profile?.headline),
            location: (0, blackpearl_http_util_1.normalizeString)(raw.profile?.location),
            profileUrl: (0, blackpearl_http_util_1.normalizeString)(raw.profile?.profile_url),
            email: raw.enrichment?.status === 'found'
                ? (0, blackpearl_http_util_1.normalizeString)(raw.enrichment.work_email)
                : undefined,
        },
        qualificationScore: typeof raw.qualification?.score === 'number'
            ? raw.qualification.score
            : 0,
        qualificationReason: (0, blackpearl_http_util_1.normalizeString)(raw.qualification?.reason),
        signals: toSignals(raw.evidence),
    };
}
function normalizeProspectingResult(raw) {
    const prospects = Array.isArray(raw.prospects)
        ? raw.prospects.map(normalizeProspect)
        : [];
    return {
        query: '',
        discoveredCount: raw.summary?.discovered ?? prospects.length,
        qualifiedCount: raw.summary?.qualified ?? prospects.length,
        prospects,
    };
}
//# sourceMappingURL=blackpearl-prospecting.provider.js.map