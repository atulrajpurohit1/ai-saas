"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatrolsModule = void 0;
const common_1 = require("@nestjs/common");
const patrols_service_1 = require("./patrols.service");
const patrols_controller_1 = require("./patrols.controller");
const guard_patrols_controller_1 = require("./guard-patrols.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_module_1 = require("../audit/audit.module");
let PatrolsModule = class PatrolsModule {
};
exports.PatrolsModule = PatrolsModule;
exports.PatrolsModule = PatrolsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [patrols_controller_1.PatrolsController, guard_patrols_controller_1.GuardPatrolsController],
        providers: [patrols_service_1.PatrolsService],
        exports: [patrols_service_1.PatrolsService],
    })
], PatrolsModule);
//# sourceMappingURL=patrols.module.js.map