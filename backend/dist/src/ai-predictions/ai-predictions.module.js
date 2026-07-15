"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPredictionsModule = void 0;
const common_1 = require("@nestjs/common");
const ai_actions_module_1 = require("../ai-actions/ai-actions.module");
const ai_module_1 = require("../ai/ai.module");
const audit_module_1 = require("../audit/audit.module");
const ai_insights_module_1 = require("../ai-insights/ai-insights.module");
const ai_monitoring_module_1 = require("../ai-monitoring/ai-monitoring.module");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_predictions_controller_1 = require("./ai-predictions.controller");
const prediction_engine_service_1 = require("./prediction-engine.service");
let AiPredictionsModule = class AiPredictionsModule {
};
exports.AiPredictionsModule = AiPredictionsModule;
exports.AiPredictionsModule = AiPredictionsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            ai_module_1.AiModule,
            audit_module_1.AuditModule,
            ai_insights_module_1.AiInsightsModule,
            ai_monitoring_module_1.AiMonitoringModule,
            ai_actions_module_1.AiActionsModule,
        ],
        controllers: [ai_predictions_controller_1.AiPredictionsController],
        providers: [prediction_engine_service_1.PredictionEngineService],
        exports: [prediction_engine_service_1.PredictionEngineService],
    })
], AiPredictionsModule);
//# sourceMappingURL=ai-predictions.module.js.map