import { ProspectCompany } from '../types/prospect-search.types';

/**
 * Every provider returns different fields; each normalizer below maps a
 * provider's raw response into the one internal ProspectCompany shape so the
 * rest of the app (ranking, controllers, frontend) never needs to know which
 * provider is active.
 *
 * The Raw*Organization/Company interfaces are illustrative placeholders
 * standing in for each provider's actual API response schema - replace them
 * with the provider's real SDK/response types when wiring up a live
 * integration. The point of this module is the normalization CONTRACT
 * (always produce a ProspectCompany), not a finished mapping for any
 * specific provider's current API.
 *
 * Note: normalized companies intentionally have no matchScore -
 * ProspectSearchService re-scores every company against the AI-parsed
 * filters after fetching, regardless of provider.
 */

export interface RawApolloOrganization {
  id: string;
  name: string;
  industry?: string | null;
  website_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  estimated_num_employees?: number | null;
  annual_revenue_range?: string | null;
  short_description?: string | null;
}

export interface RawCrunchbaseOrganization {
  uuid: string;
  properties: {
    name: string;
    categories?: string[];
    website?: { value: string } | null;
    city_name?: string | null;
    region_name?: string | null;
    country_code?: string | null;
    num_employees_enum?: string | null;
    revenue_range?: string | null;
    short_description?: string | null;
  };
}

export interface RawClearbitCompany {
  id: string;
  name: string;
  category?: { industry?: string | null } | null;
  domain?: string | null;
  geo?: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
  } | null;
  metrics?: {
    employees?: number | null;
    estimatedAnnualRevenue?: string | null;
  } | null;
  description?: string | null;
}

export function normalizeApolloOrganization(
  raw: RawApolloOrganization,
): ProspectCompany {
  return {
    id: raw.id,
    name: raw.name,
    industry: raw.industry || 'Unknown',
    website: raw.website_url || '',
    city: raw.city || '',
    state: raw.state || '',
    country: raw.country || '',
    employeeCount: raw.estimated_num_employees ?? 0,
    revenueRange: raw.annual_revenue_range || 'Unknown',
    description: raw.short_description || '',
  };
}

export function normalizeCrunchbaseOrganization(
  raw: RawCrunchbaseOrganization,
): ProspectCompany {
  return {
    id: raw.uuid,
    name: raw.properties.name,
    industry: raw.properties.categories?.[0] || 'Unknown',
    website: raw.properties.website?.value || '',
    city: raw.properties.city_name || '',
    state: raw.properties.region_name || '',
    country: raw.properties.country_code || '',
    employeeCount: parseEmployeeEnum(raw.properties.num_employees_enum),
    revenueRange: raw.properties.revenue_range || 'Unknown',
    description: raw.properties.short_description || '',
  };
}

export function normalizeClearbitCompany(
  raw: RawClearbitCompany,
): ProspectCompany {
  return {
    id: raw.id,
    name: raw.name,
    industry: raw.category?.industry || 'Unknown',
    website: raw.domain ? `https://${raw.domain}` : '',
    city: raw.geo?.city || '',
    state: raw.geo?.state || '',
    country: raw.geo?.country || '',
    employeeCount: raw.metrics?.employees ?? 0,
    revenueRange: raw.metrics?.estimatedAnnualRevenue || 'Unknown',
    description: raw.description || '',
  };
}

/**
 * Crunchbase reports headcount as a bucket string (e.g. "c_00051_00100")
 * rather than a number. This takes the midpoint of the bucket as a
 * reasonable numeric estimate for ranking against employeeMin/employeeMax
 * filters; replace with the real Crunchbase enum mapping during integration.
 */
function parseEmployeeEnum(value?: string | null): number {
  if (!value) return 0;

  const match = value.match(/(\d+)_(\d+)/);
  if (!match) return 0;

  const low = Number(match[1]);
  const high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 0;

  return Math.round((low + high) / 2);
}
