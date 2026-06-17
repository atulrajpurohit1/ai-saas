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
exports.CrmConnectorsController = void 0;
const common_1 = require("@nestjs/common");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const crm_connectors_service_1 = require("./crm-connectors.service");
let CrmConnectorsController = class CrmConnectorsController {
    crmConnectorsService;
    constructor(crmConnectorsService) {
        this.crmConnectorsService = crmConnectorsService;
    }
    getStatus(user) {
        return this.crmConnectorsService.getStatus(user);
    }
    getHubSpotConnectUrl(user) {
        return this.crmConnectorsService.getHubSpotConnectUrl(user);
    }
    async hubSpotCallback(code, state) {
        try {
            await this.crmConnectorsService.handleHubSpotCallback(code, state);
            return { url: this.crmConnectorsService.hubSpotResultUrl(true) };
        }
        catch {
            return { url: this.crmConnectorsService.hubSpotResultUrl(false) };
        }
    }
    importHubSpotContacts(user) {
        return this.crmConnectorsService.importHubSpotContacts(user);
    }
    disconnectHubSpot(user) {
        return this.crmConnectorsService.disconnectHubSpot(user);
    }
};
exports.CrmConnectorsController = CrmConnectorsController;
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequireAnyPermission)('integrations.view', 'crm.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CrmConnectorsController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('hubspot/connect-url'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequireAnyPermission)('integrations.manage', 'crm.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CrmConnectorsController.prototype, "getHubSpotConnectUrl", null);
__decorate([
    (0, common_1.Get)('hubspot/callback'),
    (0, common_1.Redirect)(),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CrmConnectorsController.prototype, "hubSpotCallback", null);
__decorate([
    (0, common_1.Post)('hubspot/import-contacts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequireAnyPermission)('integrations.manage', 'crm.manage', 'leads.import'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CrmConnectorsController.prototype, "importHubSpotContacts", null);
__decorate([
    (0, common_1.Post)('hubspot/disconnect'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('integrations.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CrmConnectorsController.prototype, "disconnectHubSpot", null);
exports.CrmConnectorsController = CrmConnectorsController = __decorate([
    (0, common_1.Controller)('crm-connectors'),
    __metadata("design:paramtypes", [crm_connectors_service_1.CrmConnectorsService])
], CrmConnectorsController);
//# sourceMappingURL=crm-connectors.controller.js.map