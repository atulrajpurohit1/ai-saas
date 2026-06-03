"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiExecutiveCenterModule = void 0;
const common_1 = require("@nestjs/common");
const command_center_module_1 = require("../ai-command-center/command-center.module");
const ai_module_1 = require("../ai/ai.module");
const audit_module_1 = require("../audit/audit.module");
const ai_insights_module_1 = require("../ai-insights/ai-insights.module");
const ai_monitoring_module_1 = require("../ai-monitoring/ai-monitoring.module");
const ai_predictions_module_1 = require("../ai-predictions/ai-predictions.module");
const knowledge_base_module_1 = require("../knowledge-base/knowledge-base.module");
const ai_executive_center_controller_1 = require("./ai-executive-center.controller");
const ai_executive_center_service_1 = require("./ai-executive-center.service");
let AiExecutiveCenterModule = class AiExecutiveCenterModule {
};
exports.AiExecutiveCenterModule = AiExecutiveCenterModule;
exports.AiExecutiveCenterModule = AiExecutiveCenterModule = __decorate([
    (0, common_1.Module)({
        imports: [
            ai_module_1.AiModule,
            audit_module_1.AuditModule,
            ai_insights_module_1.AiInsightsModule,
            ai_monitoring_module_1.AiMonitoringModule,
            ai_predictions_module_1.AiPredictionsModule,
            command_center_module_1.CommandCenterModule,
            knowledge_base_module_1.KnowledgeBaseModule,
        ],
        controllers: [ai_executive_center_controller_1.AiExecutiveCenterController],
        providers: [ai_executive_center_service_1.AiExecutiveCenterService],
    })
], AiExecutiveCenterModule);
//# sourceMappingURL=ai-executive-center.module.js.map