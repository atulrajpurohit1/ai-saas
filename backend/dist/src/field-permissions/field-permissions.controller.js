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
exports.FieldPermissionsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const update_field_permissions_dto_1 = require("./dto/update-field-permissions.dto");
const field_permissions_service_1 = require("./field-permissions.service");
let FieldPermissionsController = class FieldPermissionsController {
    fieldPermissionsService;
    constructor(fieldPermissionsService) {
        this.fieldPermissionsService = fieldPermissionsService;
    }
    listFieldDefinitions() {
        return this.fieldPermissionsService.listFieldDefinitions();
    }
    getEffectivePermissions(user, entity) {
        return this.fieldPermissionsService.getEffectivePermissions(user, entity);
    }
    listForRole(user, roleId) {
        return this.fieldPermissionsService.listForRole(user, roleId);
    }
    updateRolePermissions(user, roleId, dto) {
        return this.fieldPermissionsService.updateRolePermissions(user, roleId, dto);
    }
};
exports.FieldPermissionsController = FieldPermissionsController;
__decorate([
    (0, common_1.Get)('fields'),
    (0, permissions_decorator_1.RequirePermission)('roles.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FieldPermissionsController.prototype, "listFieldDefinitions", null);
__decorate([
    (0, common_1.Get)('effective'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('entity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FieldPermissionsController.prototype, "getEffectivePermissions", null);
__decorate([
    (0, common_1.Get)(':roleId'),
    (0, permissions_decorator_1.RequirePermission)('roles.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('roleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FieldPermissionsController.prototype, "listForRole", null);
__decorate([
    (0, common_1.Put)(':roleId'),
    (0, permissions_decorator_1.RequirePermission)('roles.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('roleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_field_permissions_dto_1.UpdateFieldPermissionsDto]),
    __metadata("design:returntype", void 0)
], FieldPermissionsController.prototype, "updateRolePermissions", null);
exports.FieldPermissionsController = FieldPermissionsController = __decorate([
    (0, common_1.Controller)('field-permissions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [field_permissions_service_1.FieldPermissionsService])
], FieldPermissionsController);
//# sourceMappingURL=field-permissions.controller.js.map