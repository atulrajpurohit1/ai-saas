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
let ProposalsService = class ProposalsService {
    prisma;
    aiService;
    constructor(prisma, aiService) {
        this.prisma = prisma;
        this.aiService = aiService;
    }
    async create(tenantId, createProposalDto) {
        return this.prisma.proposal.create({
            data: {
                ...createProposalDto,
                tenantId,
            },
        });
    }
    async findAll(tenantId) {
        return this.prisma.proposal.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: { lead: true },
        });
    }
    async findOne(tenantId, id) {
        const proposal = await this.prisma.proposal.findFirst({
            where: { id, tenantId },
        });
        if (!proposal) {
            throw new common_1.NotFoundException(`Proposal with ID ${id} not found`);
        }
        return proposal;
    }
    async update(tenantId, id, updateProposalDto) {
        await this.findOne(tenantId, id);
        return this.prisma.proposal.update({
            where: { id },
            data: updateProposalDto,
        });
    }
    async duplicate(tenantId, id) {
        const existing = await this.findOne(tenantId, id);
        return this.prisma.proposal.create({
            data: {
                title: `${existing.title} (Copy)`,
                content: existing.content,
                status: 'draft',
                tenantId,
            },
        });
    }
    async generateForLead(tenantId, leadId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
        });
        if (!lead) {
            throw new common_1.NotFoundException(`Lead with ID ${leadId} not found`);
        }
        const content = await this.aiService.generateForLead(lead);
        return this.prisma.proposal.create({
            data: {
                title: `Security Services Proposal - ${lead.company}`,
                content,
                status: 'draft',
                tenantId,
                leadId,
            },
        });
    }
    async generateBulkProposals(tenantId) {
        const leads = await this.prisma.lead.findMany({
            where: {
                tenantId,
                proposals: {
                    none: {}
                }
            },
        });
        let generatedCount = 0;
        for (const lead of leads) {
            try {
                const content = await this.aiService.generateForLead(lead);
                await this.prisma.proposal.create({
                    data: {
                        title: `Security Services Proposal - ${lead.company}`,
                        content,
                        status: 'draft',
                        tenantId,
                        leadId: lead.id,
                    },
                });
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
        ai_service_1.AiService])
], ProposalsService);
//# sourceMappingURL=proposals.service.js.map