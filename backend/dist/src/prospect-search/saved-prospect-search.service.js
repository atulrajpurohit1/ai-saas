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
exports.SavedProspectSearchService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
function toJsonValue(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}
let SavedProspectSearchService = class SavedProspectSearchService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async list(tenantId) {
        return this.prisma.savedProspectSearch.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(input) {
        const saved = await this.prisma.savedProspectSearch.create({
            data: {
                tenantId: input.tenantId,
                userId: input.userId,
                name: input.name.trim(),
                prompt: input.prompt,
                filters: toJsonValue(input.filters),
            },
        });
        await this.auditService.log({
            tenantId: input.tenantId,
            userId: input.userId,
            action: 'SAVED_SEARCH_CREATED',
            entityType: 'SAVED_PROSPECT_SEARCH',
            entityId: saved.id,
            details: `Saved search "${saved.name}"`,
        });
        return saved;
    }
    async rename(id, tenantId, userId, name) {
        await this.ensureExists(id, tenantId);
        const updated = await this.prisma.savedProspectSearch.update({
            where: { id },
            data: { name: name.trim() },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SAVED_SEARCH_RENAMED',
            entityType: 'SAVED_PROSPECT_SEARCH',
            entityId: id,
            details: `Renamed saved search to "${updated.name}"`,
        });
        return updated;
    }
    async remove(id, tenantId, userId) {
        const existing = await this.ensureExists(id, tenantId);
        await this.prisma.savedProspectSearch.delete({ where: { id } });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'SAVED_SEARCH_DELETED',
            entityType: 'SAVED_PROSPECT_SEARCH',
            entityId: id,
            details: `Deleted saved search "${existing.name}"`,
        });
        return { success: true };
    }
    async ensureExists(id, tenantId) {
        const existing = await this.prisma.savedProspectSearch.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Saved search not found');
        }
        return existing;
    }
};
exports.SavedProspectSearchService = SavedProspectSearchService;
exports.SavedProspectSearchService = SavedProspectSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SavedProspectSearchService);
//# sourceMappingURL=saved-prospect-search.service.js.map