export declare class CreateClientInsurancePolicyDto {
    client_id: string;
    site_id?: string | null;
    type: string;
    policy_number?: string;
    insurer?: string;
    coverage_amount?: number;
    effective_date?: string;
    expiration_date?: string;
    notes?: string;
}
