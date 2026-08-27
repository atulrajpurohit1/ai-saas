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
exports.EmergencyAlertsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const emergency_alerts_service_1 = require("./emergency-alerts.service");
const emergency_alert_action_dto_1 = require("./dto/emergency-alert-action.dto");
let EmergencyAlertsController = class EmergencyAlertsController {
    emergencyAlertsService;
    constructor(emergencyAlertsService) {
        this.emergencyAlertsService = emergencyAlertsService;
    }
    findAll(user, status) {
        return this.emergencyAlertsService.findAllForAdmin(user, status);
    }
    acknowledge(user, id, dto) {
        return this.emergencyAlertsService.acknowledge(user, id, dto);
    }
    resolve(user, id, dto) {
        return this.emergencyAlertsService.resolve(user, id, dto);
    }
};
exports.EmergencyAlertsController = EmergencyAlertsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmergencyAlertsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(':id/acknowledge'),
    (0, permissions_decorator_1.RequirePermission)('incidents.review'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, emergency_alert_action_dto_1.EmergencyAlertActionDto]),
    __metadata("design:returntype", void 0)
], EmergencyAlertsController.prototype, "acknowledge", null);
__decorate([
    (0, common_1.Post)(':id/resolve'),
    (0, permissions_decorator_1.RequirePermission)('incidents.review'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, emergency_alert_action_dto_1.EmergencyAlertActionDto]),
    __metadata("design:returntype", void 0)
], EmergencyAlertsController.prototype, "resolve", null);
exports.EmergencyAlertsController = EmergencyAlertsController = __decorate([
    (0, common_1.Controller)('emergency-alerts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('incidents.view'),
    __metadata("design:paramtypes", [emergency_alerts_service_1.EmergencyAlertsService])
], EmergencyAlertsController);
//# sourceMappingURL=emergency-alerts.controller.js.map