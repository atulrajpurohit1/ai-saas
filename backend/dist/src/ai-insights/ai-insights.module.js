"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiInsightsModule = void 0;
const common_1 = require("@nestjs/common");
const ai_governance_module_1 = require("../ai-governance/ai-governance.module");
const ai_module_1 = require("../ai/ai.module");
const ai_monitoring_module_1 = require("../ai-monitoring/ai-monitoring.module");
const prisma_module_1 = require("../prisma/prisma.module");
const recommendation_service_1 = require("./recommendation.service");
let AiInsightsModule = class AiInsightsModule {
};
exports.AiInsightsModule = AiInsightsModule;
exports.AiInsightsModule = AiInsightsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, ai_module_1.AiModule, ai_monitoring_module_1.AiMonitoringModule, ai_governance_module_1.AiGovernanceModule],
        providers: [recommendation_service_1.RecommendationService],
        exports: [recommendation_service_1.RecommendationService],
    })
], AiInsightsModule);
//# sourceMappingURL=ai-insights.module.js.map