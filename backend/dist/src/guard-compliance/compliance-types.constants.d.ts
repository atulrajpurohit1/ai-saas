export declare const GUARD_COMPLIANCE_TYPES: readonly ["guard_license", "firearm_permit", "training_certification", "background_check", "certificate_of_insurance", "other"];
export type GuardComplianceType = (typeof GUARD_COMPLIANCE_TYPES)[number];
export declare const GUARD_COMPLIANCE_TYPE_LABELS: Record<GuardComplianceType, string>;
