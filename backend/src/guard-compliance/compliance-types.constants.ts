// Configurable list of tracked compliance categories (Phase 3C). Adding a
// new type is a one-line change here, not a schema migration - `type` on
// GuardCompliance is a validated string, not a Prisma enum, matching the
// project's existing convention (Deal.stage, Proposal.status, etc.).
export const GUARD_COMPLIANCE_TYPES = [
  'guard_license',
  'firearm_permit',
  'training_certification',
  'background_check',
  'certificate_of_insurance',
  'other',
] as const;

export type GuardComplianceType = (typeof GUARD_COMPLIANCE_TYPES)[number];

export const GUARD_COMPLIANCE_TYPE_LABELS: Record<GuardComplianceType, string> =
  {
    guard_license: 'Guard License',
    firearm_permit: 'Firearm Permit',
    training_certification: 'Training Certification',
    background_check: 'Background Check',
    certificate_of_insurance: 'Certificate of Insurance (COI)',
    other: 'Other',
  };
