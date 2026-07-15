import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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
      await this.revokeById(session.tenantId, session.id, 'SESSION_IDLE_TIMEOUT');
      throw new ForbiddenException('Session idle timeout');
    }

    const matches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!matches) {
      throw new ForbiddenException('Access Denied');
    }

    return session;
  }

  async rotateRefreshToken(sessionId: string, refreshToken: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, 10),
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

  async revokeById(tenantId: string, sessionId: string, action = 'SESSION_REVOKED') {
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

  private absoluteExpiry() {
    const days = Number(this.configService.get<string>('SESSION_ABSOLUTE_DAYS') || DEFAULT_SESSION_DAYS);
    return new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000);
  }

  private idleTimeoutMs() {
    const minutes = Number(this.configService.get<string>('SESSION_IDLE_TIMEOUT_MINUTES') || DEFAULT_IDLE_TIMEOUT_MINUTES);
    return Math.max(5, minutes) * 60 * 1000;
  }
}
