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
exports.VendorsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let VendorsService = class VendorsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    normalizeServices(value) {
        if (!Array.isArray(value))
            return [];
        return value
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    async findVendorOrThrow(tenantId, id) {
        const vendor = await this.prisma.vendor.findFirst({
            where: { id, tenantId },
        });
        if (!vendor) {
            throw new common_1.NotFoundException('Vendor not found');
        }
        return vendor;
    }
    async create(tenantId, userId, dto) {
        const vendor = await this.prisma.vendor.create({
            data: {
                tenantId,
                companyName: dto.companyName.trim(),
                contactPerson: dto.contactPerson?.trim() || null,
                email: dto.email?.trim() || null,
                phone: dto.phone?.trim() || null,
                address: dto.address?.trim() || null,
                services: this.normalizeServices(dto.services),
                notes: dto.notes?.trim() || null,
                status: dto.status || 'ACTIVE',
                createdBy: userId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entityType: 'Vendor',
            entityId: vendor.id,
            details: `Created vendor: ${vendor.companyName}`,
        });
        return vendor;
    }
    async findAll(tenantId, search) {
        const trimmedSearch = search?.trim();
        return this.prisma.vendor.findMany({
            where: {
                tenantId,
                ...(trimmedSearch
                    ? {
                        OR: [
                            {
                                companyName: { contains: trimmedSearch, mode: 'insensitive' },
                            },
                            {
                                contactPerson: {
                                    contains: trimmedSearch,
                                    mode: 'insensitive',
                                },
                            },
                            { email: { contains: trimmedSearch, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(tenantId, id) {
        return this.findVendorOrThrow(tenantId, id);
    }
    async update(tenantId, userId, id, dto) {
        await this.findVendorOrThrow(tenantId, id);
        const updated = await this.prisma.vendor.update({
            where: { id },
            data: {
                ...(dto.companyName !== undefined
                    ? { companyName: dto.companyName.trim() }
                    : {}),
                ...(dto.contactPerson !== undefined
                    ? { contactPerson: dto.contactPerson?.trim() || null }
                    : {}),
                ...(dto.email !== undefined
                    ? { email: dto.email?.trim() || null }
                    : {}),
                ...(dto.phone !== undefined
                    ? { phone: dto.phone?.trim() || null }
                    : {}),
                ...(dto.address !== undefined
                    ? { address: dto.address?.trim() || null }
                    : {}),
                ...(dto.services !== undefined
                    ? { services: this.normalizeServices(dto.services) }
                    : {}),
                ...(dto.notes !== undefined
                    ? { notes: dto.notes?.trim() || null }
                    : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entityType: 'Vendor',
            entityId: id,
            details: `Updated vendor: ${updated.companyName}`,
        });
        return updated;
    }
    async remove(tenantId, userId, id) {
        const existing = await this.findVendorOrThrow(tenantId, id);
        await this.prisma.vendor.delete({ where: { id } });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entityType: 'Vendor',
            entityId: id,
            details: `Deleted vendor: ${existing.companyName}`,
        });
        return { success: true };
    }
};
exports.VendorsService = VendorsService;
exports.VendorsService = VendorsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], VendorsService);
//# sourceMappingURL=vendors.service.js.map