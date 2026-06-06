import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { SUPPORTED_WEBHOOK_EVENTS } from './webhook-events';

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  listEvents() {
    return SUPPORTED_WEBHOOK_EVENTS;
  }

  async list(user: ActiveUser) {
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

  async create(user: ActiveUser, dto: CreateWebhookDto) {
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

  async update(user: ActiveUser, id: string, dto: UpdateWebhookDto) {
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

  async revoke(user: ActiveUser, id: string) {
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

  async rotateSecret(user: ActiveUser, id: string) {
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

  async listDeliveries(user: ActiveUser, webhookId?: string) {
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

  async retryDelivery(user: ActiveUser, deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        webhook: { tenantId: user.tenantId },
      },
      include: { webhook: true },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    if (delivery.success) {
      return this.serializeDelivery(delivery);
    }

    const retried = await this.deliverEnvelope(
      delivery.webhook,
      delivery.payload,
      delivery.id,
      delivery.retryCount,
    );
    return this.serializeDelivery(retried);
  }

  async retryFailed(user: ActiveUser) {
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

    const deliveries: any[] = [];
    for (const delivery of failed) {
      deliveries.push(
        await this.deliverEnvelope(
          delivery.webhook,
          delivery.payload,
          delivery.id,
          delivery.retryCount,
        ),
      );
    }

    return {
      retried: deliveries.length,
      deliveries: deliveries.map((delivery) => this.serializeDelivery(delivery)),
    };
  }

  async triggerEvent(tenantId: string, eventType: string, data: Record<string, unknown>) {
    if (!SUPPORTED_WEBHOOK_EVENTS.includes(eventType as any)) {
      throw new BadRequestException(`Unsupported webhook event: ${eventType}`);
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
      id: randomUUID(),
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

    const deliveries: any[] = [];
    for (const webhook of webhooks) {
      deliveries.push(await this.createAndDeliver(webhook, envelope));
    }

    return {
      event_type: eventType,
      deliveries: deliveries.length,
    };
  }

  buildSignature(secret: string, timestamp: string, body: string) {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
  }

  validateSignature(secret: string, timestamp: string, body: string, signature: string) {
    const normalized = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    const expected = this.buildSignature(secret, timestamp, body);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(normalized, 'hex');
    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private async createAndDeliver(webhook: any, payload: Record<string, unknown>) {
    const jsonPayload = this.toJsonValue(payload);
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        payload: jsonPayload,
      },
    });

    return this.deliverEnvelope(webhook, jsonPayload, delivery.id, 0);
  }

  private async deliverEnvelope(
    webhook: any,
    payload: unknown,
    deliveryId: string,
    startingRetryCount: number,
  ) {
    const body = JSON.stringify(payload);
    let retryCount = startingRetryCount;
    let responseStatus: number | null = null;
    let lastError: string | null = null;

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
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      if (retryCount >= MAX_RETRIES) break;
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

  private async postWebhook(webhook: any, deliveryId: string, body: string) {
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
    } finally {
      clearTimeout(timeout);
    }
  }

  private async findTenantWebhook(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, tenantId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  private generateSecret() {
    return `whsec_${randomBytes(32).toString('base64url')}`;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private serializeWebhook(webhook: any) {
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

  private serializeDelivery(delivery: any) {
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
}
