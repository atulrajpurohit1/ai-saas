"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmConnectorsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const prisma_module_1 = require("../prisma/prisma.module");
const crm_connectors_controller_1 = require("./crm-connectors.controller");
const crm_connectors_service_1 = require("./crm-connectors.service");
const crm_provider_interface_1 = require("./providers/crm-provider.interface");
const ghl_provider_1 = require("./providers/ghl.provider");
const hubspot_provider_1 = require("./providers/hubspot.provider");
let CrmConnectorsModule = class CrmConnectorsModule {
};
exports.CrmConnectorsModule = CrmConnectorsModule;
exports.CrmConnectorsModule = CrmConnectorsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [crm_connectors_controller_1.CrmConnectorsController],
        providers: [
            crm_connectors_service_1.CrmConnectorsService,
            hubspot_provider_1.HubspotProvider,
            ghl_provider_1.GhlProvider,
            {
                provide: crm_provider_interface_1.CRM_PROVIDERS,
                useFactory: (hubspot, ghl) => [hubspot, ghl],
                inject: [hubspot_provider_1.HubspotProvider, ghl_provider_1.GhlProvider],
            },
        ],
    })
], CrmConnectorsModule);
//# sourceMappingURL=crm-connectors.module.js.map