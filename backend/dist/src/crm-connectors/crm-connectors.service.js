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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CrmConnectorsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmConnectorsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const crm_provider_interface_1 = require("./providers/crm-provider.interface");
let CrmConnectorsService = CrmConnectorsService_1 = class CrmConnectorsService {
    prisma;
    auditService;
    logger = new common_1.Logger(CrmConnectorsService_1.name);
    providers;
    constructor(prisma, auditService, providers) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.providers = new Map(providers.map((provider) => [provider.key, provider]));
    }
    async getStatus(user) {
        const connections = await this.prisma.crmConnection.findMany({
            where: { tenantId: user.tenantId },
        });
        const connectionByProvider = new Map(connections.map((connection) => [connection.provider, connection]));
        const status = {};
        for (const provider of this.providers.values()) {
            const connection = connectionByProvider.get(provider.key);
            status[provider.key] = this.serializeStatus(provider, connection);
        }
        return status;
    }
    getConnectUrl(user, providerKey) {
        const provider = this.requireProvider(providerKey);
        const state = this.signState({
            tenantId: user.tenantId,
            userId: user.sub,
            nonce: (0, crypto_1.randomBytes)(12).toString('base64url'),
            createdAt: Date.now(),
        });
        return { provider: provider.key, url: provider.buildAuthUrl(state) };
    }
    async handleCallback(providerKey, code, state) {
        const provider = this.requireProvider(providerKey);
        if (!provider.isConfigured()) {
            throw new common_1.BadRequestException(`${provider.label} OAuth environment variables are not configured`);
        }
        if (!code) {
            throw new common_1.BadRequestException(`Missing ${provider.label} authorization code`);
        }
        const parsedState = this.verifyState(state);
        const token = await provider.exchangeCode(code);
        const accessToken = this.encrypt(token.access_token);
        const refreshToken = token.refresh_token
            ? this.encrypt(token.refresh_token)
            : null;
        const expiresAt = token.expires_in
            ? new Date(Date.now() + Number(token.expires_in) * 1000)
            : null;
        const meta = provider.extractAccountMeta(token);
        const connection = await this.prisma.crmConnection.upsert({
            where: {
                tenantId_provider: {
                    tenantId: parsedState.tenantId,
                    provider: provider.key,
                },
            },
            update: {
                status: 'connected',
                accessToken,
                refreshToken,
                tokenExpiresAt: expiresAt,
                scopes: this.scopeList(provider, token.scope),
                portalId: meta.portalId ?? undefined,
                externalAccountName: meta.externalAccountName,
                lastError: null,
            },
            create: {
                tenantId: parsedState.tenantId,
                provider: provider.key,
                status: 'connected',
                accessToken,
                refreshToken,
                tokenExpiresAt: expiresAt,
                scopes: this.scopeList(provider, token.scope),
                portalId: meta.portalId,
                externalAccountName: meta.externalAccountName,
            },
        });
        await this.auditService.log({
            tenantId: parsedState.tenantId,
            userId: parsedState.userId,
            action: 'CRM_CONNECTED',
            entityType: 'CrmConnection',
            entityId: connection.id,
            details: `${provider.label} connected`,
        });
        return connection;
    }
    async disconnect(user, providerKey) {
        const provider = this.requireProvider(providerKey);
        const connection = await this.prisma.crmConnection.findUnique({
            where: {
                tenantId_provider: { tenantId: user.tenantId, provider: provider.key },
            },
        });
        if (!connection) {
            throw new common_1.NotFoundException(`${provider.label} is not connected`);
        }
        const updated = await this.prisma.crmConnection.update({
            where: { id: connection.id },
            data: {
                status: 'disconnected',
                accessToken: '',
                refreshToken: null,
                tokenExpiresAt: null,
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CRM_DISCONNECTED',
            entityType: 'CrmConnection',
            entityId: connection.id,
            details: `${provider.label} disconnected`,
        });
        return this.serializeConnection(updated);
    }
    async importContacts(user, providerKey) {
        const provider = this.requireProvider(providerKey);
        const connection = await this.activeConnection(provider, user.tenantId);
        const contacts = await this.callProvider(provider, connection, (accessToken) => provider.fetchContacts(accessToken, connection.portalId));
        let created = 0;
        let updated = 0;
        let skipped = 0;
        for (const contact of contacts) {
            const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
                contact.email ||
                `${provider.label} Contact`;
            const company = contact.company || `${provider.label} Contact`;
            if (!contact.email && !name) {
                skipped += 1;
                continue;
            }
            const existing = await this.prisma.lead.findFirst({
                where: {
                    tenantId: user.tenantId,
                    OR: contact.email
                        ? [{ email: contact.email }, { name, company }]
                        : [{ name, company }],
                },
            });
            if (existing) {
                await this.prisma.lead.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        company,
                        ...(contact.email ? { email: contact.email } : {}),
                        status: contact.status,
                    },
                });
                updated += 1;
            }
            else {
                await this.prisma.lead.create({
                    data: {
                        tenantId: user.tenantId,
                        name,
                        company,
                        email: contact.email,
                        status: contact.status,
                    },
                });
                created += 1;
            }
        }
        await this.prisma.crmConnection.update({
            where: { id: connection.id },
            data: { lastSyncAt: new Date(), lastError: null },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CRM_IMPORT',
            entityType: 'CrmConnection',
            entityId: connection.id,
            details: `Imported ${provider.label} contacts: ${created} created, ${updated} updated`,
        });
        return { provider: provider.key, total: contacts.length, created, updated, skipped };
    }
    async importProspectContact(user, providerKey, dto) {
        const provider = this.requireProvider(providerKey);
        if (!provider.upsertContact) {
            throw new common_1.BadRequestException(`${provider.label} does not support syncing contacts yet`);
        }
        if (!dto.contactEmail) {
            throw new common_1.BadRequestException('An email address is required to sync a contact (needed to avoid creating duplicates).');
        }
        const contact = this.toContactInput(dto);
        const connection = await this.activeConnection(provider, user.tenantId);
        const result = await this.callProvider(provider, connection, (accessToken) => provider.upsertContact(accessToken, connection.portalId, contact));
        await this.prisma.crmConnection.update({
            where: { id: connection.id },
            data: { lastSyncAt: new Date(), lastError: null },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CRM_CONTACT_SYNCED',
            entityType: 'CrmConnection',
            entityId: connection.id,
            details: `Synced prospect "${contact.name || contact.companyName || contact.email}" to ${provider.label} (${result.created ? 'created' : 'updated'})`,
        });
        return result;
    }
    callbackResultUrl(providerKey, success) {
        const params = new URLSearchParams({
            crm: success ? `${providerKey}_connected` : `${providerKey}_failed`,
        });
        return `${this.frontendUrl()}/integrations?${params.toString()}`;
    }
    toContactInput(dto) {
        const noteLines = [];
        if (dto.qualificationReason) {
            noteLines.push(`Why this prospect matched: ${dto.qualificationReason}`);
        }
        if (dto.signals && dto.signals.length > 0) {
            noteLines.push('Signals:', ...dto.signals.map((signal) => `- ${signal}`));
        }
        return {
            name: dto.contactName?.trim() || dto.name,
            email: dto.contactEmail,
            companyName: dto.name,
            website: dto.website,
            city: dto.city,
            state: dto.state,
            country: dto.country,
            jobTitle: dto.contactTitle,
            linkedinUrl: dto.contactProfileUrl,
            note: noteLines.length > 0 ? noteLines.join('\n') : null,
        };
    }
    requireProvider(providerKey) {
        const provider = this.providers.get(providerKey);
        if (!provider) {
            throw new common_1.BadRequestException(`Unknown CRM provider: ${providerKey}`);
        }
        return provider;
    }
    async activeConnection(provider, tenantId) {
        const connection = await this.prisma.crmConnection.findUnique({
            where: { tenantId_provider: { tenantId, provider: provider.key } },
        });
        if (!connection || connection.status === 'disconnected' || !connection.accessToken) {
            throw new common_1.BadRequestException(`${provider.label} is not connected`);
        }
        return connection;
    }
    async callProvider(provider, connection, fn) {
        const accessToken = await this.validAccessToken(provider, connection);
        try {
            return await fn(accessToken);
        }
        catch (err) {
            if (!(err instanceof crm_provider_interface_1.CrmApiError))
                throw err;
            if (err.status === 401 && connection.refreshToken) {
                try {
                    const refreshed = await provider.refreshToken(this.decrypt(connection.refreshToken));
                    await this.persistRefreshedToken(connection, provider, refreshed);
                    return await fn(refreshed.access_token);
                }
                catch {
                    await this.markConnectionError(connection.id, `${provider.label} connection expired. Please reconnect.`);
                    throw new common_1.UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
                }
            }
            throw await this.translateProviderError(provider, connection, err);
        }
    }
    async translateProviderError(provider, connection, err) {
        this.logger.warn(`${provider.label} API error for connection ${connection.id}: status=${err.status} message=${err.message}`);
        if (err.status === 401) {
            await this.markConnectionError(connection.id, `${provider.label} connection expired. Please reconnect.`);
            return new common_1.UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
        }
        if (err.status === 403) {
            await this.markConnectionError(connection.id, `${provider.label} denied this request. Please reconnect with the required permissions.`);
            return new common_1.ForbiddenException(`${provider.label} denied this request. Please reconnect with the required permissions.`);
        }
        if (err.status === 429) {
            return new common_1.HttpException(`${provider.label} rate limit reached. Please try again shortly.`, 429);
        }
        if (err.status >= 500) {
            await this.recordSyncError(connection.id, err.message);
            return new common_1.ServiceUnavailableException(`${provider.label} is temporarily unavailable. Please try again.`);
        }
        await this.recordSyncError(connection.id, err.message);
        return new common_1.BadRequestException(`${provider.label} rejected this request: ${err.message}`);
    }
    async persistRefreshedToken(connection, provider, refreshed) {
        await this.prisma.crmConnection.update({
            where: { id: connection.id },
            data: {
                accessToken: this.encrypt(refreshed.access_token),
                refreshToken: refreshed.refresh_token
                    ? this.encrypt(refreshed.refresh_token)
                    : connection.refreshToken,
                tokenExpiresAt: refreshed.expires_in
                    ? new Date(Date.now() + Number(refreshed.expires_in) * 1000)
                    : connection.tokenExpiresAt,
                scopes: this.scopeList(provider, refreshed.scope),
            },
        });
    }
    async validAccessToken(provider, connection) {
        const needsRefresh = connection.tokenExpiresAt &&
            connection.tokenExpiresAt.getTime() < Date.now() + 2 * 60 * 1000;
        if (!needsRefresh) {
            return this.decrypt(connection.accessToken);
        }
        if (!connection.refreshToken) {
            await this.markConnectionError(connection.id, `${provider.label} connection expired. Please reconnect.`);
            throw new common_1.UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
        }
        try {
            const refreshed = await provider.refreshToken(this.decrypt(connection.refreshToken));
            await this.persistRefreshedToken(connection, provider, refreshed);
            return refreshed.access_token;
        }
        catch {
            await this.markConnectionError(connection.id, `${provider.label} connection expired. Please reconnect.`);
            throw new common_1.UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
        }
    }
    async markConnectionError(connectionId, message) {
        await this.prisma.crmConnection.update({
            where: { id: connectionId },
            data: { status: 'error', lastError: message.slice(0, 500) },
        });
    }
    async recordSyncError(connectionId, message) {
        await this.prisma.crmConnection.update({
            where: { id: connectionId },
            data: { lastError: message.slice(0, 500) },
        });
    }
    serializeStatus(provider, connection) {
        return {
            configured: provider.isConfigured(),
            connected: connection?.status === 'connected',
            status: connection?.status || 'not_connected',
            portal_id: connection?.portalId || null,
            external_account_name: connection?.externalAccountName || null,
            scopes: connection?.scopes || provider.scopes,
            token_expires_at: connection?.tokenExpiresAt || null,
            last_sync_at: connection?.lastSyncAt || null,
            last_error: connection?.lastError || null,
        };
    }
    serializeConnection(connection) {
        return {
            provider: connection.provider,
            status: connection.status,
            portal_id: connection.portalId,
            external_account_name: connection.externalAccountName,
            scopes: connection.scopes,
            token_expires_at: connection.tokenExpiresAt,
            last_sync_at: connection.lastSyncAt,
            last_error: connection.lastError,
        };
    }
    frontendUrl() {
        return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    }
    signState(payload) {
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = (0, crypto_1.createHmac)('sha256', this.secret()).update(body).digest('base64url');
        return `${body}.${sig}`;
    }
    verifyState(state) {
        if (!state)
            throw new common_1.BadRequestException('Missing OAuth state');
        const [body, sig] = state.split('.');
        const expected = (0, crypto_1.createHmac)('sha256', this.secret()).update(body).digest('base64url');
        if (!body || !sig || sig !== expected) {
            throw new common_1.BadRequestException('Invalid OAuth state');
        }
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload.tenantId || Date.now() - payload.createdAt > 15 * 60 * 1000) {
            throw new common_1.BadRequestException('Expired OAuth state');
        }
        return payload;
    }
    encrypt(value) {
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', this.encryptionKey(), iv);
        const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
    }
    decrypt(value) {
        const [ivText, tagText, encryptedText] = value.split('.');
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', this.encryptionKey(), Buffer.from(ivText, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
        return Buffer.concat([
            decipher.update(Buffer.from(encryptedText, 'base64url')),
            decipher.final(),
        ]).toString('utf8');
    }
    encryptionKey() {
        return (0, crypto_1.createHash)('sha256').update(this.secret()).digest();
    }
    secret() {
        return (process.env.CRM_TOKEN_SECRET ||
            process.env.JWT_ACCESS_SECRET ||
            'local-crm-token-secret');
    }
    scopeList(provider, scope) {
        return scope ? scope.split(/\s+/).filter(Boolean) : provider.scopes;
    }
};
exports.CrmConnectorsService = CrmConnectorsService;
exports.CrmConnectorsService = CrmConnectorsService = CrmConnectorsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(crm_provider_interface_1.CRM_PROVIDERS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService, Array])
], CrmConnectorsService);
//# sourceMappingURL=crm-connectors.service.js.map