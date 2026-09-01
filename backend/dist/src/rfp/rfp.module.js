"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RfpModule = void 0;
const common_1 = require("@nestjs/common");
const rfp_service_1 = require("./rfp.service");
const rfp_controller_1 = require("./rfp.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_module_1 = require("../ai/ai.module");
const ai_governance_module_1 = require("../ai-governance/ai-governance.module");
const email_module_1 = require("../email/email.module");
const proposals_module_1 = require("../proposals/proposals.module");
let RfpModule = class RfpModule {
};
exports.RfpModule = RfpModule;
exports.RfpModule = RfpModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            ai_module_1.AiModule,
            ai_governance_module_1.AiGovernanceModule,
            email_module_1.EmailModule,
            proposals_module_1.ProposalsModule,
        ],
        controllers: [rfp_controller_1.RfpController],
        providers: [rfp_service_1.RfpService],
        exports: [rfp_service_1.RfpService],
    })
], RfpModule);
//# sourceMappingURL=rfp.module.js.map