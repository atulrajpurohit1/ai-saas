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
exports.DealsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let DealsService = class DealsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(createDealDto, tenantId, userId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: createDealDto.leadId, tenantId },
        });
        if (!lead) {
            throw new common_1.ForbiddenException('Lead not found');
        }
        const deal = await this.prisma.deal.create({
            data: {
                ...createDealDto,
                tenantId,
            },
            include: { lead: true },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entityType: 'DEAL',
            entityId: deal.id,
            details: `Created deal: ${deal.name}`,
        });
        return deal;
    }
    async convertLeadToDeal(leadId, tenantId, userId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const deal = await this.prisma.deal.create({
            data: {
                name: `Deal for ${lead.company}`,
                leadId: lead.id,
                tenantId,
                stage: 'new',
            },
        });
        await this.prisma.lead.update({
            where: { id: leadId },
            data: { status: 'converted' },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CONVERT_LEAD',
            entityType: 'DEAL',
            entityId: deal.id,
            details: `Converted lead ${lead.name} to deal`,
        });
        return deal;
    }
    async findAll(tenantId) {
        return this.prisma.deal.findMany({
            where: { tenantId },
            include: { lead: true, activities: true, notes: true },
        });
    }
    async findOne(id, tenantId) {
        const deal = await this.prisma.deal.findFirst({
            where: { id, tenantId },
            include: { lead: true, activities: true, notes: true },
        });
        if (!deal) {
            throw new common_1.NotFoundException(`Deal with ID ${id} not found`);
        }
        return deal;
    }
    async updateStage(id, updateDealStageDto, tenantId, userId) {
        await this.findOne(id, tenantId);
        const deal = await this.prisma.deal.update({
            where: { id },
            data: { stage: updateDealStageDto.stage },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE_STAGE',
            entityType: 'DEAL',
            entityId: id,
            details: `Stage updated to ${updateDealStageDto.stage}`,
        });
        return deal;
    }
    async remove(id, tenantId, userId) {
        await this.findOne(id, tenantId);
        await this.prisma.deal.delete({ where: { id } });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entityType: 'DEAL',
            entityId: id,
        });
        return { success: true };
    }
};
exports.DealsService = DealsService;
exports.DealsService = DealsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], DealsService);
//# sourceMappingURL=deals.service.js.map