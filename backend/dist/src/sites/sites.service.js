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
let SitesService = class SitesService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async create(userId, tenantId, dto) {
        const site = await this.prisma.site.create({
            data: {
                ...dto,
                tenantId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SITE_CREATED',
            entityType: 'Site',
            entityId: site.id,
            details: `Site "${site.name}" created`,
        });
        return site;
    }
    async findAll(tenantId) {
        return this.prisma.site.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async update(userId, tenantId, id, dto) {
        const site = await this.prisma.site.findFirst({
            where: { id, tenantId },
        });
        if (!site) {
            throw new common_1.NotFoundException('Site not found');
        }
        const updatedSite = await this.prisma.site.update({
            where: { id },
            data: dto,
        });
        await this.auditService.log({
            tenantId,
            userId,
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