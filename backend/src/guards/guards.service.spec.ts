import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { FieldPermissionsService } from '../field-permissions/field-permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { GuardsService } from './guards.service';

describe('GuardsService deactivation', () => {
  const user = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: 'admin',
    isSuperAdmin: true,
  } as ActiveUser;

  let service: GuardsService;
  type GuardUpdate = { data: Record<string, unknown> };
  let prisma: {
    guard: {
      findFirst: jest.Mock;
      update: jest.Mock<Promise<unknown>, [GuardUpdate]>;
    };
  };
  let audit: { log: jest.Mock };

  const guard = (overrides: Record<string, unknown> = {}) => ({
    id: 'guard-1',
    tenantId: 'tenant-1',
    name: 'Ramesh',
    passwordHash: 'pw-hash',
    refreshToken: 'rt-hash',
    deactivatedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      guard: {
        findFirst: jest.fn().mockResolvedValue(guard()),
        update: jest.fn(({ data }: GuardUpdate) =>
          Promise.resolve<unknown>({ ...guard(), ...data }),
        ),
      },
    };
    audit = { log: jest.fn() };
    service = new GuardsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      {} as WebhooksService,
      {
        filterFieldsByPermission: jest.fn(
          (_user: unknown, _entity: string, value: unknown) => value,
        ),
      } as unknown as FieldPermissionsService,
    );
  });

  it('stamps deactivatedAt and ends the portal session', async () => {
    const result = await service.deactivate(user, 'guard-1');

    const { data } = prisma.guard.update.mock.calls[0][0];
    expect(data.deactivatedAt).toBeInstanceOf(Date);
    expect(data.refreshToken).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GUARD_DEACTIVATED' }),
    );
    // Credential hashes never reach the response.
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('refuses to deactivate a guard twice', async () => {
    prisma.guard.findFirst.mockResolvedValue(
      guard({ deactivatedAt: new Date() }),
    );

    await expect(service.deactivate(user, 'guard-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.guard.update).not.toHaveBeenCalled();
  });

  it('reactivates a deactivated guard', async () => {
    prisma.guard.findFirst.mockResolvedValue(
      guard({ deactivatedAt: new Date() }),
    );

    await service.reactivate(user, 'guard-1');

    expect(prisma.guard.update).toHaveBeenCalledWith({
      where: { id: 'guard-1' },
      data: { deactivatedAt: null },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GUARD_REACTIVATED' }),
    );
  });

  it('refuses to reactivate a guard who is already active', async () => {
    await expect(service.reactivate(user, 'guard-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('only finds guards in the caller tenant', async () => {
    prisma.guard.findFirst.mockResolvedValue(null);

    await expect(service.deactivate(user, 'guard-x')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.guard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'guard-x', tenantId: 'tenant-1' }),
      }),
    );
  });
});
