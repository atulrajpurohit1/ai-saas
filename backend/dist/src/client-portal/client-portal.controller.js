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
exports.ClientPortalController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/decorators/get-user.decorator");
const audit_service_1 = require("../audit/audit.service");
let ClientPortalController = class ClientPortalController {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    checkClient(user) {
        if (user.role !== 'client')
            throw new common_1.ForbiddenException('Access denied');
    }
    async getProposals(user) {
        this.checkClient(user);
        return this.prisma.proposal.findMany({
            where: {
                clientId: user.clientId,
                tenantId: user.tenantId
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getProposal(user, id) {
        this.checkClient(user);
        const proposal = await this.prisma.proposal.findFirst({
            where: {
                id,
                clientId: user.clientId,
                tenantId: user.tenantId
            },
            include: {
                versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
            },
        });
        if (!proposal)
            throw new common_1.NotFoundException('Proposal not found');
        return proposal;
    }
    async approveProposal(user, id) {
        const proposal = await this.getProposal(user, id);
        const updated = await this.prisma.proposal.update({
            where: { id: proposal.id },
            data: { status: 'approved' },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PROPOSAL_APPROVED',
            entityType: 'Proposal',
            entityId: id,
            details: `Proposal approved by client`,
        });
        return updated;
    }
    async rejectProposal(user, id) {
        const proposal = await this.getProposal(user, id);
        const updated = await this.prisma.proposal.update({
            where: { id: proposal.id },
            data: { status: 'rejected' },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PROPOSAL_REJECTED',
            entityType: 'Proposal',
            entityId: id,
            details: `Proposal rejected by client`,
        });
        return updated;
    }
    async getComments(user, id) {
        this.checkClient(user);
        await this.getProposal(user, id);
        return this.prisma.proposalComment.findMany({
            where: { proposalId: id, tenantId: user.tenantId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async addComment(user, id, content) {
        this.checkClient(user);
        await this.getProposal(user, id);
        const comment = await this.prisma.proposalComment.create({
            data: {
                content,
                proposalId: id,
                clientUserId: user.sub,
                tenantId: user.tenantId,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'COMMENT_ADDED',
            entityType: 'Proposal',
            entityId: id,
            details: `Client added a comment to proposal`,
        });
        return comment;
    }
    async getTimeline(user, id) {
        this.checkClient(user);
        await this.getProposal(user, id);
        return this.prisma.auditLog.findMany({
            where: {
                entityId: id,
                tenantId: user.tenantId,
                action: { in: ['CREATE', 'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'COMMENT_ADDED', 'DOCUMENT_SHARED'] }
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getDocuments(user) {
        this.checkClient(user);
        return this.prisma.sharedDocument.findMany({
            where: {
                clientId: user.clientId,
                tenantId: user.tenantId
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getProfile(user) {
        this.checkClient(user);
        const client = await this.prisma.client.findFirst({
            where: { id: user.clientId, tenantId: user.tenantId },
        });
        if (!client)
            throw new common_1.NotFoundException('Client profile not found');
        return client;
    }
};
exports.ClientPortalController = ClientPortalController;
__decorate([
    (0, common_1.Get)('proposals'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "getProposals", null);
__decorate([
    (0, common_1.Get)('proposals/:id'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "getProposal", null);
__decorate([
    (0, common_1.Post)('proposals/:id/approve'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "approveProposal", null);
__decorate([
    (0, common_1.Post)('proposals/:id/reject'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "rejectProposal", null);
__decorate([
    (0, common_1.Get)('proposals/:id/comments'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "getComments", null);
__decorate([
    (0, common_1.Post)('proposals/:id/comments'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('content')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "addComment", null);
__decorate([
    (0, common_1.Get)('proposals/:id/timeline'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "getTimeline", null);
__decorate([
    (0, common_1.Get)('documents'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "getDocuments", null);
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClientPortalController.prototype, "getProfile", null);
exports.ClientPortalController = ClientPortalController = __decorate([
    (0, common_1.Controller)('client-portal'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ClientPortalController);
//# sourceMappingURL=client-portal.controller.js.map