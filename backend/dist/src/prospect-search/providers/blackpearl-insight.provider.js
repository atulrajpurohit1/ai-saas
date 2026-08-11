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
var BlackPearlInsightProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlackPearlInsightProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const blackpearl_http_util_1 = require("./blackpearl-http.util");
const DEFAULT_BASE_URL = 'https://api.blackpearl.com/v1';
const DEFAULT_BRAND_PROFILE_KEY = 'blackpearl';
const PENDING_JOB_STATUSES = new Set(['queued', 'running']);
const SUCCESS_JOB_STATUS = 'succeeded';
let BlackPearlInsightProvider = BlackPearlInsightProvider_1 = class BlackPearlInsightProvider {
    configService;
    logger = new common_1.Logger(BlackPearlInsightProvider_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    isConfigured() {
        return Boolean(this.configService.get('BLACKPEARL_API_KEY'));
    }
    async submitPlaybookJob(company) {
        const apiKey = this.configService.get('BLACKPEARL_API_KEY');
        if (!apiKey) {
            this.logger.debug('BLACKPEARL_API_KEY is not configured; skipping BlackPearl playbook submission.');
            return null;
        }
        this.logger.log(`BlackPearl job creation: submitting playbook request for company="${company.name}" brandProfileKey="${this.getBrandProfileKey()}"`);
        const job = await (0, blackpearl_http_util_1.blackPearlRequest)(this.logger, `${this.getBaseUrl()}/playbooks`, {
            method: 'POST',
            headers: (0, blackpearl_http_util_1.blackPearlHeaders)(apiKey),
            body: JSON.stringify({
                target_company: company.name,
                brand_profile_key: this.getBrandProfileKey(),
            }),
        }, `submit playbook for "${company.name}"`);
        if (!job?.id) {
            this.logger.error(`BlackPearl job creation FAILED for company="${company.name}" - see the request log above for the exact HTTP failure.`);
            return null;
        }
        this.logger.log(`BlackPearl job creation succeeded: jobId=${job.id} company="${company.name}" initialStatus="${job.status}"`);
        return job.id;
    }
    async getJobResult(jobId) {
        const apiKey = this.configService.get('BLACKPEARL_API_KEY');
        if (!apiKey)
            return null;
        const job = await (0, blackpearl_http_util_1.blackPearlRequest)(this.logger, `${this.getBaseUrl()}/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', headers: (0, blackpearl_http_util_1.blackPearlHeaders)(apiKey) }, `check job ${jobId}`, jobId);
        if (!job) {
            this.logger.error(`BlackPearl job polling FAILED for jobId=${jobId} - status check could not be completed after retries. See the request log above for the exact HTTP failure. This poll attempt will be reported as unavailable, NOT as a job failure.`);
            return null;
        }
        const companyName = job.input?.target_company ?? null;
        if (PENDING_JOB_STATUSES.has(job.status)) {
            this.logger.log(`BlackPearl job polling: jobId=${jobId} status="${job.status}" progress=${job.progress ?? 'n/a'} - still running.`);
            return {
                jobId,
                status: 'pending',
                progress: typeof job.progress === 'number' ? job.progress : null,
                companyName,
                insight: null,
            };
        }
        if (job.status === SUCCESS_JOB_STATUS && job.result) {
            const insight = normalizeBlackPearlResult(job.result, companyName);
            if (insight) {
                this.logger.log(`BlackPearl job FINAL STATUS: jobId=${jobId} status="succeeded" - result parsed successfully for company="${insight.companyName}".`);
                return {
                    jobId,
                    status: 'completed',
                    progress: 100,
                    companyName,
                    insight,
                };
            }
            this.logger.warn(`BlackPearl job FINAL STATUS: jobId=${jobId} status="succeeded" but result parsing FAILED (no usable company name in the result payload) - treating as failed.`);
        }
        else {
            this.logger.warn(`BlackPearl job FINAL STATUS: jobId=${jobId} status="${job.status}"${job.error ? ` (${job.error_code ?? 'error'}: ${job.error})` : ''} - treating as failed.`);
        }
        return {
            jobId,
            status: 'failed',
            progress: null,
            companyName,
            insight: null,
        };
    }
    async getPlaybook(company) {
        if (!this.isConfigured())
            return null;
        const jobId = await this.submitPlaybookJob(company);
        if (!jobId)
            return null;
        const shortPollAttempts = 3;
        const shortPollDelayMs = 2000;
        for (let attempt = 0; attempt < shortPollAttempts; attempt += 1) {
            await (0, blackpearl_http_util_1.sleep)(shortPollDelayMs);
            const result = await this.getJobResult(jobId);
            if (!result || result.status === 'pending')
                continue;
            return result.status === 'completed' ? result.insight : null;
        }
        this.logger.debug(`BlackPearl job ${jobId} did not finish within the short-poll window; not waiting further here.`);
        return null;
    }
    getBaseUrl() {
        return (this.configService.get('BLACKPEARL_BASE_URL') || DEFAULT_BASE_URL);
    }
    getBrandProfileKey() {
        return (this.configService.get('BLACKPEARL_BRAND_PROFILE_KEY') ||
            DEFAULT_BRAND_PROFILE_KEY);
    }
};
exports.BlackPearlInsightProvider = BlackPearlInsightProvider;
exports.BlackPearlInsightProvider = BlackPearlInsightProvider = BlackPearlInsightProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BlackPearlInsightProvider);
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string');
}
function normalizePersonas(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === 'object' && item !== null)
        .map((item) => ({
        name: (0, blackpearl_http_util_1.normalizeString)(item.name) ?? 'Unknown',
        title: (0, blackpearl_http_util_1.normalizeString)(item.title),
        description: (0, blackpearl_http_util_1.normalizeString)(item.description),
    }));
}
function normalizeObjections(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === 'object' && item !== null)
        .map((item) => ({
        objection: (0, blackpearl_http_util_1.normalizeString)(item.objection) ?? '',
        response: (0, blackpearl_http_util_1.normalizeString)(item.response) ?? '',
    }))
        .filter((item) => item.objection && item.response);
}
function normalizeBlackPearlResult(raw, fallbackCompanyName) {
    const companyName = (0, blackpearl_http_util_1.normalizeString)(raw.company_name) ?? fallbackCompanyName ?? undefined;
    if (!companyName)
        return null;
    return {
        companyName,
        domain: (0, blackpearl_http_util_1.normalizeString)(raw.domain),
        website: (0, blackpearl_http_util_1.normalizeString)(raw.website),
        businessSummary: (0, blackpearl_http_util_1.normalizeString)(raw.business_summary),
        businessObjective: (0, blackpearl_http_util_1.normalizeString)(raw.business_objective),
        valueProps: toStringArray(raw.value_props),
        salesAngles: toStringArray(raw.sales_angles),
        keyPersonas: normalizePersonas(raw.key_personas),
        potentialObjections: normalizeObjections(raw.potential_objections),
        meetingNoteExample: (0, blackpearl_http_util_1.normalizeString)(raw.meeting_note_example),
        contactOverview: (0, blackpearl_http_util_1.normalizeString)(raw.contact_overview),
        readinessLevel: (0, blackpearl_http_util_1.normalizeString)(raw.readiness_level),
        documentUrl: (0, blackpearl_http_util_1.normalizeString)(raw.document_url),
    };
}
//# sourceMappingURL=blackpearl-insight.provider.js.map