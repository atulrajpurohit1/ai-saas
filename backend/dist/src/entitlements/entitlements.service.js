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
var EntitlementsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntitlementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const entitlements_constants_1 = require("./entitlements.constants");
const ACTIVE_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'];
const CACHE_TTL_MS = 30_000;
let EntitlementsService = EntitlementsService_1 = class EntitlementsService {
    prisma;
    logger = new common_1.Logger(EntitlementsService_1.name);
    cache = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async modulesForTenant(tenantId) {
        if (!tenantId)
            return new Set();
        const cached = this.cache.get(tenantId);
        if (cached && cached.expiresAt > Date.now())
            return cached.modules;
        const subscription = await this.prisma.tenantSubscription.findUnique({
            where: { tenantId },
            select: { status: true },
        });
        if (!subscription) {
            this.logger.warn(`Tenant ${tenantId} has no subscription row; granting all modules.`);
            return this.remember(tenantId, new Set(entitlements_constants_1.SERVICE_MODULES));
        }
        if (!ACTIVE_STATUSES.includes(subscription.status)) {
            return this.remember(tenantId, new Set());
        }
        const rows = await this.prisma.tenantModule.findMany({
            where: { tenantId, isActive: true },
            select: { module: true },
        });
        return this.remember(tenantId, new Set(rows.map((row) => row.module)));
    }
    async hasModule(tenantId, module) {
        return (await this.modulesForTenant(tenantId)).has(module);
    }
    async hasAnyModule(tenantId, modules) {
        if (!modules.length)
            return true;
        const granted = await this.modulesForTenant(tenantId);
        return modules.some((module) => granted.has(module));
    }
    async filterPermissionKeys(tenantId, keys, permissionModuleByKey) {
        const granted = await this.modulesForTenant(tenantId);
        return keys.filter((key) => {
            const permissionModule = permissionModuleByKey.get(key);
            if (!permissionModule)
                return true;
            const service = (0, entitlements_constants_1.serviceForPermissionModule)(permissionModule);
            return service === null || granted.has(service);
        });
    }
    async summaryForTenant(tenantId) {
        const subscription = await this.prisma.tenantSubscription.findUnique({
            where: { tenantId },
        });
        const granted = await this.modulesForTenant(tenantId);
        return {
            status: subscription?.status ?? 'ACTIVE',
            trialEndsAt: subscription?.trialEndsAt ?? null,
            currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
            modules: entitlements_constants_1.SERVICE_MODULES.map((module) => ({
                key: module,
                name: entitlements_constants_1.SERVICE_MODULE_LABELS[module],
                active: granted.has(module),
            })),
        };
    }
    invalidate(tenantId) {
        this.cache.delete(tenantId);
    }
    remember(tenantId, modules) {
        this.cache.set(tenantId, { modules, expiresAt: Date.now() + CACHE_TTL_MS });
        return modules;
    }
};
exports.EntitlementsService = EntitlementsService;
exports.EntitlementsService = EntitlementsService = EntitlementsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EntitlementsService);
//# sourceMappingURL=entitlements.service.js.map