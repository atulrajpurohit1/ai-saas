import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuardAuthService } from './guard-auth.service';

describe('GuardAuthService with deactivated guards', () => {
  let service: GuardAuthService;
  let prisma: {
    guard: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('correct-horse', 4);
  });

  beforeEach(() => {
    prisma = {
      guard: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new GuardAuthService(
      prisma as unknown as PrismaService,
      {
        signAsync: jest.fn().mockResolvedValue('token'),
      } as unknown as JwtService,
      { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService,
      { log: jest.fn() } as unknown as AuditService,
    );
  });

  const guard = (overrides: Record<string, unknown> = {}) => ({
    id: 'guard-1',
    tenantId: 'tenant-1',
    name: 'Ramesh',
    email: 'ramesh@example.com',
    phone: null,
    passwordHash,
    refreshToken: null,
    deactivatedAt: null,
    tenant: { name: 'Acme Security' },
    ...overrides,
  });

  it('refuses sign-in for a deactivated guard with the right password', async () => {
    prisma.guard.findMany.mockResolvedValue([
      guard({ deactivatedAt: new Date() }),
    ]);

    await expect(
      service.login({
        identifier: 'ramesh@example.com',
        password: 'correct-horse',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.guard.update).not.toHaveBeenCalled();
  });

  it('still says "Invalid credentials" for a wrong password', async () => {
    prisma.guard.findMany.mockResolvedValue([
      guard({ deactivatedAt: new Date() }),
    ]);

    await expect(
      service.login({ identifier: 'ramesh@example.com', password: 'nope' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('refuses to refresh tokens for a deactivated guard', async () => {
    prisma.guard.findUnique.mockResolvedValue(
      guard({ refreshToken: 'hash', deactivatedAt: new Date() }),
    );

    await expect(service.refreshTokens('guard-1', 'rt')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
