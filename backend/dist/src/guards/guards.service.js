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
exports.GuardsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let GuardsService = class GuardsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(userId, tenantId, dto) {
        const guard = await this.prisma.guard.create({
            data: {
                ...dto,
                tenantId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GUARD_CREATED',
            entityType: 'Guard',
            entityId: guard.id,
            details: `Guard "${guard.name}" created`,
        });
        return guard;
    }
    async findAll(tenantId) {
        return this.prisma.guard.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async update(userId, tenantId, id, dto) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        const updatedGuard = await this.prisma.guard.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GUARD_UPDATED',
            entityType: 'Guard',
            entityId: guard.id,
            details: `Guard "${guard.name}" updated`,
        });
        return updatedGuard;
    }
};
exports.GuardsService = GuardsService;
exports.GuardsService = GuardsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], GuardsService);
//# sourceMappingURL=guards.service.js.map