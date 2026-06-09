"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesAcceleratorModule = void 0;
const common_1 = require("@nestjs/common");
const ai_module_1 = require("../ai/ai.module");
const ai_monitoring_module_1 = require("../ai-monitoring/ai-monitoring.module");
const proposals_module_1 = require("../proposals/proposals.module");
const sales_accelerator_controller_1 = require("./sales-accelerator.controller");
const sales_accelerator_service_1 = require("./sales-accelerator.service");
let SalesAcceleratorModule = class SalesAcceleratorModule {
};
exports.SalesAcceleratorModule = SalesAcceleratorModule;
exports.SalesAcceleratorModule = SalesAcceleratorModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule, ai_monitoring_module_1.AiMonitoringModule, proposals_module_1.ProposalsModule],
        controllers: [sales_accelerator_controller_1.SalesAcceleratorController],
        providers: [sales_accelerator_service_1.SalesAcceleratorService],
    })
], SalesAcceleratorModule);
//# sourceMappingURL=sales-accelerator.module.js.map