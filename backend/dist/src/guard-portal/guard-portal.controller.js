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
const sync_offline_actions_dto_1 = require("./dto/sync-offline-actions.dto");
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
    checkIn(user, id) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.checkIn(tenantId, guardId, id);
    }
    checkOut(user, id) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.checkOut(tenantId, guardId, id);
    }
    syncOfflineActions(user, dto) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.processSyncQueue(tenantId, guardId, dto);
    }
    syncStatus(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.guardPortalService.getSyncStatus(tenantId, guardId);
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
__decorate([
    (0, common_1.Post)('shifts/:id/check-in'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "checkIn", null);
__decorate([
    (0, common_1.Post)('shifts/:id/check-out'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "checkOut", null);
__decorate([
    (0, common_1.Post)('sync'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sync_offline_actions_dto_1.SyncOfflineActionsDto]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "syncOfflineActions", null);
__decorate([
    (0, common_1.Get)('sync/status'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardPortalController.prototype, "syncStatus", null);
exports.GuardPortalController = GuardPortalController = __decorate([
    (0, common_1.Controller)('guard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('guard'),
    __metadata("design:paramtypes", [guard_portal_service_1.GuardPortalService])
], GuardPortalController);
//# sourceMappingURL=guard-portal.controller.js.map