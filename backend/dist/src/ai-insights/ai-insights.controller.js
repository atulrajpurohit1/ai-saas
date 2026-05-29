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
exports.AiInsightsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const ai_insights_service_1 = require("./ai-insights.service");
let AiInsightsController = class AiInsightsController {
    aiInsightsService;
    constructor(aiInsightsService) {
        this.aiInsightsService = aiInsightsService;
    }
    dashboard(user) {
        return this.aiInsightsService.getDashboard(user.tenantId);
    }
    clients(user) {
        return this.aiInsightsService.getClientInsights(user.tenantId);
    }
    guards(user) {
        return this.aiInsightsService.getGuardInsights(user.tenantId);
    }
    sites(user) {
        return this.aiInsightsService.getSiteInsights(user.tenantId);
    }
    billing(user) {
        return this.aiInsightsService.getBillingInsights(user.tenantId);
    }
    incidents(user) {
        return this.aiInsightsService.getIncidentInsights(user.tenantId);
    }
};
exports.AiInsightsController = AiInsightsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiInsightsController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('clients'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiInsightsController.prototype, "clients", null);
__decorate([
    (0, common_1.Get)('guards'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiInsightsController.prototype, "guards", null);
__decorate([
    (0, common_1.Get)('sites'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiInsightsController.prototype, "sites", null);
__decorate([
    (0, common_1.Get)('billing'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiInsightsController.prototype, "billing", null);
__decorate([
    (0, common_1.Get)('incidents'),
    (0, roles_decorator_1.Roles)('admin', 'supervisor'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiInsightsController.prototype, "incidents", null);
exports.AiInsightsController = AiInsightsController = __decorate([
    (0, common_1.Controller)('ai-insights'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:paramtypes", [ai_insights_service_1.AiInsightsService])
], AiInsightsController);
//# sourceMappingURL=ai-insights.controller.js.map