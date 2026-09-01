// Configurable list of tracked client/site insurance categories (Phase 3G).
// Adding a new type is a one-line change here, not a schema migration -
// `type` on ClientInsurancePolicy is a validated string, not a Prisma enum,
// matching the project's existing convention (GuardCompliance.type,
// Deal.stage, Proposal.status, etc.).
export const CLIENT_INSURANCE_TYPES = [
  'general_liability',
  'workers_comp',
  'professional_liability',
  'umbrella',
  'certificate_of_insurance',
  'other',
] as const;

export type ClientInsuranceType = (typeof CLIENT_INSURANCE_TYPES)[number];

export const CLIENT_INSURANCE_TYPE_LABELS: Record<ClientInsuranceType, string> =
  {
    general_liability: 'General Liability',
    workers_comp: "Workers' Compensation",
    professional_liability: 'Professional Liability',
    umbrella: 'Umbrella / Excess',
    certificate_of_insurance: 'Certificate of Insurance (COI)',
    other: 'Other',
  };

// The coverage types a client is expected to carry. Drives the synthesized
// MISSING rows in the admin list (same idea as GUARD_COMPLIANCE_TYPES driving
// guard MISSING detection) so "which client has no COI on file" is
// answerable, not just "list what exists". "umbrella", "professional_liability"
// and "other" are deliberately NOT required - they are situational.
export const CLIENT_INSURANCE_REQUIRED_TYPES: readonly ClientInsuranceType[] = [
  'general_liability',
  'workers_comp',
  'certificate_of_insurance',
];
