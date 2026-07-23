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
exports.VendorsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const create_vendor_dto_1 = require("./dto/create-vendor.dto");
const update_vendor_dto_1 = require("./dto/update-vendor.dto");
const vendors_service_1 = require("./vendors.service");
let VendorsController = class VendorsController {
    vendorsService;
    constructor(vendorsService) {
        this.vendorsService = vendorsService;
    }
    create(user, dto) {
        return this.vendorsService.create(user.tenantId, user.sub, dto);
    }
    findAll(user, search) {
        return this.vendorsService.findAll(user.tenantId, search);
    }
    findOne(user, id) {
        return this.vendorsService.findOne(user.tenantId, id);
    }
    update(user, id, dto) {
        return this.vendorsService.update(user.tenantId, user.sub, id, dto);
    }
    remove(user, id) {
        return this.vendorsService.remove(user.tenantId, user.sub, id);
    }
};
exports.VendorsController = VendorsController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('vendors.create'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_vendor_dto_1.CreateVendorDto]),
    __metadata("design:returntype", void 0)
], VendorsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermission)('vendors.update'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_vendor_dto_1.UpdateVendorDto]),
    __metadata("design:returntype", void 0)
], VendorsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.RequirePermission)('vendors.delete'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VendorsController.prototype, "remove", null);
exports.VendorsController = VendorsController = __decorate([
    (0, common_1.Controller)('vendors'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('vendors.view'),
    __metadata("design:paramtypes", [vendors_service_1.VendorsService])
], VendorsController);
//# sourceMappingURL=vendors.controller.js.map