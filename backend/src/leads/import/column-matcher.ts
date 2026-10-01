import {
  ColumnMapping,
  ImportableField,
  IMPORTABLE_FIELDS,
} from './crm-import.types';

/**
 * Header aliases seen across the CRMs customers export from (HubSpot,
 * Salesforce, Pipedrive, Zoho, GoHighLevel, Close, Freshsales, Copper,
 * Monday, Airtable, Excel hand-rolls). Ordered most- to least-specific:
 * the first alias that matches a header wins, so "company name" is
 * preferred over a bare "company" when both are present.
 */
const FIELD_ALIASES: Record<ImportableField, string[]> = {
  name: [
    'full name',
    'contact name',
    'contact',
    'lead name',
    'person name',
    'display name',
    'name',
    'first name',
    'firstname',
    'given name',
  ],
  company: [
    'company name',
    'account name',
    'organization name',
    'organisation name',
    'company',
    'account',
    'organization',
    'organisation',
    'org',
    'business name',
    'employer',
  ],
  email: [
    'email address',
    'email',
    'e-mail',
    'email1',
    'primary email',
    'work email',
    'contact email',
    'mail',
  ],
  status: [
    'lead status',
    'hs_lead_status',
    'status',
    'stage',
    'lead stage',
    'deal stage',
    'pipeline stage',
    'lifecycle stage',
  ],
};

/**
 * Header signatures that identify the source CRM. Only used to label the
 * preview ("This looks like a Salesforce export") - mapping never depends
 * on it, so an unrecognised CRM still imports fine.
 */
const CRM_SIGNATURES: { label: string; headers: string[] }[] = [
  {
    label: 'HubSpot',
    headers: ['hs_lead_status', 'record id', 'associated company'],
  },
  { label: 'Salesforce', headers: ['lead id', 'salutation', 'lead source'] },
  {
    label: 'Pipedrive',
    headers: ['person - name', 'organization - name', 'deal - title'],
  },
  {
    label: 'Zoho CRM',
    headers: ['lead owner', 'lead source', 'secondary email'],
  },
  {
    label: 'GoHighLevel',
    headers: ['contact id', 'location id', 'business name'],
  },
  {
    label: 'Close',
    headers: ['lead name', 'opportunity status', 'contact emails'],
  },
  { label: 'Copper', headers: ['related company', 'inactive days'] },
];

/** Lowercases, strips punctuation, and collapses whitespace/underscores. */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Guesses which uploaded column feeds each lead field. A header is claimed
 * by at most one field so two fields never read the same column.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => ({
    original: header,
    normal: normalizeHeader(header),
  }));

  const mapping: ColumnMapping = {};
  const claimed = new Set<string>();

  for (const field of IMPORTABLE_FIELDS) {
    for (const alias of FIELD_ALIASES[field]) {
      const exact = normalized.find(
        (header) => header.normal === alias && !claimed.has(header.original),
      );
      if (exact) {
        mapping[field] = exact.original;
        claimed.add(exact.original);
        break;
      }
    }

    if (mapping[field]) continue;

    // No exact hit - fall back to a header that contains the alias, which
    // catches prefixed exports like "Contact - Email" or "lead_email_1".
    for (const alias of FIELD_ALIASES[field]) {
      const partial = normalized.find(
        (header) =>
          header.normal.includes(alias) && !claimed.has(header.original),
      );
      if (partial) {
        mapping[field] = partial.original;
        claimed.add(partial.original);
        break;
      }
    }
  }

  return mapping;
}

/** Names the source CRM when its header signature is recognisable. */
export function detectCrm(headers: string[]): string | null {
  const normalized = new Set(headers.map(normalizeHeader));

  for (const signature of CRM_SIGNATURES) {
    const hits = signature.headers.filter((header) =>
      normalized.has(normalizeHeader(header)),
    ).length;
    if (hits >= 2) return signature.label;
  }

  return null;
}

/**
 * Joins separate first/last name columns, which most CRMs export instead of
 * a single name field.
 */
export function findNameParts(headers: string[]) {
  const normalized = headers.map((header) => ({
    original: header,
    normal: normalizeHeader(header),
  }));

  const first = normalized.find((header) =>
    ['first name', 'firstname', 'given name'].includes(header.normal),
  );
  const last = normalized.find((header) =>
    ['last name', 'lastname', 'surname', 'family name'].includes(header.normal),
  );

  return first && last ? { first: first.original, last: last.original } : null;
}
