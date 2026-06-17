import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CrmConnectorsService } from './crm-connectors.service';
export declare class CrmConnectorsController {
    private readonly crmConnectorsService;
    constructor(crmConnectorsService: CrmConnectorsService);
    getStatus(user: ActiveUser): Promise<{
        hubspot: {
            configured: boolean;
            connected: boolean;
            status: string;
            portal_id: string | null;
            external_account_name: string | null;
            scopes: string[];
            token_expires_at: Date | null;
            last_sync_at: Date | null;
            last_error: string | null;
        };
    }>;
    getHubSpotConnectUrl(user: ActiveUser): {
        provider: string;
        url: string;
    };
    hubSpotCallback(code?: string, state?: string): Promise<{
        url: string;
    }>;
    importHubSpotContacts(user: ActiveUser): Promise<{
        provider: string;
        total: number;
        created: number;
        updated: number;
        skipped: number;
    }>;
    disconnectHubSpot(user: ActiveUser): Promise<{
        provider: any;
        status: any;
        portal_id: any;
        external_account_name: any;
        scopes: any;
        token_expires_at: any;
        last_sync_at: any;
        last_error: any;
    }>;
}
