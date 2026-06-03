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
exports.BranchesService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
let BranchesService = class BranchesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(user, dto) {
        this.assertSuperAdmin(user);
        const name = dto.name?.trim();
        const location = dto.location?.trim();
        const managerId = await this.resolveManagerId(user.tenantId, dto.manager_id);
        if (!name || !location) {
            throw new common_1.BadRequestException('Branch name and location are required');
        }
        const branch = await this.prisma.branch.create({
            data: {
                tenantId: user.tenantId,
                name,
                location,
                managerId,
                status: dto.status || 'active',
            },
            include: this.branchInclude(),
        });
        if (managerId) {
            await this.prisma.user.update({
                where: { id: managerId },
                data: {
                    branchId: branch.id,
                    isSuperAdmin: false,
                },
            });
        }
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'BRANCH_CREATED',
            entityType: 'Branch',
            entityId: branch.id,
            details: `Branch "${branch.name}" created`,
        });
        return branch;
    }
    async findAll(user) {
        return this.prisma.branch.findMany({
            where: {
                tenantId: user.tenantId,
                ...(user.isSuperAdmin ? {} : { id: user.branchId || '__none__' }),
            },
            include: this.branchInclude(),
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });
    }
    async findOne(user, id) {
        this.assertBranchAccess(user, id);
        const branch = await this.prisma.branch.findFirst({
            where: { id, tenantId: user.tenantId },
            include: {
                ...this.branchInclude(),
                _count: {
                    select: {
                        clients: true,
                        sites: true,
                        guards: true,
                        shifts: true,
                        incidents: true,
                        invoices: true,
                        reports: true,
                        users: true,
                    },
                },
            },
        });
        if (!branch) {
            throw new common_1.NotFoundException('Branch not found');
        }
        return branch;
    }
    async update(user, id, dto) {
        this.assertSuperAdmin(user);
        const branch = await this.prisma.branch.findFirst({
            where: { id, tenantId: user.tenantId },
        });
        if (!branch) {
            throw new common_1.NotFoundException('Branch not found');
        }
        const managerId = dto.manager_id === undefined
            ? undefined
            : await this.resolveManagerId(user.tenantId, dto.manager_id);
        const updated = await this.prisma.branch.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.location !== undefined ? { location: dto.location.trim() } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
                ...(managerId !== undefined ? { managerId } : {}),
            },
            include: this.branchInclude(),
        });
        if (managerId) {
            await this.prisma.user.update({
                where: { id: managerId },
                data: {
                    branchId: id,
                    isSuperAdmin: false,
                },
            });
        }
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'BRANCH_UPDATED',
            entityType: 'Branch',
            entityId: id,
            details: `Branch "${updated.name}" updated`,
        });
        return updated;
    }
    branchInclude() {
        return {
            manager: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    branchId: true,
                    isSuperAdmin: true,
                },
            },
        };
    }
    async resolveManagerId(tenantId, managerId) {
        const normalized = managerId?.trim() || null;
        if (!normalized)
            return null;
        const manager = await this.prisma.user.findFirst({
            where: {
                id: normalized,
                tenantId,
            },
            select: { id: true, role: true },
        });
        if (!manager) {
            throw new common_1.BadRequestException('Branch manager must belong to this tenant');
        }
        return manager.id;
    }
    assertSuperAdmin(user) {
        if (!user.isSuperAdmin) {
            throw new common_1.ForbiddenException('Only super admins can manage branches');
        }
    }
    assertBranchAccess(user, branchId) {
        if (!user.isSuperAdmin && user.branchId !== branchId) {
            throw new common_1.ForbiddenException('You do not have access to this branch');
        }
    }
};
exports.BranchesService = BranchesService;
exports.BranchesService = BranchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], BranchesService);
//# sourceMappingURL=branches.service.js.map