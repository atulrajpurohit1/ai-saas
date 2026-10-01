"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHeader = normalizeHeader;
exports.suggestMapping = suggestMapping;
exports.detectCrm = detectCrm;
exports.findNameParts = findNameParts;
const crm_import_types_1 = require("./crm-import.types");
const FIELD_ALIASES = {
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
const CRM_SIGNATURES = [
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
function normalizeHeader(header) {
    return header
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/[_\-.]+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function suggestMapping(headers) {
    const normalized = headers.map((header) => ({
        original: header,
        normal: normalizeHeader(header),
    }));
    const mapping = {};
    const claimed = new Set();
    for (const field of crm_import_types_1.IMPORTABLE_FIELDS) {
        for (const alias of FIELD_ALIASES[field]) {
            const exact = normalized.find((header) => header.normal === alias && !claimed.has(header.original));
            if (exact) {
                mapping[field] = exact.original;
                claimed.add(exact.original);
                break;
            }
        }
        if (mapping[field])
            continue;
        for (const alias of FIELD_ALIASES[field]) {
            const partial = normalized.find((header) => header.normal.includes(alias) && !claimed.has(header.original));
            if (partial) {
                mapping[field] = partial.original;
                claimed.add(partial.original);
                break;
            }
        }
    }
    return mapping;
}
function detectCrm(headers) {
    const normalized = new Set(headers.map(normalizeHeader));
    for (const signature of CRM_SIGNATURES) {
        const hits = signature.headers.filter((header) => normalized.has(normalizeHeader(header))).length;
        if (hits >= 2)
            return signature.label;
    }
    return null;
}
function findNameParts(headers) {
    const normalized = headers.map((header) => ({
        original: header,
        normal: normalizeHeader(header),
    }));
    const first = normalized.find((header) => ['first name', 'firstname', 'given name'].includes(header.normal));
    const last = normalized.find((header) => ['last name', 'lastname', 'surname', 'family name'].includes(header.normal));
    return first && last ? { first: first.original, last: last.original } : null;
}
//# sourceMappingURL=column-matcher.js.map