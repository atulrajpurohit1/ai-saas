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
exports.AiFeedbackController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const ai_monitoring_service_1 = require("./ai-monitoring.service");
const create_ai_feedback_dto_1 = require("./dto/create-ai-feedback.dto");
let AiFeedbackController = class AiFeedbackController {
    aiMonitoringService;
    constructor(aiMonitoringService) {
        this.aiMonitoringService = aiMonitoringService;
    }
    create(user, dto) {
        return this.aiMonitoringService.createFeedback(user.tenantId, user.sub, dto);
    }
    findAll(user) {
        return this.aiMonitoringService.findFeedback(user.tenantId);
    }
};
exports.AiFeedbackController = AiFeedbackController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_ai_feedback_dto_1.CreateAiFeedbackDto]),
    __metadata("design:returntype", void 0)
], AiFeedbackController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiFeedbackController.prototype, "findAll", null);
exports.AiFeedbackController = AiFeedbackController = __decorate([
    (0, common_1.Controller)('ai-feedback'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('ai.manage'),
    __metadata("design:paramtypes", [ai_monitoring_service_1.AiMonitoringService])
], AiFeedbackController);
//# sourceMappingURL=ai-feedback.controller.js.map