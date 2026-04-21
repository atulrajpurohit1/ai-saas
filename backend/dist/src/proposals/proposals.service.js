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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProposalsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
let ProposalsService = class ProposalsService {
    prisma;
    aiService;
    auditService;
    constructor(prisma, aiService, auditService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
    }
    async create(tenantId, createProposalDto, userId) {
        const proposal = await this.prisma.proposal.create({
            data: {
                ...createProposalDto,
                tenantId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entityType: 'PROPOSAL',
            entityId: proposal.id,
            details: `Created proposal: ${proposal.title}`,
        });
        await this.prisma.proposalVersion.create({
            data: {
                proposalId: proposal.id,
                content: proposal.content,
                versionNumber: 1,
            },
        });
        return proposal;
    }
    async findAll(tenantId) {
        return this.prisma.proposal.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: {
                lead: true,
                deal: true,
                _count: { select: { versions: true } }
            },
        });
    }
    async findOne(tenantId, id) {
        const proposal = await this.prisma.proposal.findFirst({
            where: { id, tenantId },
            include: {
                lead: true,
                deal: true,
                versions: { orderBy: { versionNumber: 'desc' } },
            },
        });
        if (!proposal) {
            throw new common_1.NotFoundException(`Proposal with ID ${id} not found`);
        }
        return proposal;
    }
    async update(tenantId, id, updateProposalDto, userId) {
        const existing = await this.findOne(tenantId, id);
        const updated = await this.prisma.proposal.update({
            where: { id },
            data: updateProposalDto,
        });
        if (updateProposalDto.content && updateProposalDto.content !== existing.content) {
            const nextVersion = existing.versions.length + 1;
            await this.prisma.proposalVersion.create({
                data: {
                    proposalId: id,
                    content: updateProposalDto.content,
                    versionNumber: nextVersion,
                },
            });
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'PROPOSAL',
            entityId: id,
        });
        return updated;
    }
    async duplicate(tenantId, id, userId) {
        const existing = await this.findOne(tenantId, id);
        const proposal = await this.prisma.proposal.create({
            data: {
                title: `${existing.title} (Copy)`,
                content: existing.content,
                status: 'draft',
                tenantId,
                leadId: existing.leadId,
                dealId: existing.dealId,
            },
        });
        await this.prisma.proposalVersion.create({
            data: {
                proposalId: proposal.id,
                content: proposal.content,
                versionNumber: 1,
            },
        });
        return proposal;
    }
    async export(tenantId, id, userId) {
        const proposal = await this.findOne(tenantId, id);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'EXPORT',
            entityType: 'PROPOSAL',
            entityId: id,
            details: 'Exported proposal as PDF placeholder',
        });
        return {
            content: proposal.content,
            title: proposal.title
        };
    }
    async generateForLead(tenantId, leadId, userId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
        });
        if (!lead) {
            throw new common_1.NotFoundException(`Lead with ID ${leadId} not found`);
        }
        const content = await this.aiService.generateForLead(lead);
        return this.create(tenantId, {
            title: `Security Services Proposal - ${lead.company}`,
            content,
            status: 'draft',
            leadId,
        }, userId);
    }
    async generateBulkProposals(tenantId, userId) {
        const leads = await this.prisma.lead.findMany({
            where: {
                tenantId,
                proposals: { none: {} }
            },
        });
        let generatedCount = 0;
        for (const lead of leads) {
            try {
                await this.generateForLead(tenantId, lead.id, userId);
                generatedCount++;
            }
            catch (error) {
                console.error(`Failed to generate proposal for lead ${lead.id}`, error);
            }
        }
        return { generatedCount, totalProcessed: leads.length };
    }
};
exports.ProposalsService = ProposalsService;
exports.ProposalsService = ProposalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService])
], ProposalsService);
//# sourceMappingURL=proposals.service.js.map