"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsoController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const create_sso_provider_dto_1 = require("./dto/create-sso-provider.dto");
const sso_login_dto_1 = require("./dto/sso-login.dto");
const update_sso_provider_dto_1 = require("./dto/update-sso-provider.dto");
const sso_service_1 = require("./sso.service");
let SsoController = class SsoController {
    ssoService;
    constructor(ssoService) {
        this.ssoService = ssoService;
    }
    listProviders(user) {
        return this.ssoService.listProviders(user);
    }
    createProvider(user, dto) {
        return this.ssoService.createProvider(user, dto);
    }
    updateProvider(user, id, dto) {
        return this.ssoService.updateProvider(user, id, dto);
    }
    testProvider(user, dto) {
        return this.ssoService.testProvider(user, dto);
    }
};
exports.SsoController = SsoController;
__decorate([
    (0, common_1.Get)('providers'),
    (0, permissions_decorator_1.RequirePermission)('sso.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SsoController.prototype, "listProviders", null);
__decorate([
    (0, common_1.Post)('providers'),
    (0, permissions_decorator_1.RequirePermission)('sso.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_sso_provider_dto_1.CreateSSOProviderDto]),
    __metadata("design:returntype", void 0)
], SsoController.prototype, "createProvider", null);
__decorate([
    (0, common_1.Put)('providers/:id'),
    (0, permissions_decorator_1.RequirePermission)('sso.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_sso_provider_dto_1.UpdateSSOProviderDto]),
    __metadata("design:returntype", void 0)
], SsoController.prototype, "updateProvider", null);
__decorate([
    (0, common_1.Post)('test'),
    (0, permissions_decorator_1.RequirePermission)('sso.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sso_login_dto_1.SSOTestDto]),
    __metadata("design:returntype", void 0)
], SsoController.prototype, "testProvider", null);
exports.SsoController = SsoController = __decorate([
    (0, common_1.Controller)('sso'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [sso_service_1.SsoService])
], SsoController);
//# sourceMappingURL=sso.controller.js.map