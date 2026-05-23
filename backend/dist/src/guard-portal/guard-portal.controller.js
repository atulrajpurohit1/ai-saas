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
exports.GuardPortalController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const guard_portal_service_1 = require("./guard-portal.service");
let GuardPortalController = class GuardPortalController {
    guardPortalService;
    constructor(guardPortalService) {
        this.guardPortalService = guardPortalService;
    }
    getGuardContext(user) {
        if (user.role !== 'guard' || !user.guardId || !user.tenantId) {
            throw new common_1.ForbiddenException('Guard access required');
        }
        return {
            tenantId: user.tenantId,
            guardId: user.guardId,
        };
    }
    me(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.getProfile(tenantId, guardId);
    }
    shifts(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.getAssignedShifts(tenantId, guardId);
    }
    shiftDetail(user, id) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.getShiftDetail(tenantId, guardId, id);
    }
};
exports.GuardPortalController = GuardPortalController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('shifts'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "shifts", null);
__decorate([
    (0, common_1.Get)('shifts/:id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "shiftDetail", null);
exports.GuardPortalController = GuardPortalController = __decorate([
    (0, common_1.Controller)('guard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('guard'),
    __metadata("design:paramtypes", [guard_portal_service_1.GuardPortalService])
], GuardPortalController);
//# sourceMappingURL=guard-portal.controller.js.map