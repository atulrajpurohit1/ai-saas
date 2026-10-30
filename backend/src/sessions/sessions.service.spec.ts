import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from './sessions.service';

/**
 * The behaviour that enforces login sharing limits: creating a session must
 * revoke every OTHER active session for the same user, so only the newest
 * login stays active (newest-wins, one active session per user).
 */
describe('SessionsService.createSession single-session limit', () => {
  let service: SessionsService;
  let prisma: {
    userSession: { create: jest.Mock; updateMany: jest.Mock };
  };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      userSession: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    service = new SessionsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
    );
  });

  it('revokes the user other active sessions, keeping only the new one', async () => {
    await service.createSession({
      id: 'session-new',
      tenantId: 'tenant-1',
      userId: 'user-1',
      refreshToken: 'rt',
      source: 'password',
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
    });

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'active', id: { not: 'session-new' } },
      data: expect.objectContaining({
        status: 'revoked',
        refreshTokenHash: null,
      }) as unknown,
    });
    // Scoped to the user, not the whole tenant: other users keep their sessions.
    const call = prisma.userSession.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where).not.toHaveProperty('tenantId');
  });

  it('records an audit entry when other sessions were superseded', async () => {
    await service.createSession({
      id: 'session-new',
      tenantId: 'tenant-1',
      userId: 'user-1',
      refreshToken: 'rt',
      source: 'password',
    });

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'SESSION_SUPERSEDED',
      }),
    );
  });

  it('does not audit when there were no other sessions to revoke', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    await service.createSession({
      id: 'session-new',
      tenantId: 'tenant-1',
      userId: 'user-1',
      refreshToken: 'rt',
      source: 'password',
    });

    expect(audit.log).not.toHaveBeenCalled();
  });
});
