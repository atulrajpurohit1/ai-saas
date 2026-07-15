"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_IDLE_TIMEOUT_MINUTES = 480;
const DEFAULT_SESSION_DAYS = 30;
let SessionsService = class SessionsService {
    prisma;
    auditService;
    configService;
    constructor(prisma, auditService, configService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.configService = configService;
    }
    generateSessionId() {
        return (0, crypto_1.randomUUID)();
    }
    async createSession(data) {
        const refreshTokenHash = await bcrypt.hash(data.refreshToken, 10);
        return this.prisma.userSession.create({
            data: {
                id: data.id,
                tenantId: data.tenantId,
                userId: data.userId,
                source: data.source,
                refreshTokenHash,
                status: 'active',
                ipAddress: data.ipAddress || null,
                userAgent: data.userAgent || null,
                lastSeenAt: new Date(),
                expiresAt: this.absoluteExpiry(),
            },
        });
    }
    async validateRefreshSession(sessionId, refreshToken) {
        const session = await this.prisma.userSession.findUnique({
            where: { id: sessionId },
        });
        if (!session || session.status !== 'active' || !session.refreshTokenHash) {
            throw new common_1.ForbiddenException('Session is no longer active');
        }
        if (session.expiresAt.getTime() <= Date.now()) {
            await this.revokeById(session.tenantId, session.id, 'SESSION_EXPIRED');
            throw new common_1.ForbiddenException('Session expired');
        }
        if (session.lastSeenAt.getTime() + this.idleTimeoutMs() <= Date.now()) {
            await this.revokeById(session.tenantId, session.id, 'SESSION_IDLE_TIMEOUT');
            throw new common_1.ForbiddenException('Session idle timeout');
        }
        const matches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (!matches) {
            throw new common_1.ForbiddenException('Access Denied');
        }
        return session;
    }
    async rotateRefreshToken(sessionId, refreshToken) {
        await this.prisma.userSession.update({
            where: { id: sessionId },
            data: {
                refreshTokenHash: await bcrypt.hash(refreshToken, 10),
                lastSeenAt: new Date(),
            },
        });
    }
    async list(user) {
        const sessions = await this.prisma.userSession.findMany({
            where: { tenantId: user.tenantId },
            include: {
                user: { select: { id: true, email: true, name: true, branchId: true } },
            },
            orderBy: { lastSeenAt: 'desc' },
            take: 200,
        });
        return sessions.map((session) => ({
            id: session.id,
            tenant_id: session.tenantId,
            user_id: session.userId,
            user: session.user,
            source: session.source,
            status: session.status,
            ip_address: session.ipAddress,
            user_agent: session.userAgent,
            last_seen_at: session.lastSeenAt,
            expires_at: session.expiresAt,
            created_at: session.createdAt,
            revoked_at: session.revokedAt,
        }));
    }
    async revoke(user, sessionId) {
        const session = await this.prisma.userSession.findFirst({
            where: { id: sessionId, tenantId: user.tenantId },
            include: { user: { select: { email: true } } },
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found');
        }
        const revoked = await this.revokeById(user.tenantId, session.id, 'SESSION_FORCED_LOGOUT');
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'SESSION_FORCED_LOGOUT',
            entityType: 'UserSession',
            entityId: session.id,
            details: `Forced logout for ${session.user.email}`,
        });
        return revoked;
    }
    async revokeById(tenantId, sessionId, action = 'SESSION_REVOKED') {
        return this.prisma.userSession.update({
            where: { id: sessionId },
            data: {
                status: 'revoked',
                refreshTokenHash: null,
                revokedAt: new Date(),
            },
        }).then(async (session) => {
            await this.auditService.log({
                tenantId,
                userId: session.userId,
                action,
                entityType: 'UserSession',
                entityId: session.id,
                details: `Session ${session.id} revoked`,
            });
            return session;
        });
    }
    absoluteExpiry() {
        const days = Number(this.configService.get('SESSION_ABSOLUTE_DAYS') || DEFAULT_SESSION_DAYS);
        return new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000);
    }
    idleTimeoutMs() {
        const minutes = Number(this.configService.get('SESSION_IDLE_TIMEOUT_MINUTES') || DEFAULT_IDLE_TIMEOUT_MINUTES);
        return Math.max(5, minutes) * 60 * 1000;
    }
};
exports.SessionsService = SessionsService;
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        config_1.ConfigService])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map