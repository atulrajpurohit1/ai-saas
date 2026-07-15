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
var ApolloCompanyProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApolloCompanyProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const company_normalizer_1 = require("./company-normalizer");
const APOLLO_SEARCH_URL = 'https://api.apollo.io/v1/mixed_companies/search';
const REQUEST_TIMEOUT_MS = 10_000;
const RESULTS_PER_PAGE = 25;
let ApolloCompanyProvider = ApolloCompanyProvider_1 = class ApolloCompanyProvider {
    configService;
    logger = new common_1.Logger(ApolloCompanyProvider_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    async search(filters) {
        const apiKey = this.configService.get('APOLLO_API_KEY');
        if (!apiKey) {
            this.logger.error('APOLLO_API_KEY is not configured. Prospect Search cannot return results.');
            throw new common_1.ServiceUnavailableException('Prospect Search is not configured. Set APOLLO_API_KEY in the backend environment and restart the server.');
        }
        this.logger.log('Searching Apollo Provider...');
        const raw = await this.callApolloSearch(apiKey, filters);
        this.logger.log(`Apollo returned ${raw.length} companies.`);
        this.logger.log('Normalizing Apollo response.');
        return raw.map(company_normalizer_1.normalizeApolloOrganization);
    }
    async callApolloSearch(apiKey, filters) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(APOLLO_SEARCH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'x-api-key': apiKey,
                },
                body: JSON.stringify(this.buildRequestBody(filters)),
                signal: controller.signal,
            });
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.logger.error(`Apollo request timed out after ${REQUEST_TIMEOUT_MS}ms`);
                throw new common_1.ServiceUnavailableException('The company search provider timed out. Please try again.');
            }
            this.logger.error(`Apollo network error: ${error instanceof Error ? error.message : String(error)}`);
            throw new common_1.ServiceUnavailableException('The company search provider is unreachable right now. Please try again shortly.');
        }
        finally {
            clearTimeout(timeout);
        }
        if (response.status === 401 || response.status === 403) {
            this.logger.error(`Apollo authentication failed (HTTP ${response.status}) - check APOLLO_API_KEY`);
            throw new common_1.ServiceUnavailableException('The company search provider rejected the configured API key. Check APOLLO_API_KEY.');
        }
        if (response.status === 429) {
            this.logger.error('Apollo quota exceeded (HTTP 429)');
            throw new common_1.ServiceUnavailableException('The company search provider quota has been exceeded. Please try again later.');
        }
        if (!response.ok) {
            this.logger.error(`Apollo server error (HTTP ${response.status})`);
            throw new common_1.ServiceUnavailableException('The company search provider returned an error. Please try again shortly.');
        }
        const payload = (await response.json());
        return payload.organizations ?? payload.accounts ?? [];
    }
    buildRequestBody(filters) {
        const body = {
            page: 1,
            per_page: RESULTS_PER_PAGE,
        };
        if (filters.industry) {
            body.q_organization_keyword_tags = [filters.industry];
        }
        const location = [filters.city, filters.state, filters.country]
            .filter((part) => Boolean(part))
            .join(', ');
        if (location) {
            body.organization_locations = [location];
        }
        if (filters.employeeMin !== null || filters.employeeMax !== null) {
            const min = filters.employeeMin ?? 1;
            const max = filters.employeeMax ?? 1_000_000;
            body.organization_num_employees_ranges = [`${min},${max}`];
        }
        if (filters.keywords.length) {
            body.q_keywords = filters.keywords.join(' ');
        }
        return body;
    }
};
exports.ApolloCompanyProvider = ApolloCompanyProvider;
exports.ApolloCompanyProvider = ApolloCompanyProvider = ApolloCompanyProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ApolloCompanyProvider);
//# sourceMappingURL=apollo-company.provider.js.map