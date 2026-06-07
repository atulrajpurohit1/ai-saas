import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SessionsService } from './sessions.service';
export declare class SessionsController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    list(user: ActiveUser): Promise<{
        id: string;
        tenant_id: string;
        user_id: string;
        user: {
            id: string;
            name: string | null;
            email: string;
            branchId: string | null;
        };
        provider: {
            id: string;
            providerType: string;
            providerName: string;
        } | null;
        source: string;
        status: string;
        ip_address: string | null;
        user_agent: string | null;
        last_seen_at: Date;
        expires_at: Date;
        created_at: Date;
        revoked_at: Date | null;
    }[]>;
    revoke(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string;
        status: string;
        revokedAt: Date | null;
        source: string;
        refreshTokenHash: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        lastSeenAt: Date;
        expiresAt: Date;
        providerId: string | null;
    }>;
}
