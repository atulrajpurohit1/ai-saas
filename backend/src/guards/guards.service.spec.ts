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
    assignment: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
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
      assignment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      // Runs the callback against the same mocks, so a test sees the writes
      // the real transaction would have made.
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
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

  // The bug this covers: deactivation stamped the guard but left their
  // existing Assignment rows alone, so next week's shifts still showed them as
  // staffing a site they could no longer sign in to work.
  it('releases the shifts the guard was rostered onto that have not started', async () => {
    prisma.assignment.deleteMany.mockResolvedValue({ count: 2 });

    await service.deactivate(user, 'guard-1');

    expect(prisma.assignment.deleteMany).toHaveBeenCalledTimes(1);
    const { where } = prisma.assignment.deleteMany.mock.calls[0][0];
    expect(where.guardId).toBe('guard-1');
    // Only future shifts, and only this tenant's.
    expect(where.shift.tenantId).toBe('tenant-1');
    expect(where.shift.startTime.gt).toBeInstanceOf(Date);
  });

  it('keeps assignments on shifts that already started, as a record of work', async () => {
    await service.deactivate(user, 'guard-1');

    const { where } = prisma.assignment.deleteMany.mock.calls[0][0];
    // `gt` on startTime is what spares a past or in-progress shift; a filter
    // without it would delete the timesheet's own basis.
    expect(Object.keys(where.shift.startTime)).toEqual(['gt']);
  });

  it('moves the flag and the roster in one transaction', async () => {
    await service.deactivate(user, 'guard-1');

    // A guard marked as left who still holds shifts is the exact
    // inconsistency being fixed, so these two writes must not be separable.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('records the released shift count in the audit trail', async () => {
    prisma.assignment.deleteMany.mockResolvedValue({ count: 3 });

    await service.deactivate(user, 'guard-1');

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GUARD_DEACTIVATED',
        details: expect.stringContaining('3 upcoming shifts'),
      }),
    );
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
