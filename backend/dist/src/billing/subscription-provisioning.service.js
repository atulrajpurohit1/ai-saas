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
var SubscriptionProvisioningService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionProvisioningService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const entitlements_service_1 = require("../entitlements/entitlements.service");
const audit_service_1 = require("../audit/audit.service");
let SubscriptionProvisioningService = SubscriptionProvisioningService_1 = class SubscriptionProvisioningService {
    prisma;
    entitlements;
    audit;
    logger = new common_1.Logger(SubscriptionProvisioningService_1.name);
    constructor(prisma, entitlements, audit) {
        this.prisma = prisma;
        this.entitlements = entitlements;
        this.audit = audit;
    }
    async provision(input) {
        const { tenantId, modules, status, trialEndsAt = null, currentPeriodEnd = null, cancelAtPeriodEnd = false, providerCustomerId = null, providerSubscriptionId = null, reason, } = input;
        const desired = new Set(modules);
        await this.prisma.$transaction(async (tx) => {
            await tx.tenantSubscription.upsert({
                where: { tenantId },
                create: {
                    tenantId,
                    status,
                    trialEndsAt,
                    currentPeriodEnd,
                    cancelAtPeriodEnd,
                    providerCustomerId,
                    providerSubscriptionId,
                },
                update: {
                    status,
                    trialEndsAt,
                    currentPeriodEnd,
                    cancelAtPeriodEnd,
                    ...(providerCustomerId ? { providerCustomerId } : {}),
                    ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
                },
            });
            const existing = await tx.tenantModule.findMany({ where: { tenantId } });
            const seen = new Set(existing.map((row) => row.module));
            for (const row of existing) {
                const shouldBeActive = desired.has(row.module);
                if (row.isActive !== shouldBeActive) {
                    await tx.tenantModule.update({
                        where: { id: row.id },
                        data: { isActive: shouldBeActive },
                    });
                }
            }
            const toCreate = [...desired].filter((module) => !seen.has(module));
            if (toCreate.length) {
                await tx.tenantModule.createMany({
                    data: toCreate.map((module) => ({ tenantId, module, isActive: true })),
                });
            }
        });
        this.entitlements.invalidate(tenantId);
        await this.audit
            .log({
            tenantId,
            action: 'subscription.provisioned',
            entityType: 'TenantSubscription',
            entityId: providerSubscriptionId ?? tenantId,
            details: JSON.stringify({
                modules: [...desired].sort(),
                status,
                reason: reason ?? 'manual',
            }),
        })
            .catch((error) => {
            this.logger.warn(`Audit log failed for ${tenantId}: ${error.message}`);
        });
        this.logger.log(`Provisioned ${tenantId}: [${[...desired].sort().join(', ') || 'none'}] status=${status}${reason ? ` (${reason})` : ''}`);
        return this.entitlements.summaryForTenant(tenantId);
    }
    async cancel(tenantId, reason) {
        await this.prisma.tenantSubscription.updateMany({
            where: { tenantId },
            data: { status: 'CANCELED', cancelAtPeriodEnd: false },
        });
        this.entitlements.invalidate(tenantId);
        await this.audit
            .log({
            tenantId,
            action: 'subscription.canceled',
            entityType: 'TenantSubscription',
            entityId: tenantId,
            details: JSON.stringify({ reason: reason ?? 'manual' }),
        })
            .catch(() => undefined);
        this.logger.log(`Cancelled subscription for ${tenantId}${reason ? ` (${reason})` : ''}`);
    }
    async setStatus(tenantId, status, reason) {
        await this.prisma.tenantSubscription.updateMany({
            where: { tenantId },
            data: { status },
        });
        this.entitlements.invalidate(tenantId);
        this.logger.log(`Status for ${tenantId} -> ${status}${reason ? ` (${reason})` : ''}`);
    }
    async tenantForProviderIds(ids) {
        const { customerId, subscriptionId } = ids;
        if (!customerId && !subscriptionId)
            return null;
        const match = await this.prisma.tenantSubscription.findFirst({
            where: {
                OR: [
                    ...(subscriptionId ? [{ providerSubscriptionId: subscriptionId }] : []),
                    ...(customerId ? [{ providerCustomerId: customerId }] : []),
                ],
            },
            select: { tenantId: true },
        });
        return match?.tenantId ?? null;
    }
};
exports.SubscriptionProvisioningService = SubscriptionProvisioningService;
exports.SubscriptionProvisioningService = SubscriptionProvisioningService = SubscriptionProvisioningService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        entitlements_service_1.EntitlementsService,
        audit_service_1.AuditService])
], SubscriptionProvisioningService);
//# sourceMappingURL=subscription-provisioning.service.js.map