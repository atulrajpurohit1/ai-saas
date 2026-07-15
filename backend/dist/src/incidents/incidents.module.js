"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const prisma_module_1 = require("../prisma/prisma.module");
const client_incidents_controller_1 = require("./client-incidents.controller");
const guard_incidents_controller_1 = require("./guard-incidents.controller");
const incidents_controller_1 = require("./incidents.controller");
const incidents_service_1 = require("./incidents.service");
let IncidentsModule = class IncidentsModule {
};
exports.IncidentsModule = IncidentsModule;
exports.IncidentsModule = IncidentsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [incidents_controller_1.IncidentsController, guard_incidents_controller_1.GuardIncidentsController, client_incidents_controller_1.ClientIncidentsController],
        providers: [incidents_service_1.IncidentsService],
        exports: [incidents_service_1.IncidentsService],
    })
], IncidentsModule);
//# sourceMappingURL=incidents.module.js.map