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
exports.SitesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const branch_scope_1 = require("../branches/branch-scope");
let SitesService = class SitesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async resolveClientId(user, branchId, clientId) {
        const normalizedClientId = clientId?.trim() || null;
        if (!normalizedClientId) {
            return null;
        }
        const client = await this.prisma.client.findFirst({
            where: { id: normalizedClientId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            select: { id: true, branchId: true },
        });
        if (!client) {
            throw new common_1.BadRequestException('Client must belong to this tenant');
        }
        if (branchId && client.branchId && client.branchId !== branchId) {
            throw new common_1.BadRequestException('Client must belong to the selected branch');
        }
        return client.id;
    }
    async create(user, dto) {
        const branchId = (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        const clientId = await this.resolveClientId(user, branchId, dto.client_id);
        const site = await this.prisma.site.create({
            data: {
                name: dto.name,
                address: dto.address,
                instructions: dto.instructions,
                clientId,
                tenantId: user.tenantId,
                branchId,
            },
            include: {
                branch: {
                    select: { id: true, name: true, location: true, status: true },
                },
                client: {
                    select: { id: true, name: true, companyName: true },
                },
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'SITE_CREATED',
            entityType: 'Site',
            entityId: site.id,
            details: `Site "${site.name}" created`,
        });
        return site;
    }
    async findAll(user, requestedBranchId) {
        return this.prisma.site.findMany({
            where: (0, branch_scope_1.branchScopedWhere)(user, requestedBranchId),
            include: {
                branch: {
                    select: { id: true, name: true, location: true, status: true },
                },
                client: {
                    select: { id: true, name: true, companyName: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async update(user, id, dto) {
        const site = await this.prisma.site.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!site) {
            throw new common_1.NotFoundException('Site not found');
        }
        const branchId = dto.branch_id === undefined
            ? undefined
            : (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        const effectiveBranchId = branchId === undefined ? site.branchId : branchId;
        const clientId = dto.client_id === undefined
            ? undefined
            : await this.resolveClientId(user, effectiveBranchId, dto.client_id);
        const updatedSite = await this.prisma.site.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.address !== undefined ? { address: dto.address } : {}),
                ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
                ...(clientId !== undefined ? { clientId } : {}),
                ...(branchId !== undefined ? { branchId } : {}),
            },
            include: {
                branch: {
                    select: { id: true, name: true, location: true, status: true },
                },
                client: {
                    select: { id: true, name: true, companyName: true },
                },
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'SITE_UPDATED',
            entityType: 'Site',
            entityId: site.id,
            details: `Site "${site.name}" updated`,
        });
        return updatedSite;
    }
};
exports.SitesService = SitesService;
exports.SitesService = SitesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SitesService);
//# sourceMappingURL=sites.service.js.map