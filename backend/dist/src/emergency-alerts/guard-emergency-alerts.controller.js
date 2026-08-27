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
exports.GuardEmergencyAlertsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const emergency_alerts_service_1 = require("./emergency-alerts.service");
let GuardEmergencyAlertsController = class GuardEmergencyAlertsController {
    emergencyAlertsService;
    constructor(emergencyAlertsService) {
        this.emergencyAlertsService = emergencyAlertsService;
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
    trigger(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.emergencyAlertsService.triggerForGuard(tenantId, guardId);
    }
    active(user) {
        const { tenantId, guardId } = this.getGuardContext(user);
        return this.emergencyAlertsService.findActiveForGuard(tenantId, guardId);
    }
};
exports.GuardEmergencyAlertsController = GuardEmergencyAlertsController;
__decorate([
    (0, common_1.Post)('emergency-alerts'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardEmergencyAlertsController.prototype, "trigger", null);
__decorate([
    (0, common_1.Get)('emergency-alerts/active'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuardEmergencyAlertsController.prototype, "active", null);
exports.GuardEmergencyAlertsController = GuardEmergencyAlertsController = __decorate([
    (0, common_1.Controller)('guard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('guard'),
    __metadata("design:paramtypes", [emergency_alerts_service_1.EmergencyAlertsService])
], GuardEmergencyAlertsController);
//# sourceMappingURL=guard-emergency-alerts.controller.js.map