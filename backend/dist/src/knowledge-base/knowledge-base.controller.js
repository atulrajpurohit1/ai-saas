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
exports.KnowledgeBaseController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const create_knowledge_entry_dto_1 = require("./dto/create-knowledge-entry.dto");
const update_knowledge_entry_dto_1 = require("./dto/update-knowledge-entry.dto");
const knowledge_base_service_1 = require("./knowledge-base.service");
const knowledge_base_types_1 = require("./knowledge-base.types");
let KnowledgeBaseController = class KnowledgeBaseController {
    knowledgeBaseService;
    constructor(knowledgeBaseService) {
        this.knowledgeBaseService = knowledgeBaseService;
    }
    categories() {
        return knowledge_base_types_1.KNOWLEDGE_CATEGORIES;
    }
    search(user, q, category, tag) {
        return this.knowledgeBaseService.search(user.tenantId, user.sub, { q, category, tag });
    }
    findAll(user, category, tag, includeArchived) {
        return this.knowledgeBaseService.findAll(user.tenantId, user.sub, {
            category,
            tag,
            includeArchived,
        });
    }
    create(user, dto) {
        return this.knowledgeBaseService.createManual(user.tenantId, user.sub, dto);
    }
    findOne(user, id) {
        return this.knowledgeBaseService.findOne(user.tenantId, user.sub, id);
    }
    update(user, id, dto) {
        return this.knowledgeBaseService.update(user.tenantId, user.sub, id, dto);
    }
    archive(user, id) {
        return this.knowledgeBaseService.archive(user.tenantId, user.sub, id);
    }
};
exports.KnowledgeBaseController = KnowledgeBaseController;
__decorate([
    (0, common_1.Get)('categories'),
    (0, permissions_decorator_1.RequireAnyPermission)('knowledge.view', 'knowledge.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, permissions_decorator_1.RequirePermission)('knowledge.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('q')),
    __param(2, (0, common_1.Query)('category')),
    __param(3, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "search", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.RequirePermission)('knowledge.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('tag')),
    __param(3, (0, common_1.Query)('include_archived')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.RequirePermission)('knowledge.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_knowledge_entry_dto_1.CreateKnowledgeEntryDto]),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.RequirePermission)('knowledge.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.RequirePermission)('knowledge.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_knowledge_entry_dto_1.UpdateKnowledgeEntryDto]),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/archive'),
    (0, permissions_decorator_1.RequirePermission)('knowledge.manage'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], KnowledgeBaseController.prototype, "archive", null);
exports.KnowledgeBaseController = KnowledgeBaseController = __decorate([
    (0, common_1.Controller)('knowledge-base'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [knowledge_base_service_1.KnowledgeBaseService])
], KnowledgeBaseController);
//# sourceMappingURL=knowledge-base.controller.js.map