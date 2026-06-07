import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, createPublicKey, createVerify, randomBytes } from 'crypto';
import { deflateRawSync } from 'zlib';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { CreateSSOProviderDto, SSORoleMappingDto } from './dto/create-sso-provider.dto';
import { SSOLoginDto, SSOTestDto } from './dto/sso-login.dto';
import { UpdateSSOProviderDto } from './dto/update-sso-provider.dto';
import { OIDC_PROVIDER_TYPES } from './sso.constants';

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
  origin?: string | null;
};

type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rolesService: RolesService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly configService: ConfigService,
  ) {}

  async listProviders(user: ActiveUser) {
    const providers = await this.prisma.sSOProvider.findMany({
      where: { tenantId: user.tenantId },
      include: {
        roleMappings: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((provider) => this.serializeProvider(provider));
  }

  async createProvider(user: ActiveUser, dto: CreateSSOProviderDto) {
    await this.validateProviderReferences(user.tenantId, dto);
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
        emailDomains: this.normalizeDomains(dto.email_domains),
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

  async updateProvider(user: ActiveUser, id: string, dto: UpdateSSOProviderDto) {
    const existing = await this.findProvider(user.tenantId, id);
    await this.validateProviderReferences(user.tenantId, dto);
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
        ...(dto.email_domains !== undefined ? { emailDomains: this.normalizeDomains(dto.email_domains) } : {}),
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

  async testProvider(user: ActiveUser, dto: SSOTestDto) {
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

  async startLogin(dto: SSOLoginDto, context: RequestContext) {
    const email = dto.email.trim().toLowerCase();
    const provider = await this.findProviderForEmail(email);
    if (!provider) {
      throw new UnauthorizedException('No active SSO provider found for this email domain');
    }

    if (provider.providerType === 'saml') {
      return this.startSamlLogin(provider, email);
    }

    if (!OIDC_PROVIDER_TYPES.includes(provider.providerType as any)) {
      throw new BadRequestException('Unsupported SSO provider type');
    }

    const discovery = await this.discoverOidc(provider);
    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
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
    url.searchParams.set('scope', 'openid email profile groups');
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

  async completeOidcCallback(query: { code?: string; state?: string }, context: RequestContext) {
    if (!query.code || !query.state) {
      throw new BadRequestException('code and state are required');
    }

    const loginState = await this.prisma.sSOLoginState.findUnique({
      where: { state: query.state },
      include: { provider: { include: { roleMappings: true } } },
    });

    if (!loginState || loginState.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('SSO login state is invalid or expired');
    }

    const provider = loginState.provider;
    try {
      const discovery = await this.discoverOidc(provider);
      const tokenResponse = await this.exchangeCodeForTokens(
        provider,
        discovery,
        query.code,
        loginState.redirectUri,
        loginState.codeVerifier,
      );
      const claims = await this.validateIdToken(provider, discovery, tokenResponse.id_token, loginState.nonce);
      const user = await this.findOrProvisionUser(provider, loginState.email, claims);
      const profile = await this.rolesService.getUserAccessProfile(user.id);
      const sessionId = this.sessionsService.generateSessionId();
      const tokens = await this.authService.getTokens(
        user.id,
        user.email,
        user.tenantId,
        profile.role,
        profile.branchId,
        profile.isSuperAdmin,
        sessionId,
      );

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
    } catch (error) {
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

  private async findOrProvisionUser(provider: any, loginEmail: string, claims: Record<string, any>) {
    const email = (claims.email || claims.preferred_username || loginEmail).toLowerCase();
    const name = claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') || email;
    let user = await this.prisma.user.findUnique({ where: { email } });
    const wasCreated = !user;

    if (!user) {
      if (!provider.autoProvision) {
        throw new ForbiddenException('User auto provisioning is disabled');
      }
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          password: await bcrypt.hash(randomBytes(32).toString('base64url'), 10),
          tenantId: provider.tenantId,
          branchId: provider.defaultBranchId || null,
          isSuperAdmin: false,
          role: UserRole.ADMIN,
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

  private async applyRoleMappings(provider: any, user: any, claims: Record<string, any>) {
    const groups = this.extractGroups(claims).map((group) => group.toLowerCase());
    const matched = (provider.roleMappings || []).filter((mapping) =>
      groups.includes(mapping.externalGroup.toLowerCase()),
    );
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
      if (!role) continue;
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
          role: primaryRole.name === 'Finance' ? UserRole.FINANCE : UserRole.ADMIN,
          isSuperAdmin: primaryRole.name === 'Super Admin',
          branchId: primaryRole.name === 'Super Admin' ? null : (mappings[0]?.branchId || provider.defaultBranchId || user.branchId),
        },
      });
    }
  }

  private async defaultBranchAdminMapping(tenantId: string, branchId?: string | null) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: 'Branch Admin', isActive: true },
    });
    if (!role) throw new BadRequestException('Default Branch Admin role not found');
    return { roleId: role.id, branchId: branchId || null, externalGroup: 'default' };
  }

  private async discoverOidc(provider: any): Promise<OidcDiscovery> {
    if (!provider.clientId) throw new BadRequestException('client_id is required for OIDC SSO');
    const metadataUrl = provider.metadataUrl || `${provider.issuerUrl?.replace(/\/+$/, '')}/.well-known/openid-configuration`;
    if (!metadataUrl || metadataUrl.includes('undefined')) {
      throw new BadRequestException('issuer_url or metadata_url is required for OIDC SSO');
    }

    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new BadRequestException(`Could not load OIDC metadata: HTTP ${response.status}`);
    }
    const discovery = await response.json();
    for (const key of ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
      if (!discovery[key]) throw new BadRequestException(`OIDC metadata missing ${key}`);
    }
    return discovery;
  }

  private async exchangeCodeForTokens(provider: any, discovery: OidcDiscovery, code: string, redirectUri: string, codeVerifier: string) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      code_verifier: codeVerifier,
    });
    if (provider.clientSecret) body.set('client_secret', provider.clientSecret);

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await response.json();
    if (!response.ok || !payload.id_token) {
      throw new UnauthorizedException(payload.error_description || payload.error || 'OIDC token exchange failed');
    }
    return payload;
  }

  private async validateIdToken(provider: any, discovery: OidcDiscovery, idToken: string, nonce: string) {
    const [headerPart, payloadPart, signaturePart] = idToken.split('.');
    if (!headerPart || !payloadPart || !signaturePart) throw new UnauthorizedException('Invalid ID token');
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (header.alg !== 'RS256') throw new UnauthorizedException('Only RS256 ID tokens are supported');

    const jwksResponse = await fetch(discovery.jwks_uri);
    const jwks = await jwksResponse.json();
    const jwk = jwks.keys?.find((key) => key.kid === header.kid);
    if (!jwk) throw new UnauthorizedException('Signing key not found');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerPart}.${payloadPart}`);
    verifier.end();
    const valid = verifier.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signaturePart, 'base64url'));
    if (!valid) throw new UnauthorizedException('Invalid ID token signature');

    const expectedIssuer = provider.issuerUrl || discovery.issuer;
    if (claims.iss !== expectedIssuer && claims.iss !== discovery.issuer) throw new UnauthorizedException('Issuer validation failed');
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(provider.clientId)) throw new UnauthorizedException('Audience validation failed');
    if (Number(claims.exp || 0) * 1000 <= Date.now()) throw new UnauthorizedException('ID token expired');
    if (claims.nonce !== nonce) throw new UnauthorizedException('Nonce validation failed');
    if (claims.email_verified === false) throw new UnauthorizedException('Email is not verified by identity provider');
    return claims;
  }

  private async findProviderForEmail(email: string) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;

    const user = await this.prisma.user.findUnique({ where: { email } });
    const userTenantProvider = user
      ? await this.prisma.sSOProvider.findFirst({
          where: { tenantId: user.tenantId, status: 'active' },
          include: { roleMappings: true },
        })
      : null;
    if (userTenantProvider) return userTenantProvider;

    return this.prisma.sSOProvider.findFirst({
      where: { status: 'active', emailDomains: { has: domain } },
      include: { roleMappings: true },
    });
  }

  private startSamlLogin(provider: any, email: string) {
    const ssoUrl = this.extractSamlSsoUrl(provider.samlMetadata || '');
    if (!ssoUrl) {
      throw new BadRequestException('SAML metadata must include SingleSignOnService Location');
    }
    const request = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${randomBytes(16).toString('hex')}" Version="2.0" IssueInstant="${new Date().toISOString()}"><samlp:NameIDPolicy AllowCreate="true"/></samlp:AuthnRequest>`;
    const samlRequest = deflateRawSync(Buffer.from(request)).toString('base64');
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

  private extractSamlSsoUrl(metadata: string) {
    return metadata.match(/SingleSignOnService[^>]+Location=["']([^"']+)["']/i)?.[1] || null;
  }

  private async syncRoleMappings(tenantId: string, providerId: string, mappings: SSORoleMappingDto[]) {
    await this.prisma.sSORoleMapping.deleteMany({ where: { providerId } });
    if (!mappings.length) return;
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

  private async validateProviderReferences(tenantId: string, dto: Partial<CreateSSOProviderDto>) {
    if (dto.default_role_id) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.default_role_id, tenantId } });
      if (!role) throw new BadRequestException('default_role_id must belong to this tenant');
    }
    if (dto.default_branch_id) {
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.default_branch_id, tenantId } });
      if (!branch) throw new BadRequestException('default_branch_id must belong to this tenant');
    }
    if (dto.role_mappings) {
      await this.validateMappings(tenantId, dto.role_mappings);
    }
  }

  private async validateMappings(tenantId: string, mappings: SSORoleMappingDto[]) {
    const roleIds = [...new Set(mappings.map((mapping) => mapping.role_id).filter(Boolean))];
    const branchIds = [...new Set(mappings.map((mapping) => mapping.branch_id).filter(Boolean))] as string[];
    const [roleCount, branchCount] = await Promise.all([
      this.prisma.role.count({ where: { id: { in: roleIds }, tenantId } }),
      branchIds.length ? this.prisma.branch.count({ where: { id: { in: branchIds }, tenantId } }) : Promise.resolve(0),
    ]);
    if (roleCount !== roleIds.length) throw new BadRequestException('All mapped roles must belong to this tenant');
    if (branchIds.length && branchCount !== branchIds.length) throw new BadRequestException('All mapped branches must belong to this tenant');
  }

  private async getProviderForTenant(tenantId: string, id: string) {
    const provider = await this.prisma.sSOProvider.findFirst({
      where: { id, tenantId },
      include: { roleMappings: true },
    });
    if (!provider) throw new NotFoundException('SSO provider not found');
    return this.serializeProvider(provider);
  }

  private async findProvider(tenantId: string, id: string) {
    const provider = await this.prisma.sSOProvider.findFirst({
      where: { id, tenantId },
      include: { roleMappings: true },
    });
    if (!provider) throw new NotFoundException('SSO provider not found');
    return provider;
  }

  private normalizeDomains(domains?: string[]) {
    return [...new Set((domains || []).map((domain) => domain.trim().toLowerCase()).filter(Boolean))];
  }

  private extractGroups(claims: Record<string, any>) {
    const groups = claims.groups || claims.roles || claims['https://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || [];
    if (Array.isArray(groups)) return groups.map(String);
    if (typeof groups === 'string') return [groups];
    return [];
  }

  private callbackUrl(context: RequestContext) {
    const publicUrl = this.configService.get<string>('BACKEND_PUBLIC_URL') || context.origin || 'http://localhost:5000';
    return `${publicUrl.replace(/\/+$/, '')}/api/auth/sso/callback`;
  }

  private serializeProvider(provider: any) {
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
}
