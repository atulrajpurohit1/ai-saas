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
exports.AiExecutiveCenterController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const ai_executive_center_service_1 = require("./ai-executive-center.service");
let AiExecutiveCenterController = class AiExecutiveCenterController {
    executiveCenterService;
    constructor(executiveCenterService) {
        this.executiveCenterService = executiveCenterService;
    }
    dashboard(user) {
        return this.executiveCenterService.getDashboard(user.tenantId, user.sub);
    }
    summary(user) {
        return this.executiveCenterService.getSummary(user.tenantId, user.sub);
    }
    risks(user) {
        return this.executiveCenterService.getRisks(user.tenantId, user.sub);
    }
    opportunities(user) {
        return this.executiveCenterService.getOpportunities(user.tenantId, user.sub);
    }
    recommendations(user) {
        return this.executiveCenterService.getRecommendations(user.tenantId, user.sub);
    }
};
exports.AiExecutiveCenterController = AiExecutiveCenterController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiExecutiveCenterController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiExecutiveCenterController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('risks'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiExecutiveCenterController.prototype, "risks", null);
__decorate([
    (0, common_1.Get)('opportunities'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiExecutiveCenterController.prototype, "opportunities", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiExecutiveCenterController.prototype, "recommendations", null);
exports.AiExecutiveCenterController = AiExecutiveCenterController = __decorate([
    (0, common_1.Controller)('ai-executive-center'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('ai.view'),
    __metadata("design:paramtypes", [ai_executive_center_service_1.AiExecutiveCenterService])
], AiExecutiveCenterController);
//# sourceMappingURL=ai-executive-center.controller.js.map