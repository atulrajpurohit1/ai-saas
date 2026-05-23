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
const bcrypt = __importStar(require("bcrypt"));
let GuardsService = class GuardsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
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
    async create(userId, tenantId, dto) {
        const name = dto.name?.trim();
        const { phone, email } = this.normalizeContact(dto);
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
        return this.withoutPasswordHash(guard);
    }
    async findAll(tenantId) {
        try {
            const guards = await this.prisma.guard.findMany({
                where: { tenantId },
                include: {
                    availability: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            return guards.map((guard) => this.withoutPasswordHash(guard));
        }
        catch (error) {
            console.error('Guards findAll error:', error.message);
            throw new common_1.InternalServerErrorException('Failed to fetch guards. The database may be unavailable.');
        }
    }
    async update(userId, tenantId, id, dto) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        const { phone, email } = this.normalizeContact(dto);
        const data = {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.phone !== undefined ? { phone } : {}),
            ...(dto.email !== undefined ? { email } : {}),
            ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
        };
        if (data.name !== undefined && !data.name) {
            throw new common_1.BadRequestException('Guard name is required');
        }
        const updatedGuard = await this.prisma.guard.update({
            where: { id },
            data,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'GUARD_UPDATED',
            entityType: 'Guard',
            entityId: guard.id,
            details: `Guard "${guard.name}" updated`,
        });
        return this.withoutPasswordHash(updatedGuard);
    }
    async getAvailability(tenantId, id) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId },
        });
        if (!guard) {
            throw new common_1.NotFoundException('Guard not found');
        }
        const availability = await this.prisma.availability.findFirst({
            where: { guardId: id, tenantId },
        });
        if (!availability) {
            return { status: 'available' };
        }
        return availability;
    }
    async updateAvailability(userId, tenantId, id, dto) {
        const guard = await this.prisma.guard.findFirst({
            where: { id, tenantId },
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
                tenantId,
                status: dto.status,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
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
        audit_service_1.AuditService])
], GuardsService);
//# sourceMappingURL=guards.service.js.map