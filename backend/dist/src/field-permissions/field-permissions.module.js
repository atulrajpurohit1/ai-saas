"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldPermissionsModule = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../audit/audit.module");
const prisma_module_1 = require("../prisma/prisma.module");
const roles_module_1 = require("../roles/roles.module");
const field_permissions_controller_1 = require("./field-permissions.controller");
const field_permissions_service_1 = require("./field-permissions.service");
let FieldPermissionsModule = class FieldPermissionsModule {
};
exports.FieldPermissionsModule = FieldPermissionsModule;
exports.FieldPermissionsModule = FieldPermissionsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, roles_module_1.RolesModule],
        controllers: [field_permissions_controller_1.FieldPermissionsController],
        providers: [field_permissions_service_1.FieldPermissionsService],
        exports: [field_permissions_service_1.FieldPermissionsService],
    })
], FieldPermissionsModule);
//# sourceMappingURL=field-permissions.module.js.map