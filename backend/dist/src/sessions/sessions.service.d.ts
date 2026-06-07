import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
export declare class SessionsService {
    private readonly prisma;
    private readonly auditService;
    private readonly configService;
    constructor(prisma: PrismaService, auditService: AuditService, configService: ConfigService);
    generateSessionId(): `${string}-${string}-${string}-${string}-${string}`;
    createSession(data: {
        id: string;
        tenantId: string;
        userId: string;
        refreshToken: string;
        source: 'password' | 'sso';
        providerId?: string | null;
        ipAddress?: string | null;
        userAgent?: string | null;
    }): Promise<{
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
    validateRefreshSession(sessionId: string, refreshToken: string): Promise<{
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
    rotateRefreshToken(sessionId: string, refreshToken: string): Promise<void>;
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
    revoke(user: ActiveUser, sessionId: string): Promise<{
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
    revokeById(tenantId: string, sessionId: string, action?: string): Promise<{
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
    private absoluteExpiry;
    private idleTimeoutMs;
}
