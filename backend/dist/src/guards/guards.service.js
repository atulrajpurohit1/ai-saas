"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const branch_scope_1 = require("../branches/branch-scope");
const field_permissions_service_1 = require("../field-permissions/field-permissions.service");
const bcrypt = __importStar(require("bcrypt"));
const webhooks_service_1 = require("../webhooks/webhooks.service");
let GuardsService = class GuardsService {
    prisma;
    auditService;
    webhooksService;
    fieldPermissionsService;
    constructor(prisma, auditService, webhooksService, fieldPermissionsService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.webhooksService = webhooksService;
        this.fieldPermissionsService = fieldPermissionsService;
    }
    normalizeContact(dto) {
        const phone = dto.phone?.trim() || undefined;
        const email = dto.email?.trim().toLowerCase() || undefined;
        return { phone, email };
    }
    withoutPasswordHash(guard) {
        const { passwordHash, ...safeGuard } = guard;
        return safeGuard;
    }
    optionalText(value) {
        if (value === undefined)
            return undefined;
        const trimmed = value?.trim();
        return trimmed || null;
    }
    sensitiveGuardData(dto) {
        const bankDetails = dto.bank_details ?? dto.bankDetails;
        const personalNotes = dto.personal_notes ?? dto.personalNotes;
        return {
            ...(dto.salary !== undefined ? { salary: dto.salary } : {}),
            ...(bankDetails !== undefined
                ? { bankDetails: this.optionalText(bankDetails) }
                : {}),
            ...(dto.documents !== undefined
                ? { documents: this.optionalText(dto.documents) }
                : {}),
            ...(personalNotes !== undefined
                ? { personalNotes: this.optionalText(personalNotes) }
                : {}),
        };
    }
    async create(user, dto) {
        await this.fieldPermissionsService.assertCanEditFields(user, 'guard', dto);
        const name = dto.name?.trim();
        const { phone, email } = this.normalizeContact(dto);
        const branchId = (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        if (!name) {
            throw new common_1.BadRequestException('Guard name is required');
        }
        if (!phone && !email) {
            throw new common_1.BadRequestException('Guard phone or email is required');
        }
        const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
        const guard = await this.prisma.guard.create({
            data: {
                name,
                phone,
                email,
                passwordHash,
                ...this.sensitiveGuardData(dto),
                tenantId: user.tenantId,
                branchId,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_CREATED',
            entityType: 'Guard',
            entityId: guard.id,
            details: `Guard "${guard.name}" created`,
        });
        const safeGuard = this.withoutPasswordHash(guard);
        await this.webhooksService.triggerEvent(user.tenantId, 'guard.created', { guard: safeGuard });
        return this.fieldPermissionsService.filterFieldsByPermission(user, 'guard', safeGuard);
    }
    async findAll(user, requestedBranchId) {
        try {
            const guards = await this.prisma.guard.findMany({
                where: (0, branch_scope_1.branchScopedWhere)(user, requestedBranchId),
                include: {
                    branch: {
                        select: { id: true, name: true, location: true, status: true },
                    },
                    availability: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            return this.fieldPermissionsService.filterFieldsByPermission(user, 'guard', guards.map((guard) => this.withoutPasswordHash(guard)));
        }
        catch (error) {
            console.error('Guards findAll error:', error.message);
            throw new common_1.InternalServerErrorException('Failed to fetch guards. The database may be unavailable.');
        }
    }
    async findOne(user, id) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
            include: {
                branch: {
                    select: { id: true, name: true, location: true, status: true },
                },
                availability: true,
            },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        return this.fieldPermissionsService.filterFieldsByPermission(user, 'guard', this.withoutPasswordHash(guard));
    }
    async update(user, id, dto) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        await this.fieldPermissionsService.assertCanEditFields(user, 'guard', dto, id);
        const { phone, email } = this.normalizeContact(dto);
        const branchId = dto.branch_id === undefined
            ? undefined
            : (0, branch_scope_1.resolveWriteBranchId)(user, dto.branch_id);
        const data = {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.phone !== undefined ? { phone } : {}),
            ...(dto.email !== undefined ? { email } : {}),
            ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
            ...(branchId !== undefined ? { branchId } : {}),
            ...this.sensitiveGuardData(dto),
        };
        if (data.name !== undefined && !data.name) {
            throw new common_1.BadRequestException('Guard name is required');
        }
        const updatedGuard = await this.prisma.guard.update({
            where: { id },
            data,
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'GUARD_UPDATED',
            entityType: 'Guard',
            entityId: guard.id,
            details: `Guard "${guard.name}" updated`,
        });
        return this.fieldPermissionsService.filterFieldsByPermission(user, 'guard', this.withoutPasswordHash(updatedGuard));
    }
    async getAvailability(user, id) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        const availability = await this.prisma.availability.findFirst({
            where: { guardId: id, tenantId: user.tenantId },
        });
        if (!availability) {
            return { status: 'available' };
        }
        return availability;
    }
    async updateAvailability(user, id, dto) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        const availability = await this.prisma.availability.upsert({
            where: { guardId: id },
            update: {
                status: dto.status,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
            },
            create: {
                guardId: id,
                tenantId: user.tenantId,
                status: dto.status,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'AVAILABILITY_UPDATED',
            entityType: 'Guard',
            entityId: id,
            details: `Guard "${guard.name}" availability set to ${dto.status}`,
        });
        return availability;
    }
};
exports.GuardsService = GuardsService;
exports.GuardsService = GuardsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        webhooks_service_1.WebhooksService,
        field_permissions_service_1.FieldPermissionsService])
], GuardsService);
//# sourceMappingURL=guards.service.js.map