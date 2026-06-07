import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateSSOProviderDto } from './dto/create-sso-provider.dto';
import { SSOTestDto } from './dto/sso-login.dto';
import { UpdateSSOProviderDto } from './dto/update-sso-provider.dto';
import { SsoService } from './sso.service';
export declare class SsoController {
    private readonly ssoService;
    constructor(ssoService: SsoService);
    listProviders(user: ActiveUser): Promise<{
        id: any;
        tenant_id: any;
        provider_type: any;
        provider_name: any;
        client_id: any;
        client_secret_configured: boolean;
        issuer_url: any;
        metadata_url: any;
        saml_metadata_configured: boolean;
        email_domains: any;
        auto_provision: any;
        default_role_id: any;
        default_branch_id: any;
        status: any;
        created_at: any;
        updated_at: any;
        role_mappings: any;
    }[]>;
    createProvider(user: ActiveUser, dto: CreateSSOProviderDto): Promise<{
        id: any;
        tenant_id: any;
        provider_type: any;
        provider_name: any;
        client_id: any;
        client_secret_configured: boolean;
        issuer_url: any;
        metadata_url: any;
        saml_metadata_configured: boolean;
        email_domains: any;
        auto_provision: any;
        default_role_id: any;
        default_branch_id: any;
        status: any;
        created_at: any;
        updated_at: any;
        role_mappings: any;
    }>;
    updateProvider(user: ActiveUser, id: string, dto: UpdateSSOProviderDto): Promise<{
        id: any;
        tenant_id: any;
        provider_type: any;
        provider_name: any;
        client_id: any;
        client_secret_configured: boolean;
        issuer_url: any;
        metadata_url: any;
        saml_metadata_configured: boolean;
        email_domains: any;
        auto_provision: any;
        default_role_id: any;
        default_branch_id: any;
        status: any;
        created_at: any;
        updated_at: any;
        role_mappings: any;
    }>;
    testProvider(user: ActiveUser, dto: SSOTestDto): Promise<{
        ok: boolean;
        provider_type: string;
        checks: {
            metadata_present: boolean;
            sso_service_present: boolean;
            certificate_present: boolean;
            signature_validation_ready: boolean;
        };
        issuer?: undefined;
        authorization_endpoint?: undefined;
        token_endpoint?: undefined;
        jwks_uri?: undefined;
    } | {
        ok: boolean;
        provider_type: string;
        issuer: string;
        authorization_endpoint: string;
        token_endpoint: string;
        jwks_uri: string;
        checks?: undefined;
    }>;
}
