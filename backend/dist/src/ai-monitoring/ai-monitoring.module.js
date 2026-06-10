"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiMonitoringModule = void 0;
const common_1 = require("@nestjs/common");
const ai_governance_module_1 = require("../ai-governance/ai-governance.module");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_feedback_controller_1 = require("./ai-feedback.controller");
const ai_monitoring_service_1 = require("./ai-monitoring.service");
let AiMonitoringModule = class AiMonitoringModule {
};
exports.AiMonitoringModule = AiMonitoringModule;
exports.AiMonitoringModule = AiMonitoringModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, ai_governance_module_1.AiGovernanceModule],
        controllers: [ai_feedback_controller_1.AiFeedbackController],
        providers: [ai_monitoring_service_1.AiMonitoringService],
        exports: [ai_monitoring_service_1.AiMonitoringService],
    })
], AiMonitoringModule);
//# sourceMappingURL=ai-monitoring.module.js.map