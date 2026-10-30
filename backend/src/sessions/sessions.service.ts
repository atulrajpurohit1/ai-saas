import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BCRYPT_TOKEN_ROUNDS } from '../auth/password-policy';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_IDLE_TIMEOUT_MINUTES = 480;
const DEFAULT_SESSION_DAYS = 30;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  generateSessionId() {
    return randomUUID();
  }

  async createSession(data: {
    id: string;
    tenantId: string;
    userId: string;
    refreshToken: string;
    source: 'password';
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const refreshTokenHash = await bcrypt.hash(
      data.refreshToken,
      BCRYPT_TOKEN_ROUNDS,
    );
    const session = await this.prisma.userSession.create({
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

    // One active session per user: the newest login wins. Any other active
    // session for this user is revoked, so a shared credential cannot stay
    // signed in on a second device -- that device's next request (and its
    // refresh) is rejected once its session is no longer active.
    await this.revokeOtherActiveSessions(data.userId, session.id, data.tenantId);

    return session;
  }

  /**
   * Revokes every OTHER active session belonging to a user, keeping only the
   * one just created. This is what enforces the single-active-session limit;
   * it is deliberately per user (not per tenant), since a company has many
   * users who are each allowed their own one session.
   */
  private async revokeOtherActiveSessions(
    userId: string,
    keepSessionId: string,
    tenantId: string,
  ) {
    const { count } = await this.prisma.userSession.updateMany({
      where: { userId, status: 'active', id: { not: keepSessionId } },
      data: {
        status: 'revoked',
        refreshTokenHash: null,
        revokedAt: new Date(),
      },
    });

    if (count > 0) {
      await this.auditService.log({
        tenantId,
        userId,
        action: 'SESSION_SUPERSEDED',
        entityType: 'UserSession',
        entityId: keepSessionId,
        details: `Signed out ${count} other active session(s) on a new login (one active session per user).`,
      });
    }
  }

  async validateRefreshSession(sessionId: string, refreshToken: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'active' || !session.refreshTokenHash) {
      throw new ForbiddenException('Session is no longer active');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revokeById(session.tenantId, session.id, 'SESSION_EXPIRED');
      throw new ForbiddenException('Session expired');
    }

    if (session.lastSeenAt.getTime() + this.idleTimeoutMs() <= Date.now()) {
      await this.revokeById(
        session.tenantId,
        session.id,
        'SESSION_IDLE_TIMEOUT',
      );
      throw new ForbiddenException('Session idle timeout');
    }

    const matches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!matches) {
      throw new ForbiddenException('Access Denied');
    }

    return session;
  }

  async rotateRefreshToken(sessionId: string, refreshToken: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, BCRYPT_TOKEN_ROUNDS),
        lastSeenAt: new Date(),
      },
    });
  }

  async list(user: ActiveUser) {
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

  async revoke(user: ActiveUser, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, tenantId: user.tenantId },
      include: { user: { select: { email: true } } },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const revoked = await this.revokeById(
      user.tenantId,
      session.id,
      'SESSION_FORCED_LOGOUT',
    );

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

  async revokeById(
    tenantId: string,
    sessionId: string,
    action = 'SESSION_REVOKED',
  ) {
    return this.prisma.userSession
      .update({
        where: { id: sessionId },
        data: {
          status: 'revoked',
          refreshTokenHash: null,
          revokedAt: new Date(),
        },
      })
      .then(async (session) => {
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

  private absoluteExpiry() {
    const days = Number(
      this.configService.get<string>('SESSION_ABSOLUTE_DAYS') ||
        DEFAULT_SESSION_DAYS,
    );
    return new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000);
  }

  private idleTimeoutMs() {
    const minutes = Number(
      this.configService.get<string>('SESSION_IDLE_TIMEOUT_MINUTES') ||
        DEFAULT_IDLE_TIMEOUT_MINUTES,
    );
    return Math.max(5, minutes) * 60 * 1000;
  }
}
