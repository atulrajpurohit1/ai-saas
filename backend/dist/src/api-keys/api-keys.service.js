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
exports.ApiKeysService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const public_api_permissions_1 = require("./public-api-permissions");
let ApiKeysService = class ApiKeysService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    listPermissionDefinitions() {
        return public_api_permissions_1.PUBLIC_API_PERMISSIONS;
    }
    async list(user) {
        const keys = await this.prisma.apiKey.findMany({
            where: { tenantId: user.tenantId },
            orderBy: { createdAt: 'desc' },
        });
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const usage = await Promise.all(keys.map((key) => this.prisma.apiRequestLog.count({
            where: {
                apiKeyId: key.id,
                createdAt: { gte: since },
            },
        })));
        return keys.map((key, index) => this.serialize(key, usage[index]));
    }
    async create(user, dto) {
        const name = dto.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException('API key name is required');
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
    async update(user, id, dto) {
        const existing = await this.findTenantKey(user.tenantId, id);
        const permissions = dto.permissions === undefined ? undefined : this.validatePermissions(dto.permissions);
        const name = dto.name?.trim();
        if (dto.name !== undefined && !name) {
            throw new common_1.BadRequestException('API key name is required');
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
    async revoke(user, id) {
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
    async regenerate(user, id) {
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
    async authenticate(rawKey) {
        const normalized = rawKey?.trim();
        if (!normalized) {
            throw new common_1.UnauthorizedException('API key is required');
        }
        const apiKey = await this.prisma.apiKey.findUnique({
            where: { apiKey: this.hashApiKey(normalized) },
        });
        if (!apiKey) {
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        if (apiKey.status !== 'active') {
            throw new common_1.ForbiddenException('API key has been revoked');
        }
        if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
            throw new common_1.ForbiddenException('API key has expired');
        }
        return {
            id: apiKey.id,
            tenantId: apiKey.tenantId,
            name: apiKey.name,
            permissions: apiKey.permissions,
            rateLimitPerMinute: apiKey.rateLimitPerMinute,
        };
    }
    async touch(apiKeyId) {
        await this.prisma.apiKey.update({
            where: { id: apiKeyId },
            data: { lastUsedAt: new Date() },
        });
    }
    async logRequest(data) {
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
    validatePermissions(input = []) {
        const permissions = [...new Set(input.map((item) => item.trim()).filter(Boolean))];
        const allowed = new Set(public_api_permissions_1.PUBLIC_API_PERMISSION_KEYS);
        const unknown = permissions.filter((permission) => !allowed.has(permission));
        if (unknown.length > 0) {
            throw new common_1.BadRequestException(`Unknown public API permissions: ${unknown.join(', ')}`);
        }
        return permissions.sort();
    }
    async findTenantKey(tenantId, id) {
        const apiKey = await this.prisma.apiKey.findFirst({
            where: { id, tenantId },
        });
        if (!apiKey) {
            throw new common_1.NotFoundException('API key not found');
        }
        return apiKey;
    }
    generatePlainKey() {
        return `v6_${(0, crypto_1.randomBytes)(32).toString('base64url')}`;
    }
    hashApiKey(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
    }
    keyPrefix(value) {
        return value.slice(0, 12);
    }
    serialize(apiKey, requestsLast24h = 0) {
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
};
exports.ApiKeysService = ApiKeysService;
exports.ApiKeysService = ApiKeysService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ApiKeysService);
//# sourceMappingURL=api-keys.service.js.map