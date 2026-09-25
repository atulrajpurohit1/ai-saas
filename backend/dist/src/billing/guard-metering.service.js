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
var GuardMeteringService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardMeteringService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const entitlements_service_1 = require("../entitlements/entitlements.service");
const pricing_constants_1 = require("./pricing.constants");
const ACTIVE_WINDOW_DAYS = 30;
let GuardMeteringService = GuardMeteringService_1 = class GuardMeteringService {
    prisma;
    entitlements;
    logger = new common_1.Logger(GuardMeteringService_1.name);
    constructor(prisma, entitlements) {
        this.prisma = prisma;
        this.entitlements = entitlements;
    }
    async activeGuardCount(tenantId) {
        const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const active = await this.prisma.guard.count({
            where: {
                tenantId,
                assignments: {
                    some: { shift: { startTime: { gte: since } } },
                },
            },
        });
        return active;
    }
    async totalGuardCount(tenantId) {
        return this.prisma.guard.count({ where: { tenantId } });
    }
    async billingProfile(tenantId) {
        const modules = [...(await this.entitlements.modulesForTenant(tenantId))];
        const packageKey = (0, pricing_constants_1.packageForModules)(modules);
        const [activeGuards, totalGuards] = await Promise.all([
            this.activeGuardCount(tenantId),
            this.totalGuardCount(tenantId),
        ]);
        if (!packageKey) {
            return {
                packageKey: null,
                packageName: 'Custom',
                band: null,
                activeGuards,
                totalGuards,
                monthlyPrice: null,
                customQuote: true,
            };
        }
        const band = (0, pricing_constants_1.billableBand)(packageKey, activeGuards);
        const price = (0, pricing_constants_1.monthlyPrice)(packageKey, band);
        return {
            packageKey,
            band,
            activeGuards,
            totalGuards,
            monthlyPrice: price,
            customQuote: (0, pricing_constants_1.isCustomQuote)(band),
        };
    }
    async bandDrift(tenantId, currentBand) {
        const profile = await this.billingProfile(tenantId);
        if (!profile.band || !currentBand || profile.band === currentBand) {
            return { drifted: false, from: currentBand, to: profile.band };
        }
        this.logger.log(`Tenant ${tenantId} has moved from band ${currentBand} to ${profile.band} ` +
            `(${profile.activeGuards} active guards).`);
        return {
            drifted: true,
            from: currentBand,
            to: profile.band,
            activeGuards: profile.activeGuards,
        };
    }
    priceFor(packageKey, band) {
        return (0, pricing_constants_1.monthlyPrice)(packageKey, band);
    }
};
exports.GuardMeteringService = GuardMeteringService;
exports.GuardMeteringService = GuardMeteringService = GuardMeteringService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        entitlements_service_1.EntitlementsService])
], GuardMeteringService);
//# sourceMappingURL=guard-metering.service.js.map