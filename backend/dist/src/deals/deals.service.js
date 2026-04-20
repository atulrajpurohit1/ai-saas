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
let DealsService = class DealsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createDealDto, tenantId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: createDealDto.leadId, tenantId },
        });
        if (!lead) {
            throw new common_1.ForbiddenException('Lead not found or does not belong to your tenant');
        }
        return this.prisma.deal.create({
            data: {
                ...createDealDto,
                tenantId,
            },
            include: { lead: true },
        });
    }
    async findAll(tenantId) {
        return this.prisma.deal.findMany({
            where: { tenantId },
            include: { lead: true },
        });
    }
    async findOne(id, tenantId) {
        const deal = await this.prisma.deal.findFirst({
            where: { id, tenantId },
            include: { lead: true },
        });
        if (!deal) {
            throw new common_1.NotFoundException(`Deal with ID ${id} not found for this tenant`);
        }
        return deal;
    }
    async updateStage(id, updateDealStageDto, tenantId) {
        await this.findOne(id, tenantId);
        return this.prisma.deal.update({
            where: { id },
            data: { stage: updateDealStageDto.stage },
        });
    }
    async remove(id, tenantId) {
        await this.findOne(id, tenantId);
        return this.prisma.deal.delete({
            where: { id },
        });
    }
};
exports.DealsService = DealsService;
exports.DealsService = DealsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DealsService);
//# sourceMappingURL=deals.service.js.map