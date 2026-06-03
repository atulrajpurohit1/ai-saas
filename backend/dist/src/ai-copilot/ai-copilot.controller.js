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
exports.AiCopilotController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const ai_copilot_service_1 = require("./ai-copilot.service");
const ask_copilot_dto_1 = require("./dto/ask-copilot.dto");
let AiCopilotController = class AiCopilotController {
    aiCopilotService;
    constructor(aiCopilotService) {
        this.aiCopilotService = aiCopilotService;
    }
    ask(user, dto) {
        return this.aiCopilotService.ask({
            tenantId: user.tenantId,
            userId: user.sub,
            userRole: user.role,
            question: dto.question,
        });
    }
    history(user, limit) {
        return this.aiCopilotService.history(user.tenantId, user.sub, limit ? Number(limit) : 25);
    }
    suggestedQuestions(user) {
        return this.aiCopilotService.getSuggestedQuestions(user.role);
    }
};
exports.AiCopilotController = AiCopilotController;
__decorate([
    (0, common_1.Post)('ask'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ask_copilot_dto_1.AskCopilotDto]),
    __metadata("design:returntype", void 0)
], AiCopilotController.prototype, "ask", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiCopilotController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('suggested-questions'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiCopilotController.prototype, "suggestedQuestions", null);
exports.AiCopilotController = AiCopilotController = __decorate([
    (0, common_1.Controller)('ai-copilot'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin', 'finance'),
    __metadata("design:paramtypes", [ai_copilot_service_1.AiCopilotService])
], AiCopilotController);
//# sourceMappingURL=ai-copilot.controller.js.map