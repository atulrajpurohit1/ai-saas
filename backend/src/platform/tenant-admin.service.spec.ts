import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { EmailService } from '../email/email.service';
import { TenantAdminService } from './tenant-admin.service';

/**
 * Tenant lifecycle, driven by a platform admin.
 *
 * Two properties matter most here and neither is cosmetic: an owner created
 * this way gets rights over their OWN tenant and nothing more (the flag that
 * used to leak platform access), and a permanent delete cannot happen without
 * the caller echoing the tenant's exact name -- checked in the service, so a
 * direct API call cannot skip the confirmation the UI shows.
 */
/** A Prisma `create`/`update` argument, as these assertions read it back. */
type WriteArg = { data: Record<string, unknown> };
type UpdateArg = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

describe('TenantAdminService', () => {
  let service: TenantAdminService;
  // The write mocks carry their argument types so reading `.mock.calls` back
  // stays typed. These tests assert on exact payloads -- that the password was
  // hashed, that the owner's rights are tenant-scoped -- so an `any` here
  // would quietly stop checking the thing they exist to check.
  let prisma: {
    tenant: {
      findUnique: jest.Mock;
      create: jest.Mock<Promise<unknown>, [WriteArg]>;
      update: jest.Mock<Promise<unknown>, [UpdateArg]>;
      delete: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
      create: jest.Mock<Promise<unknown>, [WriteArg]>;
      updateMany: jest.Mock;
    };
    userSession: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let roles: {
    ensureTenantSystemRoles: jest.Mock;
    ensureDefaultAssignmentForUser: jest.Mock;
  };

  const validInput = {
    name: 'Northwind Security',
    ownerEmail: 'Owner@Northwind.COM',
    ownerName: 'Pat Owner',
    ownerPassword: 'a-strong-owner-password',
  };

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn<Promise<unknown>, [WriteArg]>()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'tenant-1', ...data }),
          ),
        update: jest.fn<Promise<unknown>, [UpdateArg]>().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn<Promise<unknown>, [WriteArg]>()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'user-1', ...data }),
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      // The service uses both forms: a callback for createTenant's atomic
      // tenant+owner insert, and an array for suspendTenant's three writes.
      // Running the callback inline against this same mock object is what lets
      // the assertions read `prisma.user.create` back.
      $transaction: jest.fn(
        (arg: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
          typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };
    roles = {
      ensureTenantSystemRoles: jest.fn().mockResolvedValue(undefined),
      ensureDefaultAssignmentForUser: jest.fn().mockResolvedValue(undefined),
    };

    const email = {
      sendNewSignupNotification: jest.fn().mockResolvedValue({ sent: true }),
    };

    service = new TenantAdminService(
      prisma as unknown as PrismaService,
      roles as unknown as RolesService,
      email as unknown as EmailService,
    );
  });

  describe('createTenant', () => {
    it('creates the tenant and its owner, and seeds the tenant roles', async () => {
      const result = await service.createTenant(validInput, 'admin-1');

      expect(result).toEqual({
        tenantId: 'tenant-1',
        name: 'Northwind Security',
        slug: 'northwind-security',
        ownerEmail: 'owner@northwind.com',
      });
      expect(roles.ensureTenantSystemRoles).toHaveBeenCalledWith('tenant-1');
      expect(roles.ensureDefaultAssignmentForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });

    /**
     * `isSuperAdmin` here means "owner of this tenant, sees every branch in
     * it" -- the tenant-scoped meaning it has everywhere in the app. It is NOT
     * platform authority: that lives in PlatformAdmin behind a separately
     * signed token, and no column on User grants it.
     */
    it('gives the owner tenant-scoped rights only', async () => {
      await service.createTenant(validInput, 'admin-1');

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.isSuperAdmin).toBe(true);
      expect(data.tenantId).toBe('tenant-1');
      // Nothing about the platform is set on the user row.
      expect(data).not.toHaveProperty('scope');
      expect(data).not.toHaveProperty('platformAdmin');
    });

    it('stores the owner password hashed', async () => {
      await service.createTenant(validInput, 'admin-1');

      const stored = prisma.user.create.mock.calls[0][0].data
        .password as string;
      expect(stored).not.toBe(validInput.ownerPassword);
      await expect(
        bcrypt.compare(validInput.ownerPassword, stored),
      ).resolves.toBe(true);
    });

    /**
     * A platform admin typing in a customer's details has verified them out of
     * band; mailing an OTP to an address nobody is watching would just strand
     * the account behind the login gate.
     */
    it('creates the owner already email-verified', async () => {
      await service.createTenant(validInput, 'admin-1');

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.emailVerified).toBe(true);
      expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('normalises the owner email', async () => {
      await service.createTenant(validInput, 'admin-1');

      expect(prisma.user.create.mock.calls[0][0].data.email).toBe(
        'owner@northwind.com',
      );
    });

    it('refuses an email that already belongs to a user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createTenant(validInput, 'admin-1')).rejects.toThrow(
        /already exists/,
      );
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    /**
     * Slugs are unique platform-wide, so two customers trading under the same
     * name must both be onboardable rather than the second one failing.
     */
    it('appends a counter when the slug is taken', async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce({ id: 'other' })
        .mockResolvedValue(null);

      const result = await service.createTenant(validInput, 'admin-1');

      expect(result.slug).toBe('northwind-security-2');
    });

    it('rejects a name with nothing sluggable in it', async () => {
      await expect(
        service.createTenant({ ...validInput, name: '!!!' }, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('suspendTenant', () => {
    it('deactivates the tenant and revokes its live sessions', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Northwind Security',
        isActive: true,
      });

      const result = await service.suspendTenant(
        'tenant-1',
        { reason: 'non-payment' },
        'admin-1',
      );

      expect(result).toEqual({ tenantId: 'tenant-1', isActive: false });

      const tenantUpdate = prisma.tenant.update.mock.calls[0][0];
      expect(tenantUpdate.data.isActive).toBe(false);
      expect(tenantUpdate.data.suspendedReason).toBe('non-payment');
      expect(tenantUpdate.data.suspendedAt).toBeInstanceOf(Date);

      // Suspension has to bite now, not when the current tokens expire.
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'active' },
        data: { status: 'revoked', revokedAt: expect.any(Date) },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: { refreshToken: null },
      });
    });

    it('404s on an unknown tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendTenant('nope', {}, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reactivateTenant', () => {
    it('clears the suspension', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Northwind Security',
      });

      const result = await service.reactivateTenant('tenant-1', 'admin-1');

      expect(result).toEqual({ tenantId: 'tenant-1', isActive: true });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { isActive: true, suspendedAt: null, suspendedReason: null },
      });
    });

    it('404s on an unknown tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.reactivateTenant('nope', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteTenant', () => {
    const existing = {
      id: 'tenant-1',
      name: 'Northwind Security',
      _count: { users: 4 },
    };

    it('deletes when the confirmation matches the tenant name', async () => {
      prisma.tenant.findUnique.mockResolvedValue(existing);

      const result = await service.deleteTenant(
        'tenant-1',
        { confirmName: 'Northwind Security' },
        'admin-1',
      );

      expect(result).toEqual({
        tenantId: 'tenant-1',
        deleted: true,
        name: 'Northwind Security',
      });
      expect(prisma.tenant.delete).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
    });

    /**
     * The confirmation is checked HERE, not only in the dialog: a dialog is
     * something a direct API call skips, and this delete cascades to every row
     * the tenant owns.
     */
    it('refuses, and deletes nothing, when the confirmation does not match', async () => {
      prisma.tenant.findUnique.mockResolvedValue(existing);

      await expect(
        service.deleteTenant(
          'tenant-1',
          { confirmName: 'northwind security' },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.tenant.delete).not.toHaveBeenCalled();
    });

    it('refuses an empty confirmation', async () => {
      prisma.tenant.findUnique.mockResolvedValue(existing);

      await expect(
        service.deleteTenant('tenant-1', { confirmName: '   ' }, 'admin-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.tenant.delete).not.toHaveBeenCalled();
    });

    it('tolerates surrounding whitespace in the confirmation', async () => {
      prisma.tenant.findUnique.mockResolvedValue(existing);

      await expect(
        service.deleteTenant(
          'tenant-1',
          { confirmName: '  Northwind Security  ' },
          'admin-1',
        ),
      ).resolves.toMatchObject({ deleted: true });
    });

    it('404s on an unknown tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTenant('nope', { confirmName: 'nope' }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
