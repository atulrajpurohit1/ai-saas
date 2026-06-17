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
exports.IntegrationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let IntegrationsService = class IntegrationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOverview(user) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [activeApiKeys, activeWebhooks, apiRequests24h, failedDeliveries24h, connectedCrm, recentRequests, recentDeliveries, webhooks,] = await Promise.all([
            this.prisma.apiKey.count({
                where: { tenantId: user.tenantId, status: 'active' },
            }),
            this.prisma.webhook.count({
                where: { tenantId: user.tenantId, status: 'active' },
            }),
            this.prisma.apiRequestLog.count({
                where: { tenantId: user.tenantId, createdAt: { gte: since } },
            }),
            this.prisma.webhookDelivery.count({
                where: {
                    success: false,
                    createdAt: { gte: since },
                    webhook: { tenantId: user.tenantId },
                },
            }),
            this.prisma.crmConnection.count({
                where: { tenantId: user.tenantId, status: 'connected' },
            }),
            this.prisma.apiRequestLog.findMany({
                where: { tenantId: user.tenantId },
                include: {
                    apiKey: { select: { id: true, name: true, keyPrefix: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
            }),
            this.prisma.webhookDelivery.findMany({
                where: { webhook: { tenantId: user.tenantId } },
                include: {
                    webhook: {
                        select: { id: true, eventType: true, endpointUrl: true, status: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
            }),
            this.prisma.webhook.findMany({
                where: { tenantId: user.tenantId },
                include: {
                    deliveries: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        return {
            active_integrations: [
                { type: 'api_keys', label: 'API keys', active: activeApiKeys },
                { type: 'webhooks', label: 'Webhooks', active: activeWebhooks },
                { type: 'crm', label: 'CRM connectors', active: connectedCrm },
            ],
            api_usage: {
                requests_last_24h: apiRequests24h,
            },
            webhook_status: webhooks.map((webhook) => ({
                id: webhook.id,
                event_type: webhook.eventType,
                endpoint_url: webhook.endpointUrl,
                status: webhook.status,
                success_count: webhook.deliveries.filter((delivery) => delivery.success).length,
                failure_count: webhook.deliveries.filter((delivery) => !delivery.success).length,
                latest_delivery_at: webhook.deliveries[0]?.createdAt || null,
            })),
            delivery_logs: recentDeliveries.map((delivery) => ({
                id: delivery.id,
                webhook_id: delivery.webhookId,
                event_type: delivery.webhook.eventType,
                endpoint_url: delivery.webhook.endpointUrl,
                success: delivery.success,
                response_status: delivery.responseStatus,
                retry_count: delivery.retryCount,
                last_error: delivery.lastError,
                created_at: delivery.createdAt,
            })),
            request_logs: recentRequests.map((request) => ({
                id: request.id,
                api_key_id: request.apiKeyId,
                api_key_name: request.apiKey.name,
                key_prefix: request.apiKey.keyPrefix,
                endpoint: request.endpoint,
                method: request.method,
                status_code: request.statusCode,
                ip_address: request.ipAddress,
                user_agent: request.userAgent,
                created_at: request.createdAt,
            })),
            failures_last_24h: failedDeliveries24h,
        };
    }
};
exports.IntegrationsService = IntegrationsService;
exports.IntegrationsService = IntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IntegrationsService);
//# sourceMappingURL=integrations.service.js.map