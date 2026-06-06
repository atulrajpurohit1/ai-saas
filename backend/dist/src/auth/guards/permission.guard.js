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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const roles_service_1 = require("../../roles/roles.service");
let PermissionGuard = class PermissionGuard {
    reflector;
    rolesService;
    constructor(reflector, rolesService) {
        this.reflector = reflector;
        this.rolesService = rolesService;
    }
    async canActivate(context) {
        const requiredPermissions = this.reflector.getAllAndMerge(permissions_decorator_1.PERMISSIONS_KEY, [context.getClass(), context.getHandler()]);
        const anyPermissions = this.reflector.getAllAndMerge(permissions_decorator_1.ANY_PERMISSIONS_KEY, [context.getClass(), context.getHandler()]);
        if ((!requiredPermissions || requiredPermissions.length === 0) &&
            (!anyPermissions || anyPermissions.length === 0)) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const hasRequired = await this.rolesService.hasPermissions(user, requiredPermissions || []);
        if (!hasRequired)
            return false;
        if (!anyPermissions || anyPermissions.length === 0)
            return true;
        return this.rolesService.hasAnyPermission(user, anyPermissions);
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        roles_service_1.RolesService])
], PermissionGuard);
//# sourceMappingURL=permission.guard.js.map