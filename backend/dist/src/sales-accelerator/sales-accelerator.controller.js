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
exports.SalesAcceleratorController = void 0;
const common_1 = require("@nestjs/common");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const permissions_decorator_1 = require("../auth/decorators/permissions.decorator");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permission_guard_1 = require("../auth/guards/permission.guard");
const analyze_discovery_call_dto_1 = require("./dto/analyze-discovery-call.dto");
const coach_discovery_call_dto_1 = require("./dto/coach-discovery-call.dto");
const create_follow_up_task_dto_1 = require("./dto/create-follow-up-task.dto");
const generate_discovery_proposal_dto_1 = require("./dto/generate-discovery-proposal.dto");
const save_discovery_dto_1 = require("./dto/save-discovery.dto");
const sales_accelerator_service_1 = require("./sales-accelerator.service");
let SalesAcceleratorController = class SalesAcceleratorController {
    salesAcceleratorService;
    constructor(salesAcceleratorService) {
        this.salesAcceleratorService = salesAcceleratorService;
    }
    getDashboard(user) {
        return this.salesAcceleratorService.getDashboard(user.tenantId);
    }
    getLeadWorkspace(leadId, user) {
        return this.salesAcceleratorService.getLeadWorkspace(user.tenantId, leadId);
    }
    getDealWorkspace(dealId, user) {
        return this.salesAcceleratorService.getDealWorkspace(user.tenantId, dealId);
    }
    saveLeadDiscovery(leadId, dto, user) {
        return this.salesAcceleratorService.saveLeadDiscovery(user.tenantId, leadId, dto, user.sub);
    }
    saveDealDiscovery(dealId, dto, user) {
        return this.salesAcceleratorService.saveDealDiscovery(user.tenantId, dealId, dto, user.sub);
    }
    generateLeadDiscoveryGuide(leadId, user) {
        return this.salesAcceleratorService.generateLeadDiscoveryGuide(user.tenantId, leadId, user.sub);
    }
    generateDealDiscoveryGuide(dealId, user) {
        return this.salesAcceleratorService.generateDealDiscoveryGuide(user.tenantId, dealId, user.sub);
    }
    analyzeLeadDiscoveryCall(leadId, dto, user) {
        return this.salesAcceleratorService.analyzeLeadDiscoveryCall(user.tenantId, leadId, dto, user.sub);
    }
    analyzeDealDiscoveryCall(dealId, dto, user) {
        return this.salesAcceleratorService.analyzeDealDiscoveryCall(user.tenantId, dealId, dto, user.sub);
    }
    coachLeadDiscoveryCall(leadId, dto, user) {
        return this.salesAcceleratorService.coachLeadDiscoveryCall(user.tenantId, leadId, dto, user.sub);
    }
    coachDealDiscoveryCall(dealId, dto, user) {
        return this.salesAcceleratorService.coachDealDiscoveryCall(user.tenantId, dealId, dto, user.sub);
    }
    generateLeadOutreach(leadId, user) {
        return this.salesAcceleratorService.generateLeadOutreach(user.tenantId, leadId, user.sub);
    }
    generateDealOutreach(dealId, user) {
        return this.salesAcceleratorService.generateDealOutreach(user.tenantId, dealId, user.sub);
    }
    scoreLead(leadId, user) {
        return this.salesAcceleratorService.scoreLead(user.tenantId, leadId, user.sub);
    }
    scoreDeal(dealId, user) {
        return this.salesAcceleratorService.scoreDeal(user.tenantId, dealId, user.sub);
    }
    generateProposalFromDiscovery(dealId, dto, user) {
        return this.salesAcceleratorService.generateProposalFromDiscovery(user.tenantId, dealId, dto, user.sub);
    }
    createDealFollowUp(dealId, dto, user) {
        return this.salesAcceleratorService.createDealFollowUp(user.tenantId, dealId, dto, user.sub);
    }
    createDealFollowUpSequence(dealId, user) {
        return this.salesAcceleratorService.createDealFollowUpSequence(user.tenantId, dealId, user.sub);
    }
};
exports.SalesAcceleratorController = SalesAcceleratorController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view', 'deals.view'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('leads/:leadId'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "getLeadWorkspace", null);
__decorate([
    (0, common_1.Get)('deals/:dealId'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "getDealWorkspace", null);
__decorate([
    (0, common_1.Post)('leads/:leadId/discovery'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.update'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_discovery_dto_1.SaveDiscoveryDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "saveLeadDiscovery", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/discovery'),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.update'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_discovery_dto_1.SaveDiscoveryDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "saveDealDiscovery", null);
__decorate([
    (0, common_1.Post)('leads/:leadId/discovery-guide'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "generateLeadDiscoveryGuide", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/discovery-guide'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "generateDealDiscoveryGuide", null);
__decorate([
    (0, common_1.Post)('leads/:leadId/discovery-call'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, analyze_discovery_call_dto_1.AnalyzeDiscoveryCallDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "analyzeLeadDiscoveryCall", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/discovery-call'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, analyze_discovery_call_dto_1.AnalyzeDiscoveryCallDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "analyzeDealDiscoveryCall", null);
__decorate([
    (0, common_1.Post)('leads/:leadId/live-coach'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, coach_discovery_call_dto_1.CoachDiscoveryCallDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "coachLeadDiscoveryCall", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/live-coach'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, coach_discovery_call_dto_1.CoachDiscoveryCallDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "coachDealDiscoveryCall", null);
__decorate([
    (0, common_1.Post)('leads/:leadId/outreach'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "generateLeadOutreach", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/outreach'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "generateDealOutreach", null);
__decorate([
    (0, common_1.Post)('leads/:leadId/score'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'leads.view'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "scoreLead", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/score'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'deals.view'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "scoreDeal", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/proposal-from-discovery'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('ai.view', 'proposals.create'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_discovery_proposal_dto_1.GenerateDiscoveryProposalDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "generateProposalFromDiscovery", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/follow-up'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('activities.manage', 'deals.update'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_follow_up_task_dto_1.CreateFollowUpTaskDto, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "createDealFollowUp", null);
__decorate([
    (0, common_1.Post)('deals/:dealId/follow-up-sequence'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequireAnyPermission)('activities.manage', 'deals.update'),
    __param(0, (0, common_1.Param)('dealId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalesAcceleratorController.prototype, "createDealFollowUpSequence", null);
exports.SalesAcceleratorController = SalesAcceleratorController = __decorate([
    (0, common_1.Controller)('sales-accelerator'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [sales_accelerator_service_1.SalesAcceleratorService])
], SalesAcceleratorController);
//# sourceMappingURL=sales-accelerator.controller.js.map