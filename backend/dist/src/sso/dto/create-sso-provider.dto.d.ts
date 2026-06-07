export declare class SSORoleMappingDto {
    external_group: string;
    role_id: string;
    branch_id?: string | null;
}
export declare class CreateSSOProviderDto {
    provider_type: string;
    provider_name: string;
    client_id?: string;
    client_secret?: string;
    issuer_url?: string;
    metadata_url?: string;
    saml_metadata?: string;
    email_domains?: string[];
    auto_provision?: boolean;
    default_role_id?: string | null;
    default_branch_id?: string | null;
    status?: string;
    role_mappings?: SSORoleMappingDto[];
}
