export const SSO_PROVIDER_TYPES = ['google_oidc', 'microsoft_oidc', 'okta_oidc', 'auth0_oidc', 'saml'] as const;

export type SSOProviderType = (typeof SSO_PROVIDER_TYPES)[number];

export const OIDC_PROVIDER_TYPES = ['google_oidc', 'microsoft_oidc', 'okta_oidc', 'auth0_oidc'] as const;
