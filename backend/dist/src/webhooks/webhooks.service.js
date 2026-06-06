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
exports.WebhooksService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const webhook_events_1 = require("./webhook-events");
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 5000;
let WebhooksService = class WebhooksService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    listEvents() {
        return webhook_events_1.SUPPORTED_WEBHOOK_EVENTS;
    }
    async list(user) {
        const webhooks = await this.prisma.webhook.findMany({
            where: { tenantId: user.tenantId },
            include: {
                _count: { select: { deliveries: true } },
                deliveries: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return webhooks.map((webhook) => this.serializeWebhook(webhook));
    }
    async create(user, dto) {
        const webhook = await this.prisma.webhook.create({
            data: {
                tenantId: user.tenantId,
                eventType: dto.event_type,
                endpointUrl: dto.endpoint_url.trim(),
                secretKey: this.generateSecret(),
                status: 'active',
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'WEBHOOK_CREATED',
            entityType: 'Webhook',
            entityId: webhook.id,
            details: `Webhook for ${webhook.eventType} created`,
        });
        return {
            ...this.serializeWebhook(webhook),
            secret_key: webhook.secretKey,
        };
    }
    async update(user, id, dto) {
        const existing = await this.findTenantWebhook(user.tenantId, id);
        const updated = await this.prisma.webhook.update({
            where: { id: existing.id },
            data: {
                ...(dto.event_type !== undefined ? { eventType: dto.event_type } : {}),
                ...(dto.endpoint_url !== undefined ? { endpointUrl: dto.endpoint_url.trim() } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: updated.status === 'revoked' ? 'WEBHOOK_REVOKED' : 'WEBHOOK_UPDATED',
            entityType: 'Webhook',
            entityId: updated.id,
            details: `Webhook ${updated.id} updated`,
        });
        return this.serializeWebhook(updated);
    }
    async revoke(user, id) {
        const existing = await this.findTenantWebhook(user.tenantId, id);
        const updated = await this.prisma.webhook.update({
            where: { id: existing.id },
            data: { status: 'revoked' },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'WEBHOOK_REVOKED',
            entityType: 'Webhook',
            entityId: updated.id,
            details: `Webhook for ${updated.eventType} revoked`,
        });
        return this.serializeWebhook(updated);
    }
    async rotateSecret(user, id) {
        const existing = await this.findTenantWebhook(user.tenantId, id);
        const updated = await this.prisma.webhook.update({
            where: { id: existing.id },
            data: { secretKey: this.generateSecret() },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'WEBHOOK_SECRET_ROTATED',
            entityType: 'Webhook',
            entityId: updated.id,
            details: `Webhook secret rotated for ${updated.eventType}`,
        });
        return {
            ...this.serializeWebhook(updated),
            secret_key: updated.secretKey,
        };
    }
    async listDeliveries(user, webhookId) {
        if (webhookId) {
            await this.findTenantWebhook(user.tenantId, webhookId);
        }
        const deliveries = await this.prisma.webhookDelivery.findMany({
            where: {
                ...(webhookId ? { webhookId } : {}),
                webhook: { tenantId: user.tenantId },
            },
            include: {
                webhook: {
                    select: {
                        id: true,
                        eventType: true,
                        endpointUrl: true,
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return deliveries.map((delivery) => this.serializeDelivery(delivery));
    }
    async retryDelivery(user, deliveryId) {
        const delivery = await this.prisma.webhookDelivery.findFirst({
            where: {
                id: deliveryId,
                webhook: { tenantId: user.tenantId },
            },
            include: { webhook: true },
        });
        if (!delivery) {
            throw new common_1.NotFoundException('Webhook delivery not found');
        }
        if (delivery.success) {
            return this.serializeDelivery(delivery);
        }
        const retried = await this.deliverEnvelope(delivery.webhook, delivery.payload, delivery.id, delivery.retryCount);
        return this.serializeDelivery(retried);
    }
    async retryFailed(user) {
        const failed = await this.prisma.webhookDelivery.findMany({
            where: {
                success: false,
                retryCount: { lt: MAX_RETRIES },
                webhook: { tenantId: user.tenantId, status: 'active' },
            },
            include: { webhook: true },
            orderBy: { createdAt: 'asc' },
            take: 25,
        });
        const deliveries = [];
        for (const delivery of failed) {
            deliveries.push(await this.deliverEnvelope(delivery.webhook, delivery.payload, delivery.id, delivery.retryCount));
        }
        return {
            retried: deliveries.length,
            deliveries: deliveries.map((delivery) => this.serializeDelivery(delivery)),
        };
    }
    async triggerEvent(tenantId, eventType, data) {
        if (!webhook_events_1.SUPPORTED_WEBHOOK_EVENTS.includes(eventType)) {
            throw new common_1.BadRequestException(`Unsupported webhook event: ${eventType}`);
        }
        const webhooks = await this.prisma.webhook.findMany({
            where: {
                tenantId,
                eventType,
                status: 'active',
            },
        });
        if (webhooks.length === 0) {
            return { event_type: eventType, deliveries: 0 };
        }
        const envelope = {
            id: (0, crypto_1.randomUUID)(),
            type: eventType,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            data,
        };
        await this.auditService.log({
            tenantId,
            action: 'WEBHOOK_TRIGGERED',
            entityType: 'Webhook',
            details: `${eventType} triggered for ${webhooks.length} webhook(s)`,
        });
        const deliveries = [];
        for (const webhook of webhooks) {
            deliveries.push(await this.createAndDeliver(webhook, envelope));
        }
        return {
            event_type: eventType,
            deliveries: deliveries.length,
        };
    }
    buildSignature(secret, timestamp, body) {
        return (0, crypto_1.createHmac)('sha256', secret)
            .update(`${timestamp}.${body}`)
            .digest('hex');
    }
    validateSignature(secret, timestamp, body, signature) {
        const normalized = signature.startsWith('sha256=')
            ? signature.slice('sha256='.length)
            : signature;
        const expected = this.buildSignature(secret, timestamp, body);
        const expectedBuffer = Buffer.from(expected, 'hex');
        const actualBuffer = Buffer.from(normalized, 'hex');
        return (expectedBuffer.length === actualBuffer.length &&
            (0, crypto_1.timingSafeEqual)(expectedBuffer, actualBuffer));
    }
    async createAndDeliver(webhook, payload) {
        const jsonPayload = this.toJsonValue(payload);
        const delivery = await this.prisma.webhookDelivery.create({
            data: {
                webhookId: webhook.id,
                payload: jsonPayload,
            },
        });
        return this.deliverEnvelope(webhook, jsonPayload, delivery.id, 0);
    }
    async deliverEnvelope(webhook, payload, deliveryId, startingRetryCount) {
        const body = JSON.stringify(payload);
        let retryCount = startingRetryCount;
        let responseStatus = null;
        let lastError = null;
        while (retryCount <= MAX_RETRIES) {
            try {
                const result = await this.postWebhook(webhook, deliveryId, body);
                responseStatus = result.status;
                lastError = result.ok ? null : `HTTP ${result.status}`;
                if (result.ok) {
                    return this.prisma.webhookDelivery.update({
                        where: { id: deliveryId },
                        data: {
                            responseStatus,
                            success: true,
                            retryCount,
                            lastError: null,
                            deliveredAt: new Date(),
                        },
                        include: { webhook: true },
                    });
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
            if (retryCount >= MAX_RETRIES)
                break;
            retryCount += 1;
            await this.delay(Math.min(250 * retryCount, 1000));
        }
        const failed = await this.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
                responseStatus,
                success: false,
                retryCount,
                lastError,
            },
            include: { webhook: true },
        });
        await this.auditService.log({
            tenantId: webhook.tenantId,
            action: 'WEBHOOK_FAILED',
            entityType: 'WebhookDelivery',
            entityId: deliveryId,
            details: `${webhook.eventType} delivery failed for ${webhook.endpointUrl}: ${lastError || 'unknown error'}`,
        });
        return failed;
    }
    async postWebhook(webhook, deliveryId, body) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.buildSignature(webhook.secretKey, timestamp, body);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(webhook.endpointUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ai-Saas-Event': webhook.eventType,
                    'X-Ai-Saas-Delivery-Id': deliveryId,
                    'X-Ai-Saas-Timestamp': timestamp,
                    'X-Ai-Saas-Signature': `sha256=${signature}`,
                },
                body,
                signal: controller.signal,
            });
            return {
                ok: response.status >= 200 && response.status < 300,
                status: response.status,
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async findTenantWebhook(tenantId, id) {
        const webhook = await this.prisma.webhook.findFirst({
            where: { id, tenantId },
        });
        if (!webhook) {
            throw new common_1.NotFoundException('Webhook not found');
        }
        return webhook;
    }
    generateSecret() {
        return `whsec_${(0, crypto_1.randomBytes)(32).toString('base64url')}`;
    }
    toJsonValue(value) {
        return JSON.parse(JSON.stringify(value));
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    serializeWebhook(webhook) {
        const latestDelivery = Array.isArray(webhook.deliveries) ? webhook.deliveries[0] : null;
        return {
            id: webhook.id,
            tenant_id: webhook.tenantId,
            event_type: webhook.eventType,
            endpoint_url: webhook.endpointUrl,
            secret_prefix: webhook.secretKey ? `${webhook.secretKey.slice(0, 12)}...` : null,
            status: webhook.status,
            created_at: webhook.createdAt,
            updated_at: webhook.updatedAt,
            delivery_count: webhook._count?.deliveries || 0,
            latest_delivery: latestDelivery ? this.serializeDelivery(latestDelivery) : null,
        };
    }
    serializeDelivery(delivery) {
        return {
            id: delivery.id,
            webhook_id: delivery.webhookId,
            event_type: delivery.webhook?.eventType,
            endpoint_url: delivery.webhook?.endpointUrl,
            payload: delivery.payload,
            response_status: delivery.responseStatus,
            success: delivery.success,
            retry_count: delivery.retryCount,
            last_error: delivery.lastError,
            created_at: delivery.createdAt,
            delivered_at: delivery.deliveredAt,
        };
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], WebhooksService);
//# sourceMappingURL=webhooks.service.js.map