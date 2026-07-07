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
exports.ProspectSearchHistoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
function toJsonValue(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}
let ProspectSearchHistoryService = class ProspectSearchHistoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(input) {
        return this.prisma.prospectSearchHistory.create({
            data: {
                tenantId: input.tenantId,
                userId: input.userId,
                prompt: input.prompt,
                filters: toJsonValue(input.filters),
                provider: input.provider,
                resultCount: input.resultCount,
            },
        });
    }
    async list(tenantId, userId, limit) {
        const take = Math.min(Math.max(limit && Number.isFinite(limit) ? limit : DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
        return this.prisma.prospectSearchHistory.findMany({
            where: { tenantId, userId },
            orderBy: { searchedAt: 'desc' },
            take,
        });
    }
};
exports.ProspectSearchHistoryService = ProspectSearchHistoryService;
exports.ProspectSearchHistoryService = ProspectSearchHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProspectSearchHistoryService);
//# sourceMappingURL=prospect-search-history.service.js.map