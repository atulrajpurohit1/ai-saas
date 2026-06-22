import { SsoService } from './sso.service';

describe('SsoService', () => {
  let service: SsoService;
  let prisma: any;
  let auditService: { log: jest.Mock };

  const tenantId = 'tenant-1';
  const provider = {
    id: 'provider-1',
    tenantId,
    providerType: 'google_oidc',
    providerName: 'Google Workspace',
    clientId: 'client-id.apps.googleusercontent.com',
    clientSecret: 'secret',
    issuerUrl: 'https://accounts.google.com',
    metadataUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    emailDomains: ['company.com'],
    autoProvision: true,
    defaultRoleId: null,
    defaultBranchId: null,
    roleMappings: [],
  };
  const discovery = {
    issuer: 'https://accounts.google.com',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      sSOProvider: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      sSOLoginState: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      userRoleAssignment: {
        upsert: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    service = new SsoService(
      prisma,
      auditService as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
    );
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(discovery),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts OIDC login only through a provider matching the email domain', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.sSOProvider.findFirst.mockResolvedValue(provider);
    prisma.sSOLoginState.create.mockResolvedValue({});

    const result = await service.startLogin(
      { email: 'User@Company.com' },
      { origin: 'http://localhost:5000' },
    );

    expect(prisma.sSOProvider.findFirst).toHaveBeenCalledWith({
      where: { status: 'active', emailDomains: { has: 'company.com' } },
      include: { roleMappings: true },
    });
    const redirectUrl = new URL(result.redirect_url);
    expect(redirectUrl.searchParams.get('scope')).toBe('openid email profile');
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5000/api/auth/sso/callback',
    );
    expect(redirectUrl.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('rejects active providers without email domains', async () => {
    await expect(
      service.createProvider(
        { sub: 'admin-1', tenantId, role: 'admin' } as any,
        {
          provider_type: 'google_oidc',
          provider_name: 'Google Workspace',
          client_id: 'client-id.apps.googleusercontent.com',
          issuer_url: 'https://accounts.google.com',
          email_domains: [],
          status: 'active',
        },
      ),
    ).rejects.toThrow('At least one email domain is required for active SSO providers');
    expect(prisma.sSOProvider.create).not.toHaveBeenCalled();
  });

  it('keeps existing-user provider lookup constrained to the requested domain', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', tenantId });
    prisma.sSOProvider.findFirst.mockResolvedValue(provider);
    prisma.sSOLoginState.create.mockResolvedValue({});

    await service.startLogin(
      { email: 'user@company.com' },
      { origin: 'http://localhost:5000' },
    );

    expect(prisma.sSOProvider.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId,
        status: 'active',
        emailDomains: { has: 'company.com' },
      },
      include: { roleMappings: true },
    });
  });

  it('rejects callbacks when the identity provider email differs from the requested email', async () => {
    prisma.sSOLoginState.findUnique.mockResolvedValue({
      id: 'state-row-1',
      email: 'user@company.com',
      state: 'state-1',
      codeVerifier: 'verifier',
      redirectUri: 'http://localhost:5000/api/auth/sso/callback',
      expiresAt: new Date(Date.now() + 60_000),
      provider,
    });
    jest.spyOn(service as any, 'discoverOidc').mockResolvedValue(discovery);
    jest.spyOn(service as any, 'exchangeCodeForTokens').mockResolvedValue({ id_token: 'id-token' });
    jest.spyOn(service as any, 'validateIdToken').mockResolvedValue({
      email: 'attacker@gmail.com',
      email_verified: true,
    });

    await expect(
      service.completeOidcCallback({ code: 'code-1', state: 'state-1' }, {}),
    ).rejects.toThrow('SSO identity did not match requested email');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.sSOLoginState.delete).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SSO_LOGIN_FAILED' }),
    );
  });
});
