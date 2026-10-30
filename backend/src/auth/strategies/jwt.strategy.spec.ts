import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * The per-request half of the single-session limit: a user access token whose
 * session has been revoked (because the same user signed in elsewhere) must be
 * rejected on the next request, not honoured until it expires. Tokens without a
 * sessionId (client-portal, guard) must skip the check entirely.
 */
describe('JwtStrategy session enforcement', () => {
  let prisma: {
    userSession: { findUnique: jest.Mock };
    guard: { findUnique: jest.Mock };
  };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = {
      userSession: { findUnique: jest.fn() },
      guard: { findUnique: jest.fn() },
    };
    const config = {
      get: jest.fn().mockReturnValue('access-secret'),
    } as unknown as ConfigService;
    strategy = new JwtStrategy(config, prisma as unknown as PrismaService);
  });

  const userPayload = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    role: 'admin',
    sessionId: 'session-1',
  };

  it('accepts a token whose session is still active', async () => {
    prisma.userSession.findUnique.mockResolvedValue({ status: 'active' });

    const result = await strategy.validate(userPayload);

    expect(result.sub).toBe('user-1');
    expect(result.sessionId).toBe('session-1');
  });

  it('rejects a token whose session has been revoked', async () => {
    prisma.userSession.findUnique.mockResolvedValue({ status: 'revoked' });

    await expect(strategy.validate(userPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token whose session no longer exists', async () => {
    prisma.userSession.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(userPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('skips the session check for tokens without a sessionId (client/guard)', async () => {
    const result = await strategy.validate({
      sub: 'client-1',
      tenantId: 'tenant-1',
      role: 'client',
      clientId: 'client-1',
    });

    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
    expect(result.sub).toBe('client-1');
  });
});
