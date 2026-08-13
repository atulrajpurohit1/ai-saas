import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CrmConnectorsService } from './crm-connectors.service';
import { SyncContactDto } from './dto/sync-contact.dto';
export declare class CrmConnectorsController {
    private readonly crmConnectorsService;
    constructor(crmConnectorsService: CrmConnectorsService);
    getStatus(user: ActiveUser): Promise<Record<string, {
        configured: boolean;
        connected: boolean;
        status: string;
        portal_id: string | null;
        external_account_name: string | null;
        scopes: string[];
        token_expires_at: Date | null;
        last_sync_at: Date | null;
        last_error: string | null;
    }>>;
    getConnectUrl(user: ActiveUser, provider: string): {
        provider: string;
        url: string;
    };
    callback(provider: string, code?: string, state?: string): Promise<{
        url: string;
    }>;
    importContacts(user: ActiveUser, provider: string): Promise<{
        provider: string;
        total: number;
        created: number;
        updated: number;
        skipped: number;
    }>;
    disconnect(user: ActiveUser, provider: string): Promise<{
        provider: string;
        status: string;
        portal_id: string | null;
        external_account_name: string | null;
        scopes: string[];
        token_expires_at: Date | null;
        last_sync_at: Date | null;
        last_error: string | null;
    }>;
    syncContact(user: ActiveUser, provider: string, dto: SyncContactDto): Promise<import("./providers/crm-provider.interface").CrmContactUpsertResult>;
}
