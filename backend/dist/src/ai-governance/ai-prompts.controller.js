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
exports.AiPromptsController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const ai_governance_service_1 = require("./ai-governance.service");
const create_prompt_version_dto_1 = require("./dto/create-prompt-version.dto");
let AiPromptsController = class AiPromptsController {
    aiGovernanceService;
    constructor(aiGovernanceService) {
        this.aiGovernanceService = aiGovernanceService;
    }
    findAll(user) {
        return this.aiGovernanceService.listPrompts(user.tenantId);
    }
    create(user, dto) {
        return this.aiGovernanceService.createPromptVersion(user.tenantId, user.sub, dto);
    }
    activate(user, id) {
        return this.aiGovernanceService.activatePromptVersion(id, user.tenantId, user.sub);
    }
    deactivate(user, id) {
        return this.aiGovernanceService.deactivatePromptVersion(id, user.tenantId, user.sub);
    }
};
exports.AiPromptsController = AiPromptsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiPromptsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_prompt_version_dto_1.CreatePromptVersionDto]),
    __metadata("design:returntype", void 0)
], AiPromptsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/activate'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiPromptsController.prototype, "activate", null);
__decorate([
    (0, common_1.Post)(':id/deactivate'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiPromptsController.prototype, "deactivate", null);
exports.AiPromptsController = AiPromptsController = __decorate([
    (0, common_1.Controller)('ai-prompts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    (0, permissions_decorator_1.RequirePermission)('ai.governance'),
    __metadata("design:paramtypes", [ai_governance_service_1.AiGovernanceService])
], AiPromptsController);
//# sourceMappingURL=ai-prompts.controller.js.map