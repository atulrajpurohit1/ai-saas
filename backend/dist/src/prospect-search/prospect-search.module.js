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
const blackpearl_insight_provider_1 = require("./providers/blackpearl-insight.provider");
const blackpearl_prospecting_provider_1 = require("./providers/blackpearl-prospecting.provider");
const prospect_discovery_cache_service_1 = require("./prospect-discovery-cache.service");
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
            prospect_discovery_cache_service_1.ProspectDiscoveryCacheService,
            prospect_search_history_service_1.ProspectSearchHistoryService,
            prospect_search_rate_limit_service_1.ProspectSearchRateLimitService,
            saved_prospect_search_service_1.SavedProspectSearchService,
            blackpearl_insight_provider_1.BlackPearlInsightProvider,
            blackpearl_prospecting_provider_1.BlackPearlProspectingProvider,
        ],
    })
], ProspectSearchModule);
//# sourceMappingURL=prospect-search.module.js.map