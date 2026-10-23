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
      delete: jest.Mock;
    };
    assignment: { count: jest.Mock };
    timesheet: { count: jest.Mock };
    invoiceItem: { count: jest.Mock };
    incident: { count: jest.Mock };
    attendanceEvent: { count: jest.Mock };
    patrolRun: { count: jest.Mock };
    patrolEvent: { count: jest.Mock };
    emergencyAlert: { count: jest.Mock };
  };
  let audit: { log: jest.Mock };

  // By default a clean guard with no history, so remove() is allowed.
  const noHistory = () => ({
    assignment: { count: jest.fn().mockResolvedValue(0) },
    timesheet: { count: jest.fn().mockResolvedValue(0) },
    invoiceItem: { count: jest.fn().mockResolvedValue(0) },
    incident: { count: jest.fn().mockResolvedValue(0) },
    attendanceEvent: { count: jest.fn().mockResolvedValue(0) },
    patrolRun: { count: jest.fn().mockResolvedValue(0) },
    patrolEvent: { count: jest.fn().mockResolvedValue(0) },
    emergencyAlert: { count: jest.fn().mockResolvedValue(0) },
  });

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
        delete: jest.fn().mockResolvedValue(guard()),
      },
      ...noHistory(),
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

  describe('remove', () => {
    it('deletes a guard that has no activity history', async () => {
      const result = await service.remove(user, 'guard-1');

      expect(prisma.guard.delete).toHaveBeenCalledWith({
        where: { id: 'guard-1' },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GUARD_DELETED' }),
      );
      expect(result).toEqual({ id: 'guard-1', deleted: true });
    });

    it('refuses to delete a guard with history, so records never cascade away', async () => {
      // One timesheet is enough -- deleting would cascade it (and any invoice
      // line built from it) out of existence.
      prisma.timesheet.count.mockResolvedValue(1);

      await expect(service.remove(user, 'guard-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.guard.delete).not.toHaveBeenCalled();
    });

    it('only deletes guards in the caller tenant', async () => {
      prisma.guard.findFirst.mockResolvedValue(null);

      await expect(service.remove(user, 'guard-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.guard.delete).not.toHaveBeenCalled();
    });
  });
});
