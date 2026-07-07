"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProspectSearchModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ai_module_1 = require("../ai/ai.module");
const audit_module_1 = require("../audit/audit.module");
const leads_module_1 = require("../leads/leads.module");
const notes_module_1 = require("../notes/notes.module");
const prisma_module_1 = require("../prisma/prisma.module");
const prospect_search_interface_1 = require("./interfaces/prospect-search.interface");
const mock_company_repository_service_1 = require("./mock-company-repository.service");
const apollo_company_provider_1 = require("./providers/apollo-company.provider");
const clearbit_company_provider_1 = require("./providers/clearbit-company.provider");
const crunchbase_company_provider_1 = require("./providers/crunchbase-company.provider");
const provider_config_1 = require("./providers/provider.config");
const prospect_search_cache_service_1 = require("./prospect-search-cache.service");
const prospect_search_controller_1 = require("./prospect-search.controller");
const prospect_search_history_service_1 = require("./prospect-search-history.service");
const prospect_search_rate_limit_service_1 = require("./prospect-search-rate-limit.service");
const prospect_search_service_1 = require("./prospect-search.service");
const saved_prospect_search_service_1 = require("./saved-prospect-search.service");
let ProspectSearchModule = class ProspectSearchModule {
};
exports.ProspectSearchModule = ProspectSearchModule;
exports.ProspectSearchModule = ProspectSearchModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            ai_module_1.AiModule,
            audit_module_1.AuditModule,
            leads_module_1.LeadsModule,
            notes_module_1.NotesModule,
            prisma_module_1.PrismaModule,
        ],
        controllers: [prospect_search_controller_1.ProspectSearchController],
        providers: [
            prospect_search_service_1.ProspectSearchService,
            prospect_search_cache_service_1.ProspectSearchCacheService,
            prospect_search_history_service_1.ProspectSearchHistoryService,
            prospect_search_rate_limit_service_1.ProspectSearchRateLimitService,
            saved_prospect_search_service_1.SavedProspectSearchService,
            mock_company_repository_service_1.MockCompanyRepositoryService,
            apollo_company_provider_1.ApolloCompanyProvider,
            crunchbase_company_provider_1.CrunchbaseCompanyProvider,
            clearbit_company_provider_1.ClearbitCompanyProvider,
            {
                provide: prospect_search_interface_1.COMPANY_PROVIDER_NAME,
                useFactory: (configService) => (0, provider_config_1.resolveCompanyProviderName)(configService.get('COMPANY_PROVIDER')),
                inject: [config_1.ConfigService],
            },
            {
                provide: prospect_search_interface_1.COMPANY_REPOSITORY,
                useFactory: (providerName, mock, apollo, crunchbase, clearbit) => {
                    switch (providerName) {
                        case 'apollo':
                            return apollo;
                        case 'crunchbase':
                            return crunchbase;
                        case 'clearbit':
                            return clearbit;
                        case 'mock':
                        default:
                            return mock;
                    }
                },
                inject: [
                    prospect_search_interface_1.COMPANY_PROVIDER_NAME,
                    mock_company_repository_service_1.MockCompanyRepositoryService,
                    apollo_company_provider_1.ApolloCompanyProvider,
                    crunchbase_company_provider_1.CrunchbaseCompanyProvider,
                    clearbit_company_provider_1.ClearbitCompanyProvider,
                ],
            },
        ],
    })
], ProspectSearchModule);
//# sourceMappingURL=prospect-search.module.js.map