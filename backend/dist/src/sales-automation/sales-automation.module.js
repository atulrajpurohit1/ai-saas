"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesAutomationModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const prisma_module_1 = require("../prisma/prisma.module");
const sales_automation_controller_1 = require("./sales-automation.controller");
const sales_automation_service_1 = require("./sales-automation.service");
let SalesAutomationModule = class SalesAutomationModule {
};
exports.SalesAutomationModule = SalesAutomationModule;
exports.SalesAutomationModule = SalesAutomationModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [sales_automation_controller_1.SalesAutomationController],
        providers: [sales_automation_service_1.SalesAutomationService],
    })
], SalesAutomationModule);
//# sourceMappingURL=sales-automation.module.js.map