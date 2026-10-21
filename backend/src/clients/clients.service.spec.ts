import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { FieldPermissionsService } from '../field-permissions/field-permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ClientsService } from './clients.service';

describe('ClientsService.createClientUser', () => {
  let service: ClientsService;
  let prisma: {
    client: { findFirst: jest.Mock };
    clientUser: { create: jest.Mock };
  };

  const admin = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    isSuperAdmin: true,
  } as ActiveUser;

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn() },
      clientUser: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'client-user-1', ...data }),
        ),
      },
    };

    service = new ClientsService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      { dispatch: jest.fn() } as unknown as WebhooksService,
      {} as unknown as FieldPermissionsService,
    );
  });

  /**
   * This is now the only way a client-portal account comes into existence, so
   * it has to produce one that can actually sign in. It used to leave
   * emailVerified at its false default while nothing in the product ever sent
   * a client an OTP, so the account it handed back -- temporary password and
   * all -- was refused by the login's verification gate forever.
   */
  it('creates an account that can sign in immediately', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      tenantId: 'tenant-1',
      users: [],
    });

    const result = await service.createClientUser(
      admin,
      'client-1',
      'contact@acme-client.com',
    );

    expect(prisma.clientUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'contact@acme-client.com',
        clientId: 'client-1',
        tenantId: 'tenant-1',
        emailVerified: true,
        emailVerifiedAt: expect.any(Date),
      }),
    });

    // The temporary password is returned for the admin to pass on, and is the
    // only copy: what is stored is a hash of it.
    expect(result.temporaryPassword).toBeTruthy();
    expect(prisma.clientUser.create.mock.calls[0][0].data.password).not.toBe(
      result.temporaryPassword,
    );
  });

  it('scopes the account to the admin’s own tenant', async () => {
    prisma.client.findFirst.mockResolvedValue(null);

    await expect(
      service.createClientUser(admin, 'client-from-another-tenant', 'x@y.com'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'client-from-another-tenant',
          tenantId: 'tenant-1',
        }),
      }),
    );
    expect(prisma.clientUser.create).not.toHaveBeenCalled();
  });

  it('refuses a second portal user for the same client', async () => {
    prisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      tenantId: 'tenant-1',
      users: [{ id: 'client-user-existing' }],
    });

    await expect(
      service.createClientUser(admin, 'client-1', 'second@acme-client.com'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
