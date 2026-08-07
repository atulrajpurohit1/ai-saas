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
const DEFAULT_BASE_URL = 'https://api.blackpearl.com/v1';
const DEFAULT_BRAND_PROFILE_KEY = 'blackpearl';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const LOG_BODY_PREVIEW_CHARS = 500;
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
        const job = await this.request(`${this.getBaseUrl()}/playbooks`, {
            method: 'POST',
            headers: this.buildHeaders(apiKey),
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
        const job = await this.request(`${this.getBaseUrl()}/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', headers: this.buildHeaders(apiKey) }, `check job ${jobId}`, jobId);
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
        return { jobId, status: 'failed', progress: null, companyName, insight: null };
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
            await sleep(shortPollDelayMs);
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
    buildHeaders(apiKey) {
        return {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };
    }
    async request(url, init, context, jobId) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const startedAt = Date.now();
            this.logger.debug(`BlackPearl -> ${init.method} ${context} (attempt ${attempt}/${MAX_ATTEMPTS})`);
            let response;
            try {
                response = await fetch(url, { ...init, signal: controller.signal });
            }
            catch (error) {
                clearTimeout(timeout);
                const elapsedMs = Date.now() - startedAt;
                const isTimeout = error instanceof Error && error.name === 'AbortError';
                const reason = isTimeout
                    ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
                    : `network error: ${error instanceof Error ? error.message : String(error)}`;
                this.logger.error(`BlackPearl <- FAILED ${context} (attempt ${attempt}/${MAX_ATTEMPTS}) after ${elapsedMs}ms: ${reason}`);
                if (attempt < MAX_ATTEMPTS) {
                    await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
                    continue;
                }
                return null;
            }
            clearTimeout(timeout);
            const elapsedMs = Date.now() - startedAt;
            const bodyText = await safeReadText(response);
            if (response.status === 401 || response.status === 403) {
                this.logger.error(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - authentication failed, check BLACKPEARL_API_KEY. Body: ${truncate(bodyText)}`);
                return null;
            }
            if (response.status === 404) {
                this.logger.warn(`BlackPearl <- HTTP 404 ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`);
                return null;
            }
            if (response.status === 503) {
                this.logCompleteErrorResponse(response, bodyText, context, jobId);
            }
            if (response.status === 429 || response.status >= 500) {
                if (response.status !== 503) {
                    this.logger.error(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - transient failure. Body: ${truncate(bodyText)}`);
                }
                if (attempt < MAX_ATTEMPTS) {
                    const backoffMs = RETRY_BASE_DELAY_MS *
                        2 ** (attempt - 1) *
                        (response.status === 429 ? 2 : 1);
                    await sleep(backoffMs);
                    continue;
                }
                return null;
            }
            if (!response.ok) {
                this.logger.error(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`);
                return null;
            }
            this.logger.log(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`);
            try {
                return JSON.parse(bodyText);
            }
            catch (error) {
                this.logger.error(`BlackPearl returned an unparseable response trying to ${context}: ${error instanceof Error ? error.message : String(error)}. Raw body: ${truncate(bodyText)}`);
                return null;
            }
        }
        return null;
    }
    logCompleteErrorResponse(response, bodyText, context, jobId) {
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        this.logger.error(`BlackPearl 503 (transient - job continues running server-side) trying to ${context}: ${JSON.stringify({
            httpStatus: response.status,
            jobId: jobId ?? null,
            timestamp: new Date().toISOString(),
            responseHeaders: headers,
            responseBody: bodyText,
        })}`);
    }
};
exports.BlackPearlInsightProvider = BlackPearlInsightProvider;
exports.BlackPearlInsightProvider = BlackPearlInsightProvider = BlackPearlInsightProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BlackPearlInsightProvider);
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function safeReadText(response) {
    try {
        return await response.text();
    }
    catch (error) {
        return `<failed to read response body: ${error instanceof Error ? error.message : String(error)}>`;
    }
}
function truncate(text, maxLength = LOG_BODY_PREVIEW_CHARS) {
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, maxLength)}... (${text.length} chars total)`;
}
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string');
}
function normalizeString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function normalizePersonas(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === 'object' && item !== null)
        .map((item) => ({
        name: normalizeString(item.name) ?? 'Unknown',
        title: normalizeString(item.title),
        description: normalizeString(item.description),
    }));
}
function normalizeObjections(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === 'object' && item !== null)
        .map((item) => ({
        objection: normalizeString(item.objection) ?? '',
        response: normalizeString(item.response) ?? '',
    }))
        .filter((item) => item.objection && item.response);
}
function normalizeBlackPearlResult(raw, fallbackCompanyName) {
    const companyName = normalizeString(raw.company_name) ?? fallbackCompanyName ?? undefined;
    if (!companyName)
        return null;
    return {
        companyName,
        domain: normalizeString(raw.domain),
        website: normalizeString(raw.website),
        businessSummary: normalizeString(raw.business_summary),
        businessObjective: normalizeString(raw.business_objective),
        valueProps: toStringArray(raw.value_props),
        salesAngles: toStringArray(raw.sales_angles),
        keyPersonas: normalizePersonas(raw.key_personas),
        potentialObjections: normalizeObjections(raw.potential_objections),
        meetingNoteExample: normalizeString(raw.meeting_note_example),
        contactOverview: normalizeString(raw.contact_overview),
        readinessLevel: normalizeString(raw.readiness_level),
        documentUrl: normalizeString(raw.document_url),
    };
}
//# sourceMappingURL=blackpearl-insight.provider.js.map