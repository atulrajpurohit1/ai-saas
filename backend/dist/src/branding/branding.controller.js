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
exports.BrandingController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const branding_service_1 = require("./branding.service");
const create_domain_dto_1 = require("./dto/create-domain.dto");
const update_branding_dto_1 = require("./dto/update-branding.dto");
let BrandingController = class BrandingController {
    brandingService;
    constructor(brandingService) {
        this.brandingService = brandingService;
    }
    getPublicBranding(domain, tenantSlug) {
        return this.brandingService.getPublicBranding({ domain, tenantSlug });
    }
    getBranding(user) {
        return this.brandingService.getForUser(user);
    }
    updateBranding(user, dto) {
        return this.brandingService.updateBranding(user, dto);
    }
    listDomains(user) {
        return this.brandingService.listDomains(user);
    }
    addDomain(user, dto) {
        return this.brandingService.addDomain(user, dto);
    }
    verifyDomain(user, id) {
        return this.brandingService.verifyDomain(user, id);
    }
};
exports.BrandingController = BrandingController;
__decorate([
    (0, common_1.Get)('public'),
    __param(0, (0, common_1.Query)('domain')),
    __param(1, (0, common_1.Query)('tenant_slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BrandingController.prototype, "getPublicBranding", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('branding.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BrandingController.prototype, "getBranding", null);
__decorate([
    (0, common_1.Put)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('branding.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_branding_dto_1.UpdateBrandingDto]),
    __metadata("design:returntype", void 0)
], BrandingController.prototype, "updateBranding", null);
__decorate([
    (0, common_1.Get)('domains'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequireAnyPermission)('branding.view', 'branding.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BrandingController.prototype, "listDomains", null);
__decorate([
    (0, common_1.Post)('domains'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('branding.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_domain_dto_1.CreateDomainDto]),
    __metadata("design:returntype", void 0)
], BrandingController.prototype, "addDomain", null);
__decorate([
    (0, common_1.Post)('domains/:id/verify'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('branding.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BrandingController.prototype, "verifyDomain", null);
exports.BrandingController = BrandingController = __decorate([
    (0, common_1.Controller)('branding'),
    __metadata("design:paramtypes", [branding_service_1.BrandingService])
], BrandingController);
//# sourceMappingURL=branding.controller.js.map