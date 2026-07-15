import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
export declare class CrmConnectorsService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
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
    handleHubSpotCallback(code: string | undefined, state: string | undefined): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        refreshToken: string | null;
        tenantId: string;
        status: string;
        lastError: string | null;
        provider: string;
        accessToken: string;
        tokenExpiresAt: Date | null;
        scopes: string[];
        portalId: string | null;
        externalAccountName: string | null;
        lastSyncAt: Date | null;
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
    importHubSpotContacts(user: ActiveUser): Promise<{
        provider: string;
        total: number;
        created: number;
        updated: number;
        skipped: number;
    }>;
    private activeHubSpotConnection;
    private validAccessToken;
    private exchangeCode;
    private refreshToken;
    private recordSyncError;
    private serializeConnection;
    private isHubSpotConfigured;
    private assertHubSpotConfigured;
    private hubSpotClientId;
    private hubSpotClientSecret;
    private hubSpotRedirectUri;
    private frontendUrl;
    private signState;
    private verifyState;
    private encrypt;
    private decrypt;
    private encryptionKey;
    private secret;
    private scopeList;
    private clean;
    hubSpotResultUrl(success: boolean): string;
}
