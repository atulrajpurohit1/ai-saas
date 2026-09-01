export declare const CLIENT_INSURANCE_TYPES: readonly ["general_liability", "workers_comp", "professional_liability", "umbrella", "certificate_of_insurance", "other"];
export type ClientInsuranceType = (typeof CLIENT_INSURANCE_TYPES)[number];
export declare const CLIENT_INSURANCE_TYPE_LABELS: Record<ClientInsuranceType, string>;
export declare const CLIENT_INSURANCE_REQUIRED_TYPES: readonly ClientInsuranceType[];
