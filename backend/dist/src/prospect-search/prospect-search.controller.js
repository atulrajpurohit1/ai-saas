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
exports.ProspectSearchController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const company_insight_dto_1 = require("./dto/company-insight.dto");
const import_prospect_dto_1 = require("./dto/import-prospect.dto");
const rename_saved_search_dto_1 = require("./dto/rename-saved-search.dto");
const save_search_dto_1 = require("./dto/save-search.dto");
const search_prospects_dto_1 = require("./dto/search-prospects.dto");
const view_prospect_dto_1 = require("./dto/view-prospect.dto");
const prospect_search_history_service_1 = require("./prospect-search-history.service");
const prospect_search_rate_limit_guard_1 = require("./prospect-search-rate-limit.guard");
const prospect_search_service_1 = require("./prospect-search.service");
const saved_prospect_search_service_1 = require("./saved-prospect-search.service");
let ProspectSearchController = class ProspectSearchController {
    prospectSearchService;
    historyService;
    savedSearchService;
    constructor(prospectSearchService, historyService, savedSearchService) {
        this.prospectSearchService = prospectSearchService;
        this.historyService = historyService;
        this.savedSearchService = savedSearchService;
    }
    search(dto, user) {
        return this.prospectSearchService.search(dto, user);
    }
    recordView(dto, user) {
        return this.prospectSearchService.recordView(dto, user);
    }
    getCompanyInsight(dto, user) {
        return this.prospectSearchService.getCompanyInsight(dto, user);
    }
    importCompany(dto, user) {
        return this.prospectSearchService.importCompany(dto, user);
    }
    getHistory(user, limit) {
        return this.historyService.list(user.tenantId, user.sub, limit ? Number(limit) : undefined);
    }
    getSavedSearches(user) {
        return this.savedSearchService.list(user.tenantId);
    }
    createSavedSearch(dto, user) {
        return this.savedSearchService.create({
            tenantId: user.tenantId,
            userId: user.sub,
            name: dto.name,
            prompt: dto.prompt,
            filters: dto.filters,
        });
    }
    renameSavedSearch(id, dto, user) {
        return this.savedSearchService.rename(id, user.tenantId, user.sub, dto.name);
    }
    removeSavedSearch(id, user) {
        return this.savedSearchService.remove(id, user.tenantId, user.sub);
    }
};
exports.ProspectSearchController = ProspectSearchController;
__decorate([
    (0, common_1.Post)('search'),
    (0, common_1.UseGuards)(prospect_search_rate_limit_guard_1.ProspectSearchRateLimitGuard),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.view', 'prospect_search.search'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_prospects_dto_1.SearchProspectsDto, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "search", null);
__decorate([
    (0, common_1.Post)('view'),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.view', 'prospect_search.search'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [view_prospect_dto_1.ViewProspectDto, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "recordView", null);
__decorate([
    (0, common_1.Post)('insights'),
    (0, common_1.UseGuards)(prospect_search_rate_limit_guard_1.ProspectSearchRateLimitGuard),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.view', 'prospect_search.search'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [company_insight_dto_1.CompanyInsightDto, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "getCompanyInsight", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, common_1.UseGuards)(prospect_search_rate_limit_guard_1.ProspectSearchRateLimitGuard),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.view', 'prospect_search.search', 'leads.create'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [import_prospect_dto_1.ImportProspectDto, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "importCompany", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('saved-searches'),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "getSavedSearches", null);
__decorate([
    (0, common_1.Post)('saved-searches'),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_search_dto_1.SaveSearchDto, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "createSavedSearch", null);
__decorate([
    (0, common_1.Patch)('saved-searches/:id'),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.manage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, rename_saved_search_dto_1.RenameSavedSearchDto, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "renameSavedSearch", null);
__decorate([
    (0, common_1.Delete)('saved-searches/:id'),
    (0, permissions_decorator_1.RequirePermission)('prospect_search.manage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProspectSearchController.prototype, "removeSavedSearch", null);
exports.ProspectSearchController = ProspectSearchController = __decorate([
    (0, common_1.Controller)('prospect-search'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [prospect_search_service_1.ProspectSearchService,
        prospect_search_history_service_1.ProspectSearchHistoryService,
        saved_prospect_search_service_1.SavedProspectSearchService])
], ProspectSearchController);
//# sourceMappingURL=prospect-search.controller.js.map