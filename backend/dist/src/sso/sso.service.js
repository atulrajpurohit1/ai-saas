"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const audit_service_1 = require("../audit/audit.service");
const auth_service_1 = require("../auth/auth.service");
const billing_service_1 = require("../billing/billing.service");
const prisma_service_1 = require("../prisma/prisma.service");
const roles_service_1 = require("../roles/roles.service");
const sessions_service_1 = require("../sessions/sessions.service");
const sso_constants_1 = require("./sso.constants");
let SsoService = class SsoService {
    prisma;
    auditService;
    rolesService;
    authService;
    sessionsService;
    configService;
    billingService;
    constructor(prisma, auditService, rolesService, authService, sessionsService, configService, billingService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.rolesService = rolesService;
        this.authService = authService;
        this.sessionsService = sessionsService;
        this.configService = configService;
        this.billingService = billingService;
    }
    async listProviders(user) {
        const providers = await this.prisma.sSOProvider.findMany({
            where: { tenantId: user.tenantId },
            include: {
                roleMappings: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return providers.map((provider) => this.serializeProvider(provider));
    }
    async createProvider(user, dto) {
        await this.validateProviderReferences(user.tenantId, dto);
        const emailDomains = this.normalizeDomains(dto.email_domains);
        this.assertProviderCanBeActive(dto.status || 'inactive', emailDomains);
        const provider = await this.prisma.sSOProvider.create({
            data: {
                tenantId: user.tenantId,
                providerType: dto.provider_type,
                providerName: dto.provider_name.trim(),
                clientId: dto.client_id?.trim() || null,
                clientSecret: dto.client_secret?.trim() || null,
                issuerUrl: dto.issuer_url?.trim() || null,
                metadataUrl: dto.metadata_url?.trim() || null,
                samlMetadata: dto.saml_metadata?.trim() || null,
                emailDomains,
                autoProvision: dto.auto_provision ?? true,
                defaultRoleId: dto.default_role_id || null,
                defaultBranchId: dto.default_branch_id || null,
                status: dto.status || 'inactive',
            },
        });
        await this.syncRoleMappings(user.tenantId, provider.id, dto.role_mappings || []);
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'SSO_PROVIDER_CREATED',
            entityType: 'SSOProvider',
            entityId: provider.id,
            details: `${provider.providerName} (${provider.providerType}) created`,
        });
        return this.getProviderForTenant(user.tenantId, provider.id);
    }
    async updateProvider(user, id, dto) {
        const existing = await this.findProvider(user.tenantId, id);
        await this.validateProviderReferences(user.tenantId, dto);
        const nextEmailDomains = dto.email_domains !== undefined
            ? this.normalizeDomains(dto.email_domains)
            : existing.emailDomains;
        this.assertProviderCanBeActive(dto.status || existing.status, nextEmailDomains);
        await this.prisma.sSOProvider.update({
            where: { id: existing.id },
            data: {
                ...(dto.provider_type !== undefined ? { providerType: dto.provider_type } : {}),
                ...(dto.provider_name !== undefined ? { providerName: dto.provider_name.trim() } : {}),
                ...(dto.client_id !== undefined ? { clientId: dto.client_id?.trim() || null } : {}),
                ...(dto.client_secret !== undefined ? { clientSecret: dto.client_secret?.trim() || null } : {}),
                ...(dto.issuer_url !== undefined ? { issuerUrl: dto.issuer_url?.trim() || null } : {}),
                ...(dto.metadata_url !== undefined ? { metadataUrl: dto.metadata_url?.trim() || null } : {}),
                ...(dto.saml_metadata !== undefined ? { samlMetadata: dto.saml_metadata?.trim() || null } : {}),
                ...(dto.email_domains !== undefined ? { emailDomains: nextEmailDomains } : {}),
                ...(dto.auto_provision !== undefined ? { autoProvision: dto.auto_provision } : {}),
                ...(dto.default_role_id !== undefined ? { defaultRoleId: dto.default_role_id || null } : {}),
                ...(dto.default_branch_id !== undefined ? { defaultBranchId: dto.default_branch_id || null } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
        });
        if (dto.role_mappings !== undefined) {
            await this.syncRoleMappings(user.tenantId, existing.id, dto.role_mappings);
        }
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'SSO_PROVIDER_UPDATED',
            entityType: 'SSOProvider',
            entityId: existing.id,
            details: `SSO provider ${existing.id} updated`,
        });
        return this.getProviderForTenant(user.tenantId, existing.id);
    }
    async testProvider(user, dto) {
        const provider = await this.findProvider(user.tenantId, dto.provider_id);
        if (provider.providerType === 'saml') {
            const metadata = provider.samlMetadata || '';
            const hasSso = /SingleSignOnService/i.test(metadata);
            const hasCertificate = /X509Certificate/i.test(metadata);
            return {
                ok: Boolean(provider.metadataUrl || hasSso),
                provider_type: provider.providerType,
                checks: {
                    metadata_present: Boolean(provider.metadataUrl || provider.samlMetadata),
                    sso_service_present: hasSso,
                    certificate_present: hasCertificate,
                    signature_validation_ready: hasCertificate,
                },
            };
        }
        const discovery = await this.discoverOidc(provider);
        return {
            ok: true,
            provider_type: provider.providerType,
            issuer: discovery.issuer,
            authorization_endpoint: discovery.authorization_endpoint,
            token_endpoint: discovery.token_endpoint,
            jwks_uri: discovery.jwks_uri,
        };
    }
    async startLogin(dto, context) {
        const email = dto.email.trim().toLowerCase();
        const provider = await this.findProviderForEmail(email);
        if (!provider) {
            throw new common_1.UnauthorizedException('No active SSO provider found for this email domain');
        }
        if (provider.providerType === 'saml') {
            return this.startSamlLogin(provider, email);
        }
        if (!sso_constants_1.OIDC_PROVIDER_TYPES.includes(provider.providerType)) {
            throw new common_1.BadRequestException('Unsupported SSO provider type');
        }
        const discovery = await this.discoverOidc(provider);
        const state = (0, crypto_1.randomBytes)(24).toString('base64url');
        const nonce = (0, crypto_1.randomBytes)(24).toString('base64url');
        const codeVerifier = (0, crypto_1.randomBytes)(48).toString('base64url');
        const codeChallenge = (0, crypto_1.createHash)('sha256').update(codeVerifier).digest('base64url');
        const callbackUrl = this.callbackUrl(context);
        await this.prisma.sSOLoginState.create({
            data: {
                tenantId: provider.tenantId,
                providerId: provider.id,
                email,
                state,
                nonce,
                codeVerifier,
                redirectUri: callbackUrl,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        });
        const url = new URL(discovery.authorization_endpoint);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', provider.clientId || '');
        url.searchParams.set('redirect_uri', callbackUrl);
        url.searchParams.set('scope', this.oidcScope());
        url.searchParams.set('state', state);
        url.searchParams.set('nonce', nonce);
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        return {
            provider_id: provider.id,
            provider_name: provider.providerName,
            redirect_url: url.toString(),
        };
    }
    async completeOidcCallback(query, context) {
        if (!query.code || !query.state) {
            throw new common_1.BadRequestException('code and state are required');
        }
        const loginState = await this.prisma.sSOLoginState.findUnique({
            where: { state: query.state },
            include: { provider: { include: { roleMappings: true } } },
        });
        if (!loginState || loginState.expiresAt.getTime() <= Date.now()) {
            throw new common_1.UnauthorizedException('SSO login state is invalid or expired');
        }
        const provider = loginState.provider;
        try {
            const discovery = await this.discoverOidc(provider);
            const tokenResponse = await this.exchangeCodeForTokens(provider, discovery, query.code, loginState.redirectUri, loginState.codeVerifier);
            const claims = await this.validateIdToken(provider, discovery, tokenResponse.id_token, loginState.nonce);
            const user = await this.findOrProvisionUser(provider, loginState.email, claims);
            const profile = await this.rolesService.getUserAccessProfile(user.id);
            const sessionId = this.sessionsService.generateSessionId();
            const tokens = await this.authService.getTokens(user.id, user.email, user.tenantId, profile.role, profile.branchId, profile.isSuperAdmin, sessionId);
            await this.authService.updateRefreshTokenHash(user.id, tokens.refresh_token, profile.role);
            await this.sessionsService.createSession({
                id: sessionId,
                tenantId: user.tenantId,
                userId: user.id,
                providerId: provider.id,
                refreshToken: tokens.refresh_token,
                source: 'sso',
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
            });
            await this.auditService.log({
                tenantId: user.tenantId,
                userId: user.id,
                action: 'SSO_LOGIN',
                entityType: 'SSOProvider',
                entityId: provider.id,
                details: `${user.email} logged in through ${provider.providerName}`,
            });
            await this.prisma.sSOLoginState.delete({ where: { id: loginState.id } });
            return tokens;
        }
        catch (error) {
            await this.auditService.log({
                tenantId: provider.tenantId,
                action: 'SSO_LOGIN_FAILED',
                entityType: 'SSOProvider',
                entityId: provider.id,
                details: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async findOrProvisionUser(provider, loginEmail, claims) {
        const email = this.resolveClaimEmail(claims);
        this.assertSsoEmailAllowed(provider, loginEmail, email);
        const name = claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') || email;
        let user = await this.prisma.user.findUnique({ where: { email } });
        const wasCreated = !user;
        if (!user) {
            if (!provider.autoProvision) {
                throw new common_1.ForbiddenException('User auto provisioning is disabled');
            }
            await this.billingService.assertCanAddAdminUser(provider.tenantId);
            user = await this.prisma.user.create({
                data: {
                    email,
                    name,
                    password: await bcrypt.hash((0, crypto_1.randomBytes)(32).toString('base64url'), 10),
                    tenantId: provider.tenantId,
                    branchId: provider.defaultBranchId || null,
                    isSuperAdmin: false,
                    role: client_1.UserRole.ADMIN,
                },
            });
            await this.auditService.log({
                tenantId: provider.tenantId,
                userId: user.id,
                action: 'SSO_USER_PROVISIONED',
                entityType: 'User',
                entityId: user.id,
                details: `${email} provisioned through ${provider.providerName}`,
            });
        }
        await this.rolesService.ensureTenantSystemRoles(provider.tenantId);
        await this.applyRoleMappings(provider, user, claims);
        if (!wasCreated) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { name },
            });
        }
        return this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    }
    async applyRoleMappings(provider, user, claims) {
        const groups = this.extractGroups(claims).map((group) => group.toLowerCase());
        const matched = (provider.roleMappings || []).filter((mapping) => groups.includes(mapping.externalGroup.toLowerCase()));
        const mappings = matched.length > 0
            ? matched
            : provider.defaultRoleId
                ? [{ roleId: provider.defaultRoleId, branchId: provider.defaultBranchId, externalGroup: 'default' }]
                : [await this.defaultBranchAdminMapping(provider.tenantId, provider.defaultBranchId)];
        const roles = await this.prisma.role.findMany({
            where: { id: { in: mappings.map((mapping) => mapping.roleId) }, tenantId: provider.tenantId },
        });
        const roleById = new Map(roles.map((role) => [role.id, role]));
        for (const mapping of mappings) {
            const role = roleById.get(mapping.roleId);
            if (!role)
                continue;
            await this.prisma.userRoleAssignment.upsert({
                where: {
                    userId_roleId_branchId: {
                        userId: user.id,
                        roleId: role.id,
                        branchId: mapping.branchId || null,
                    },
                },
                update: { isActive: true, revokedAt: null },
                create: {
                    tenantId: provider.tenantId,
                    userId: user.id,
                    roleId: role.id,
                    branchId: mapping.branchId || null,
                    assignedBy: `sso:${provider.id}`,
                },
            });
            await this.auditService.log({
                tenantId: provider.tenantId,
                userId: user.id,
                action: 'SSO_ROLE_MAPPING_APPLIED',
                entityType: 'Role',
                entityId: role.id,
                details: `${mapping.externalGroup} mapped to ${role.name}`,
            });
        }
        const primaryRole = roles.find((role) => role.name === 'Super Admin') || roles[0];
        if (primaryRole) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    role: primaryRole.name === 'Finance' ? client_1.UserRole.FINANCE : client_1.UserRole.ADMIN,
                    isSuperAdmin: primaryRole.name === 'Super Admin',
                    branchId: primaryRole.name === 'Super Admin' ? null : (mappings[0]?.branchId || provider.defaultBranchId || user.branchId),
                },
            });
        }
    }
    async defaultBranchAdminMapping(tenantId, branchId) {
        const role = await this.prisma.role.findFirst({
            where: { tenantId, name: 'Branch Admin', isActive: true },
        });
        if (!role)
            throw new common_1.BadRequestException('Default Branch Admin role not found');
        return { roleId: role.id, branchId: branchId || null, externalGroup: 'default' };
    }
    async discoverOidc(provider) {
        if (!provider.clientId)
            throw new common_1.BadRequestException('client_id is required for OIDC SSO');
        const metadataUrl = provider.metadataUrl || `${provider.issuerUrl?.replace(/\/+$/, '')}/.well-known/openid-configuration`;
        if (!metadataUrl || metadataUrl.includes('undefined')) {
            throw new common_1.BadRequestException('issuer_url or metadata_url is required for OIDC SSO');
        }
        const response = await fetch(metadataUrl);
        if (!response.ok) {
            throw new common_1.BadRequestException(`Could not load OIDC metadata: HTTP ${response.status}`);
        }
        const discovery = await response.json();
        for (const key of ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
            if (!discovery[key])
                throw new common_1.BadRequestException(`OIDC metadata missing ${key}`);
        }
        return discovery;
    }
    async exchangeCodeForTokens(provider, discovery, code, redirectUri, codeVerifier) {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: provider.clientId,
            code_verifier: codeVerifier,
        });
        if (provider.clientSecret)
            body.set('client_secret', provider.clientSecret);
        const response = await fetch(discovery.token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const payload = await response.json();
        if (!response.ok || !payload.id_token) {
            throw new common_1.UnauthorizedException(payload.error_description || payload.error || 'OIDC token exchange failed');
        }
        return payload;
    }
    async validateIdToken(provider, discovery, idToken, nonce) {
        const [headerPart, payloadPart, signaturePart] = idToken.split('.');
        if (!headerPart || !payloadPart || !signaturePart)
            throw new common_1.UnauthorizedException('Invalid ID token');
        const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
        const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
        if (header.alg !== 'RS256')
            throw new common_1.UnauthorizedException('Only RS256 ID tokens are supported');
        const jwksResponse = await fetch(discovery.jwks_uri);
        const jwks = await jwksResponse.json();
        const jwk = jwks.keys?.find((key) => key.kid === header.kid);
        if (!jwk)
            throw new common_1.UnauthorizedException('Signing key not found');
        const verifier = (0, crypto_1.createVerify)('RSA-SHA256');
        verifier.update(`${headerPart}.${payloadPart}`);
        verifier.end();
        const valid = verifier.verify((0, crypto_1.createPublicKey)({ key: jwk, format: 'jwk' }), Buffer.from(signaturePart, 'base64url'));
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid ID token signature');
        const expectedIssuer = provider.issuerUrl || discovery.issuer;
        if (claims.iss !== expectedIssuer && claims.iss !== discovery.issuer)
            throw new common_1.UnauthorizedException('Issuer validation failed');
        const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        if (!audiences.includes(provider.clientId))
            throw new common_1.UnauthorizedException('Audience validation failed');
        if (Number(claims.exp || 0) * 1000 <= Date.now())
            throw new common_1.UnauthorizedException('ID token expired');
        if (claims.nonce !== nonce)
            throw new common_1.UnauthorizedException('Nonce validation failed');
        if (claims.email_verified === false)
            throw new common_1.UnauthorizedException('Email is not verified by identity provider');
        return claims;
    }
    async findProviderForEmail(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain)
            return null;
        const user = await this.prisma.user.findUnique({ where: { email } });
        const userTenantProvider = user
            ? await this.prisma.sSOProvider.findFirst({
                where: {
                    tenantId: user.tenantId,
                    status: 'active',
                    emailDomains: { has: domain },
                },
                include: { roleMappings: true },
            })
            : null;
        if (userTenantProvider)
            return userTenantProvider;
        return this.prisma.sSOProvider.findFirst({
            where: { status: 'active', emailDomains: { has: domain } },
            include: { roleMappings: true },
        });
    }
    startSamlLogin(provider, email) {
        const ssoUrl = this.extractSamlSsoUrl(provider.samlMetadata || '');
        if (!ssoUrl) {
            throw new common_1.BadRequestException('SAML metadata must include SingleSignOnService Location');
        }
        const request = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${(0, crypto_1.randomBytes)(16).toString('hex')}" Version="2.0" IssueInstant="${new Date().toISOString()}"><samlp:NameIDPolicy AllowCreate="true"/></samlp:AuthnRequest>`;
        const samlRequest = (0, zlib_1.deflateRawSync)(Buffer.from(request)).toString('base64');
        const url = new URL(ssoUrl);
        url.searchParams.set('SAMLRequest', samlRequest);
        url.searchParams.set('RelayState', email);
        return {
            provider_id: provider.id,
            provider_name: provider.providerName,
            redirect_url: url.toString(),
            saml: true,
        };
    }
    extractSamlSsoUrl(metadata) {
        return metadata.match(/SingleSignOnService[^>]+Location=["']([^"']+)["']/i)?.[1] || null;
    }
    async syncRoleMappings(tenantId, providerId, mappings) {
        await this.prisma.sSORoleMapping.deleteMany({ where: { providerId } });
        if (!mappings.length)
            return;
        await this.validateMappings(tenantId, mappings);
        await this.prisma.sSORoleMapping.createMany({
            data: mappings
                .filter((mapping) => mapping.external_group?.trim() && mapping.role_id)
                .map((mapping) => ({
                providerId,
                externalGroup: mapping.external_group.trim(),
                roleId: mapping.role_id,
                branchId: mapping.branch_id || null,
            })),
            skipDuplicates: true,
        });
    }
    async validateProviderReferences(tenantId, dto) {
        if (dto.default_role_id) {
            const role = await this.prisma.role.findFirst({ where: { id: dto.default_role_id, tenantId } });
            if (!role)
                throw new common_1.BadRequestException('default_role_id must belong to this tenant');
        }
        if (dto.default_branch_id) {
            const branch = await this.prisma.branch.findFirst({ where: { id: dto.default_branch_id, tenantId } });
            if (!branch)
                throw new common_1.BadRequestException('default_branch_id must belong to this tenant');
        }
        if (dto.role_mappings) {
            await this.validateMappings(tenantId, dto.role_mappings);
        }
    }
    async validateMappings(tenantId, mappings) {
        const roleIds = [...new Set(mappings.map((mapping) => mapping.role_id).filter(Boolean))];
        const branchIds = [...new Set(mappings.map((mapping) => mapping.branch_id).filter(Boolean))];
        const [roleCount, branchCount] = await Promise.all([
            this.prisma.role.count({ where: { id: { in: roleIds }, tenantId } }),
            branchIds.length ? this.prisma.branch.count({ where: { id: { in: branchIds }, tenantId } }) : Promise.resolve(0),
        ]);
        if (roleCount !== roleIds.length)
            throw new common_1.BadRequestException('All mapped roles must belong to this tenant');
        if (branchIds.length && branchCount !== branchIds.length)
            throw new common_1.BadRequestException('All mapped branches must belong to this tenant');
    }
    async getProviderForTenant(tenantId, id) {
        const provider = await this.prisma.sSOProvider.findFirst({
            where: { id, tenantId },
            include: { roleMappings: true },
        });
        if (!provider)
            throw new common_1.NotFoundException('SSO provider not found');
        return this.serializeProvider(provider);
    }
    async findProvider(tenantId, id) {
        const provider = await this.prisma.sSOProvider.findFirst({
            where: { id, tenantId },
            include: { roleMappings: true },
        });
        if (!provider)
            throw new common_1.NotFoundException('SSO provider not found');
        return provider;
    }
    normalizeDomains(domains) {
        return [...new Set((domains || []).map((domain) => domain.trim().toLowerCase()).filter(Boolean))];
    }
    assertProviderCanBeActive(status, emailDomains) {
        if (status === 'active' && emailDomains.length === 0) {
            throw new common_1.BadRequestException('At least one email domain is required for active SSO providers');
        }
    }
    extractGroups(claims) {
        const groups = claims.groups || claims.roles || claims['https://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || [];
        if (Array.isArray(groups))
            return groups.map(String);
        if (typeof groups === 'string')
            return [groups];
        return [];
    }
    resolveClaimEmail(claims) {
        const email = String(claims.email || claims.preferred_username || '')
            .trim()
            .toLowerCase();
        if (!email || !email.includes('@')) {
            throw new common_1.UnauthorizedException('Identity provider did not return a valid email');
        }
        return email;
    }
    assertSsoEmailAllowed(provider, requestedEmail, claimEmail) {
        const normalizedRequestedEmail = requestedEmail.trim().toLowerCase();
        if (claimEmail !== normalizedRequestedEmail) {
            throw new common_1.UnauthorizedException('SSO identity did not match requested email');
        }
        const domain = claimEmail.split('@')[1]?.toLowerCase();
        const allowedDomains = (provider.emailDomains || []).map((item) => String(item).toLowerCase());
        if (!domain || !allowedDomains.includes(domain)) {
            throw new common_1.UnauthorizedException('Email domain is not allowed for this SSO provider');
        }
    }
    oidcScope() {
        return 'openid email profile';
    }
    callbackUrl(context) {
        const publicUrl = this.configService.get('BACKEND_PUBLIC_URL') || context.origin || 'http://localhost:5000';
        return `${publicUrl.replace(/\/+$/, '')}/api/auth/sso/callback`;
    }
    serializeProvider(provider) {
        return {
            id: provider.id,
            tenant_id: provider.tenantId,
            provider_type: provider.providerType,
            provider_name: provider.providerName,
            client_id: provider.clientId,
            client_secret_configured: Boolean(provider.clientSecret),
            issuer_url: provider.issuerUrl,
            metadata_url: provider.metadataUrl,
            saml_metadata_configured: Boolean(provider.samlMetadata),
            email_domains: provider.emailDomains,
            auto_provision: provider.autoProvision,
            default_role_id: provider.defaultRoleId,
            default_branch_id: provider.defaultBranchId,
            status: provider.status,
            created_at: provider.createdAt,
            updated_at: provider.updatedAt,
            role_mappings: (provider.roleMappings || []).map((mapping) => ({
                id: mapping.id,
                external_group: mapping.externalGroup,
                role_id: mapping.roleId,
                branch_id: mapping.branchId,
            })),
        };
    }
};
exports.SsoService = SsoService;
exports.SsoService = SsoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        roles_service_1.RolesService,
        auth_service_1.AuthService,
        sessions_service_1.SessionsService,
        config_1.ConfigService,
        billing_service_1.BillingService])
], SsoService);
//# sourceMappingURL=sso.service.js.map