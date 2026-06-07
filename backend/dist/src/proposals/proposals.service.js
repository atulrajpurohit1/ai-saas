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
const branding_service_1 = require("../branding/branding.service");
let ProposalsService = class ProposalsService {
    prisma;
    aiService;
    auditService;
    brandingService;
    constructor(prisma, aiService, auditService, brandingService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
        this.brandingService = brandingService;
    }
    async ensureLeadBelongsToTenant(tenantId, leadId) {
        if (!leadId)
            return;
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
            select: { id: true },
        });
        if (!lead) {
            throw new common_1.NotFoundException('Lead not found in this tenant');
        }
    }
    async ensureDealBelongsToTenant(tenantId, dealId) {
        if (!dealId)
            return;
        const deal = await this.prisma.deal.findFirst({
            where: { id: dealId, tenantId },
            select: { id: true },
        });
        if (!deal) {
            throw new common_1.NotFoundException('Deal not found in this tenant');
        }
    }
    async ensureClientBelongsToTenant(tenantId, clientId) {
        if (clientId === undefined || clientId === null)
            return;
        if (!clientId.trim()) {
            throw new common_1.BadRequestException('Client ID is required');
        }
        const client = await this.prisma.client.findFirst({
            where: { id: clientId, tenantId },
            select: { id: true },
        });
        if (!client) {
            throw new common_1.NotFoundException('Client not found in this tenant');
        }
    }
    async buildPdfBuffer(proposal) {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        const branding = await this.brandingService.brandingSnapshot(proposal.tenantId);
        return new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            this.brandingService.addPdfHeader(doc, proposal.title, branding);
            doc.moveDown();
            doc.fontSize(12).fillColor(branding.secondary_color).text(`Generated on: ${new Date().toLocaleDateString()}`, {
                align: 'right',
            });
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
            doc.fontSize(14).text(proposal.content, {
                align: 'justify',
                lineGap: 5,
            });
            doc.end();
        });
    }
    async create(tenantId, createProposalDto, userId) {
        await this.ensureLeadBelongsToTenant(tenantId, createProposalDto.leadId);
        await this.ensureDealBelongsToTenant(tenantId, createProposalDto.dealId);
        await this.ensureClientBelongsToTenant(tenantId, createProposalDto.clientId);
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
            entityType: 'Proposal',
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
                client: true,
                _count: { select: { versions: true } }
            },
        });
    }
    async findOne(tenantId, id, clientId) {
        const proposal = await this.prisma.proposal.findFirst({
            where: {
                id,
                tenantId,
                ...(clientId ? { clientId } : {}),
            },
            include: {
                lead: true,
                deal: true,
                client: true,
                versions: { orderBy: { versionNumber: 'desc' } },
            },
        });
        if (!proposal) {
            throw new common_1.NotFoundException(`Proposal with ID ${id} not found`);
        }
        return proposal;
    }
    async update(tenantId, id, updateProposalDto, userId) {
        await this.ensureLeadBelongsToTenant(tenantId, updateProposalDto.leadId);
        await this.ensureDealBelongsToTenant(tenantId, updateProposalDto.dealId);
        await this.ensureClientBelongsToTenant(tenantId, updateProposalDto.clientId);
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
            entityType: 'Proposal',
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
    async export(tenantId, id, userId, clientId) {
        const proposal = await this.findOne(tenantId, id, clientId);
        return this.buildPdfBuffer(proposal);
    }
    async generateForLead(tenantId, leadId, userId, clientId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
            include: { notes: true, deals: true }
        });
        if (!lead) {
            throw new common_1.NotFoundException(`Lead with ID ${leadId} not found`);
        }
        await this.ensureClientBelongsToTenant(tenantId, clientId);
        const content = await this.aiService.generateForLead(lead);
        return this.create(tenantId, {
            title: `Security Services Proposal - ${lead.company}`,
            content,
            status: 'draft',
            leadId,
            clientId,
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
    async getComments(tenantId, id) {
        await this.findOne(tenantId, id);
        return this.prisma.proposalComment.findMany({
            where: { proposalId: id, tenantId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async addComment(tenantId, id, userId, content) {
        const trimmedContent = content?.trim();
        if (!trimmedContent) {
            throw new common_1.BadRequestException('Comment content is required');
        }
        await this.findOne(tenantId, id);
        const comment = await this.prisma.proposalComment.create({
            data: {
                content: trimmedContent,
                proposalId: id,
                userId,
                tenantId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'COMMENT_ADDED',
            entityType: 'Proposal',
            entityId: id,
            details: 'Admin added a comment to proposal',
        });
        return comment;
    }
    async logAction(tenantId, userId, entityId, action, details) {
        await this.auditService.log({
            tenantId,
            userId,
            action,
            entityType: 'Proposal',
            entityId,
            details,
        });
    }
};
exports.ProposalsService = ProposalsService;
exports.ProposalsService = ProposalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService,
        branding_service_1.BrandingService])
], ProposalsService);
//# sourceMappingURL=proposals.service.js.map