export const SUPPORTED_COMPANY_PROVIDERS = [
  'mock',
  'apollo',
  'crunchbase',
  'clearbit',
] as const;

export type CompanyProviderName = (typeof SUPPORTED_COMPANY_PROVIDERS)[number];

/**
 * Providers with a real, working implementation today. Every other supported
 * name resolves to a placeholder that boots fine but returns a clear
 * "not implemented yet" error the moment it's actually used - selecting a
 * known-future provider should not crash the whole application.
 */
export const ACTIVE_COMPANY_PROVIDERS: CompanyProviderName[] = ['mock'];

/**
 * Resolves and validates the COMPANY_PROVIDER config value. Throws for
 * genuinely unrecognized values (typos, unsupported names) so misconfiguration
 * fails fast at application startup rather than surfacing as a confusing
 * runtime error deep in a search request.
 */
export function resolveCompanyProviderName(
  rawValue: string | undefined | null,
): CompanyProviderName {
  const normalized = (rawValue || 'mock').trim().toLowerCase();

  if (
    !(SUPPORTED_COMPANY_PROVIDERS as readonly string[]).includes(normalized)
  ) {
    throw new Error(
      `Invalid COMPANY_PROVIDER "${rawValue}". Supported values: ${SUPPORTED_COMPANY_PROVIDERS.join(', ')}.`,
    );
  }

  return normalized as CompanyProviderName;
}
