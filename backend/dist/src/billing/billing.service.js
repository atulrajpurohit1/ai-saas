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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const PLANS = {
    free: {
        name: 'Free',
        monthlyPrice: 0,
        limits: { adminUsers: 2, clientUsers: 3, branches: 1, leads: 25, deals: 10 },
    },
    starter: {
        name: 'Starter',
        monthlyPrice: 99,
        limits: { adminUsers: 5, clientUsers: 25, branches: 3, leads: 500, deals: 150 },
    },
    growth: {
        name: 'Growth',
        monthlyPrice: 299,
        limits: { adminUsers: 20, clientUsers: 100, branches: 20, leads: 5000, deals: 1500 },
    },
    enterprise: {
        name: 'Enterprise',
        monthlyPrice: null,
        limits: { adminUsers: null, clientUsers: null, branches: null, leads: null, deals: null },
    },
};
let BillingService = class BillingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTenantBilling(tenantId) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, slug: true, createdAt: true },
        });
        const planKey = this.planKeyForTenant(tenant?.slug);
        const plan = PLANS[planKey];
        const usage = await this.usage(tenantId);
        const limits = Object.entries(plan.limits).reduce((acc, [key, limit]) => {
            const used = usage[key];
            acc[key] = {
                used,
                limit,
                remaining: limit === null ? null : Math.max(0, limit - used),
                percent: limit === null ? null : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100)),
                exceeded: limit !== null && used > limit,
            };
            return acc;
        }, {});
        return {
            tenant,
            plan: {
                key: planKey,
                name: plan.name,
                monthlyPrice: plan.monthlyPrice,
                source: this.planSource(tenant?.slug),
            },
            limits,
            features: this.featuresForPlan(planKey),
            availablePlans: Object.entries(PLANS).map(([key, value]) => ({
                key,
                name: value.name,
                monthlyPrice: value.monthlyPrice,
                limits: value.limits,
            })),
        };
    }
    async assertCanAddAdminUser(tenantId) {
        await this.assertWithinLimit(tenantId, 'adminUsers', 'admin users');
    }
    async assertCanAddClientUser(tenantId) {
        await this.assertWithinLimit(tenantId, 'clientUsers', 'client portal users');
    }
    async assertWithinLimit(tenantId, key, label) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { slug: true },
        });
        const plan = PLANS[this.planKeyForTenant(tenant?.slug)];
        const limit = plan.limits[key];
        if (limit === null)
            return;
        const usage = await this.usage(tenantId);
        if (usage[key] >= limit) {
            throw new common_1.ForbiddenException(`Plan limit reached for ${label}. Upgrade the billing plan or remove inactive users.`);
        }
    }
    async usage(tenantId) {
        const [adminUsers, clientUsers, branches, leads, deals] = await Promise.all([
            this.prisma.user.count({ where: { tenantId } }),
            this.prisma.clientUser.count({ where: { tenantId } }),
            this.prisma.branch.count({ where: { tenantId } }),
            this.prisma.lead.count({ where: { tenantId } }),
            this.prisma.deal.count({ where: { tenantId } }),
        ]);
        return { adminUsers, clientUsers, branches, leads, deals };
    }
    planKeyForTenant(slug) {
        const tenantOverride = slug
            ? process.env[`BILLING_PLAN_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`]
            : undefined;
        const candidate = (tenantOverride || process.env.BILLING_DEFAULT_PLAN || 'starter').toLowerCase();
        return this.isPlanKey(candidate) ? candidate : 'starter';
    }
    planSource(slug) {
        if (!slug)
            return 'default';
        const key = `BILLING_PLAN_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
        return process.env[key] ? key : 'BILLING_DEFAULT_PLAN';
    }
    isPlanKey(value) {
        return value === 'free' || value === 'starter' || value === 'growth' || value === 'enterprise';
    }
    featuresForPlan(plan) {
        return {
            salesAccelerator: true,
            salesAutomation: plan !== 'free',
            publicApi: plan === 'growth' || plan === 'enterprise',
            customDomains: plan === 'growth' || plan === 'enterprise',
            sso: plan === 'enterprise',
            prioritySupport: plan === 'enterprise',
        };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillingService);
//# sourceMappingURL=billing.service.js.map