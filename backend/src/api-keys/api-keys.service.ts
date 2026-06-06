import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import {
  PUBLIC_API_PERMISSION_KEYS,
  PUBLIC_API_PERMISSIONS,
} from './public-api-permissions';

export type ApiKeyContext = {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
  rateLimitPerMinute: number;
};

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  listPermissionDefinitions() {
    return PUBLIC_API_PERMISSIONS;
  }

  async list(user: ActiveUser) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usage = await Promise.all(
      keys.map((key) =>
        this.prisma.apiRequestLog.count({
          where: {
            apiKeyId: key.id,
            createdAt: { gte: since },
          },
        }),
      ),
    );

    return keys.map((key, index) => this.serialize(key, usage[index]));
  }

  async create(user: ActiveUser, dto: CreateApiKeyDto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('API key name is required');
    }

    const permissions = this.validatePermissions(dto.permissions);
    const plainKey = this.generatePlainKey();
    const hashedKey = this.hashApiKey(plainKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId: user.tenantId,
        name,
        apiKey: hashedKey,
        keyPrefix: this.keyPrefix(plainKey),
        permissions,
        expiresAt: dto.expires_at ? new Date(dto.expires_at) : null,
        rateLimitPerMinute: dto.rate_limit_per_minute ?? 120,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'API_KEY_CREATED',
      entityType: 'ApiKey',
      entityId: apiKey.id,
      details: `API key "${apiKey.name}" created with ${permissions.length} permissions`,
    });

    return {
      ...this.serialize(apiKey, 0),
      api_key: plainKey,
    };
  }

  async update(user: ActiveUser, id: string, dto: UpdateApiKeyDto) {
    const existing = await this.findTenantKey(user.tenantId, id);
    const permissions =
      dto.permissions === undefined ? undefined : this.validatePermissions(dto.permissions);
    const name = dto.name?.trim();

    if (dto.name !== undefined && !name) {
      throw new BadRequestException('API key name is required');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.expires_at !== undefined ? { expiresAt: new Date(dto.expires_at) } : {}),
        ...(dto.rate_limit_per_minute !== undefined
          ? { rateLimitPerMinute: dto.rate_limit_per_minute }
          : {}),
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: updated.status === 'revoked' ? 'API_KEY_REVOKED' : 'API_KEY_UPDATED',
      entityType: 'ApiKey',
      entityId: updated.id,
      details: `API key "${updated.name}" updated`,
    });

    return this.serialize(updated);
  }

  async revoke(user: ActiveUser, id: string) {
    const existing = await this.findTenantKey(user.tenantId, id);
    const updated = await this.prisma.apiKey.update({
      where: { id: existing.id },
      data: { status: 'revoked' },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'API_KEY_REVOKED',
      entityType: 'ApiKey',
      entityId: updated.id,
      details: `API key "${updated.name}" revoked`,
    });

    return this.serialize(updated);
  }

  async regenerate(user: ActiveUser, id: string) {
    const existing = await this.findTenantKey(user.tenantId, id);
    const plainKey = this.generatePlainKey();
    const updated = await this.prisma.apiKey.update({
      where: { id: existing.id },
      data: {
        apiKey: this.hashApiKey(plainKey),
        keyPrefix: this.keyPrefix(plainKey),
        status: 'active',
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'API_KEY_REGENERATED',
      entityType: 'ApiKey',
      entityId: updated.id,
      details: `API key "${updated.name}" regenerated`,
    });

    return {
      ...this.serialize(updated),
      api_key: plainKey,
    };
  }

  async authenticate(rawKey: string | undefined): Promise<ApiKeyContext> {
    const normalized = rawKey?.trim();
    if (!normalized) {
      throw new UnauthorizedException('API key is required');
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { apiKey: this.hashApiKey(normalized) },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKey.status !== 'active') {
      throw new ForbiddenException('API key has been revoked');
    }

    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('API key has expired');
    }

    return {
      id: apiKey.id,
      tenantId: apiKey.tenantId,
      name: apiKey.name,
      permissions: apiKey.permissions,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
    };
  }

  async touch(apiKeyId: string) {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    });
  }

  async logRequest(data: {
    apiKey: ApiKeyContext;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    await this.prisma.apiRequestLog.create({
      data: {
        tenantId: data.apiKey.tenantId,
        apiKeyId: data.apiKey.id,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });

    await this.auditService.log({
      tenantId: data.apiKey.tenantId,
      userId: `api_key:${data.apiKey.id}`,
      action: 'PUBLIC_API_REQUEST',
      entityType: 'ApiKey',
      entityId: data.apiKey.id,
      details: `${data.method} ${data.endpoint} responded ${data.statusCode}`,
    });
  }

  private validatePermissions(input: string[] = []) {
    const permissions = [...new Set(input.map((item) => item.trim()).filter(Boolean))];
    const allowed = new Set(PUBLIC_API_PERMISSION_KEYS);
    const unknown = permissions.filter((permission) => !allowed.has(permission));

    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown public API permissions: ${unknown.join(', ')}`);
    }

    return permissions.sort();
  }

  private async findTenantKey(tenantId: string, id: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  private generatePlainKey() {
    return `v6_${randomBytes(32).toString('base64url')}`;
  }

  private hashApiKey(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private keyPrefix(value: string) {
    return value.slice(0, 12);
  }

  private serialize(apiKey: any, requestsLast24h = 0) {
    return {
      id: apiKey.id,
      tenant_id: apiKey.tenantId,
      name: apiKey.name,
      key_prefix: apiKey.keyPrefix,
      masked_key: `${apiKey.keyPrefix}...`,
      permissions: apiKey.permissions,
      status: apiKey.status,
      expires_at: apiKey.expiresAt,
      rate_limit_per_minute: apiKey.rateLimitPerMinute,
      last_used_at: apiKey.lastUsedAt,
      created_at: apiKey.createdAt,
      updated_at: apiKey.updatedAt,
      requests_last_24h: requestsLast24h,
    };
  }
}
