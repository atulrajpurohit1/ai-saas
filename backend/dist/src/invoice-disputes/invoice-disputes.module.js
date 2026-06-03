"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceDisputesModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const knowledge_base_module_1 = require("../knowledge-base/knowledge-base.module");
const prisma_module_1 = require("../prisma/prisma.module");
const invoice_disputes_controller_1 = require("./invoice-disputes.controller");
const invoice_disputes_service_1 = require("./invoice-disputes.service");
let InvoiceDisputesModule = class InvoiceDisputesModule {
};
exports.InvoiceDisputesModule = InvoiceDisputesModule;
exports.InvoiceDisputesModule = InvoiceDisputesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, knowledge_base_module_1.KnowledgeBaseModule],
        controllers: [invoice_disputes_controller_1.InvoiceDisputesController],
        providers: [invoice_disputes_service_1.InvoiceDisputesService],
    })
], InvoiceDisputesModule);
//# sourceMappingURL=invoice-disputes.module.js.map