"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsoModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const audit_module_1 = require("../audit/audit.module");
const auth_module_1 = require("../auth/auth.module");
const prisma_module_1 = require("../prisma/prisma.module");
const roles_module_1 = require("../roles/roles.module");
const sessions_module_1 = require("../sessions/sessions.module");
const sso_auth_controller_1 = require("./sso-auth.controller");
const sso_controller_1 = require("./sso.controller");
const sso_service_1 = require("./sso.service");
let SsoModule = class SsoModule {
};
exports.SsoModule = SsoModule;
exports.SsoModule = SsoModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, roles_module_1.RolesModule, auth_module_1.AuthModule, sessions_module_1.SessionsModule, config_1.ConfigModule],
        controllers: [sso_controller_1.SsoController, sso_auth_controller_1.SsoAuthController],
        providers: [sso_service_1.SsoService],
    })
], SsoModule);
//# sourceMappingURL=sso.module.js.map