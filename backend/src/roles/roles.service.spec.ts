import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SERVICE_MODULES } from '../entitlements/entitlements.constants';
import { ALL_PERMISSION_KEYS } from './rbac.constants';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('RolesService', () => {
  let service: RolesService;
  let emailService: { sendTeamMemberWelcomeEmail: jest.Mock };
  let prisma: {
    permission: { findMany: jest.Mock; upsert: jest.Mock };
    role: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    rolePermission: { deleteMany: jest.Mock; createMany: jest.Mock };
    $queryRaw: jest.Mock;
    user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    tenant: { findUnique: jest.Mock };
    userRoleAssignment: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      permission: {
        findMany: jest.fn().mockResolvedValue(
          ALL_PERMISSION_KEYS.map((key) => ({
            key,
            name: key,
            description: key,
            module: 'module',
          })),
        ),
        upsert: jest.fn().mockResolvedValue({}),
      },
      role: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        // No retired roles lingering by default; migrateRemovedRoles then
        // finds nothing to do.
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ module_welcomes_seen: [] }]),
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      // No owner by default: tests that care about owner protection set it.
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ ownerUserId: null }),
      },
      userRoleAssignment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    emailService = {
      sendTeamMemberWelcomeEmail: jest.fn().mockResolvedValue({ sent: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          // Fully entitled tenant: these tests assert RBAC behaviour, so
          // entitlement must not filter anything out from under them.
          provide: EntitlementsService,
          useValue: {
            modulesForTenant: jest
              .fn()
              .mockResolvedValue(new Set(SERVICE_MODULES)),
            summaryForTenant: jest.fn().mockResolvedValue({
              status: 'ACTIVE',
              modules: SERVICE_MODULES.map((key) => ({ key, active: true })),
            }),
          },
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('resyncs an existing system role whose stored permissions are missing newer keys', async () => {
    // Simulate a "Branch Admin" role created before newer permissions
    // (e.g. leads.view, deals.view) were added to rbac.constants.ts.
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'tenant-1:role:branch-admin',
        name: 'Branch Admin',
        description: 'Branch-scoped administration for operations teams.',
        permissions: [
          { permission: { key: 'dashboard.view' } },
          { permission: { key: 'invoices.view' } },
        ],
      },
    ]);
    prisma.role.upsert.mockImplementation(({ create, update }) =>
      Promise.resolve({
        id: 'tenant-1:role:branch-admin',
        ...update,
        ...create,
      }),
    );

    await service.ensureTenantSystemRoles('tenant-1');

    // The stale role must have been upserted and had its permission set
    // resynced against the full rbac.constants.ts definition.
    expect(prisma.role.upsert).toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).toHaveBeenCalled();
    const createManyCalls = prisma.rolePermission.createMany.mock.calls;
    const syncedForBranchAdmin = createManyCalls.some(
      (call) => call[0].data.length > 2,
    );
    expect(syncedForBranchAdmin).toBe(true);
  });

  it('getUserAccessProfile resyncs system roles even when the user already has an active role assignment', async () => {
    const roleRecord = {
      id: 'tenant-1:role:branch-admin',
      name: 'Branch Admin',
      description: 'Branch-scoped administration for operations teams.',
      isSystemRole: true,
      isActive: true,
      permissions: [{ permission: { key: 'dashboard.view' } }],
    };

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@tenant.test',
      name: 'Admin',
      tenantId: 'tenant-1',
      branchId: null,
      role: 'ADMIN',
      isSuperAdmin: false,
      branch: null,
      tenant: { id: 'tenant-1', name: 'Tenant One' },
      roleAssignments: [
        {
          id: 'assignment-1',
          role: roleRecord,
          branchId: null,
          branch: null,
        },
      ],
    });
    prisma.userRoleAssignment.findMany.mockResolvedValue([
      { role: roleRecord },
    ]);

    const ensureSpy = jest.spyOn(service, 'ensureTenantSystemRoles');
    // Prevent the real DB-backed sync logic from running in this test —
    // we only care that it gets *invoked* for an existing assignment.
    ensureSpy.mockResolvedValue(undefined);

    await service.getUserAccessProfile('user-1');

    expect(ensureSpy).toHaveBeenCalledWith('tenant-1');
    // Must be called unconditionally, not only via ensureDefaultAssignmentForUser
    // (which bails out early because the user already has an assignment).
    expect(ensureSpy).toHaveBeenCalledTimes(2); // once directly, once via getUserPermissionKeys
  });

  /**
   * Adding a team member is the only way a second person joins an existing
   * tenant, so the checks around it are the whole security story: it must not
   * become a way to mint a Super Admin, to reach into another tenant, or to
   * hand out permissions the creator does not hold.
   */
  describe('createTenantUser', () => {
    const owner = {
      sub: 'owner-1',
      email: 'owner@tenant.test',
      tenantId: 'tenant-1',
      role: 'admin',
      branchId: null,
      isSuperAdmin: true,
    } as Parameters<RolesService['createTenantUser']>[0];

    const dto = {
      email: 'New.Person@Tenant.test',
      name: '  Jordan Blake  ',
      password: 'a-long-enough-password',
      role_id: 'role-supervisor',
      branch_id: null,
    };

    const supervisorRole = {
      id: 'role-supervisor',
      name: 'Supervisor',
      tenantId: 'tenant-1',
      isActive: true,
      permissions: [{ permission: { key: 'incidents.view' } }],
    };

    beforeEach(() => {
      jest
        .spyOn(service, 'ensureTenantSystemRoles')
        .mockResolvedValue(undefined);
      prisma.role.findFirst = jest.fn().mockResolvedValue(supervisorRole);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-new',
              email: 'new.person@tenant.test',
              name: 'Jordan Blake',
              branchId: null,
            }),
          },
          userRoleAssignment: {
            create: jest.fn().mockResolvedValue({ id: 'assignment-new' }),
          },
        }),
      );
    });

    it('creates the user with a hashed password and never returns it', async () => {
      let written: Record<string, unknown> = {};
      prisma.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: {
            create: jest
              .fn()
              .mockImplementation((args: { data: Record<string, unknown> }) => {
                written = args.data;
                return {
                  id: 'user-new',
                  email: written.email,
                  name: written.name,
                  branchId: null,
                };
              }),
          },
          userRoleAssignment: {
            create: jest.fn().mockResolvedValue({ id: 'assignment-new' }),
          },
        }),
      );

      const result = await service.createTenantUser(owner, dto);

      // Normalised, so the login they are given matches the row that was
      // written whatever case the admin typed.
      expect(written.email).toBe('new.person@tenant.test');
      expect(written.name).toBe('Jordan Blake');
      expect(written.tenantId).toBe('tenant-1');
      expect(written.isSuperAdmin).toBe(false);
      // Verified without an OTP: an admin typed the address and is handing
      // over the password, so there is no ownership left to prove.
      expect(written.emailVerified).toBe(true);
      expect(written.password).not.toBe(dto.password);
      expect(String(written.password)).toMatch(/^\$2[aby]\$/);

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('new.person@tenant.test');
      expect(result.role).toBe('Supervisor');
    });

    it('emails the new member that their account exists', async () => {
      await service.createTenantUser(owner, dto);

      expect(emailService.sendTeamMemberWelcomeEmail).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          email: 'new.person@tenant.test',
          roleName: 'Supervisor',
        }),
      );
    });

    /**
     * The password must never leave by email.
     *
     * The admin chose it and hands it over themselves; an emailed credential
     * sits in an inbox forever. This is the same reason the response does not
     * echo it back, and it is worth a test of its own because the invite email
     * is exactly where someone would later be tempted to "help" by including
     * it.
     */
    it('never puts the password in the welcome email', async () => {
      await service.createTenantUser(owner, dto);

      const [, params] =
        emailService.sendTeamMemberWelcomeEmail.mock.calls[0] ?? [];
      expect(JSON.stringify(params ?? {})).not.toContain(dto.password);
    });

    // The user row is already committed by this point, so a mail failure must
    // not surface as an error on a request that succeeded -- the admin would
    // retry and hit "that email is already in use".
    it('still succeeds when the welcome email fails', async () => {
      emailService.sendTeamMemberWelcomeEmail.mockRejectedValue(
        new Error('smtp down'),
      );

      await expect(service.createTenantUser(owner, dto)).resolves.toMatchObject(
        { email: 'new.person@tenant.test' },
      );
    });

    it('refuses an email that already belongs to an account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'someone-else' });

      await expect(service.createTenantUser(owner, dto)).rejects.toThrow(
        /already in use/i,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a role from another tenant', async () => {
      // findFirst is scoped by tenantId, so another tenant's role simply is
      // not found -- asserted here so that scoping cannot be dropped quietly.
      prisma.role.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.createTenantUser(owner, dto)).rejects.toThrow(
        /Role not found/,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to create a portal (Client or Guard) login', async () => {
      prisma.role.findFirst = jest
        .fn()
        .mockResolvedValue({ ...supervisorRole, name: 'Guard' });

      await expect(service.createTenantUser(owner, dto)).rejects.toThrow(
        /portal roles cannot be assigned/i,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to grant Super Admin unless the creator is one', async () => {
      prisma.role.findFirst = jest
        .fn()
        .mockResolvedValue({ ...supervisorRole, name: 'Super Admin' });

      // A non-super-admin actor holding exactly the two permissions this
      // endpoint requires. The point is that holding them is still not enough
      // to mint a Super Admin -- otherwise anyone allowed to add a colleague
      // could promote themselves by adding one.
      prisma.userRoleAssignment.findMany.mockResolvedValue([
        {
          role: {
            permissions: [
              { permission: { key: 'users.manage' } },
              { permission: { key: 'users.assign_roles' } },
            ],
          },
        },
      ]);

      await expect(
        service.createTenantUser({ ...owner, isSuperAdmin: false }, dto),
      ).rejects.toThrow(/Only super admins/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  /**
   * The founding user is the owner and must stay a Super Admin. Demoting or
   * un-assigning them is what locked an account out of its own administration,
   * so both paths refuse it outright -- not merely hide the button.
   */
  describe('owner protection', () => {
    const actor = {
      sub: 'admin-1',
      email: 'admin@tenant.test',
      tenantId: 'tenant-1',
      role: 'admin',
      branchId: null,
      isSuperAdmin: true,
    } as ActiveUser;

    beforeEach(() => {
      jest
        .spyOn(service, 'ensureTenantSystemRoles')
        .mockResolvedValue(undefined);
      prisma.tenant.findUnique.mockResolvedValue({ ownerUserId: 'owner-1' });
    });

    it('refuses to assign the owner any role other than Super Admin', async () => {
      prisma.user.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 'owner-1', tenantId: 'tenant-1' });
      prisma.role.findFirst.mockResolvedValue({
        id: 'role-finance',
        name: 'Finance',
        tenantId: 'tenant-1',
        isActive: true,
        permissions: [{ permission: { key: 'finance.view' } }],
      });

      await expect(
        service.assignRole(actor, {
          user_id: 'owner-1',
          role_id: 'role-finance',
        }),
      ).rejects.toThrow(/owner must stay a Super Admin/i);
    });

    it('still lets the owner be (re)assigned Super Admin', async () => {
      prisma.user.findFirst = jest
        .fn()
        .mockResolvedValue({ id: 'owner-1', tenantId: 'tenant-1' });
      prisma.role.findFirst.mockResolvedValue({
        id: 'role-sa',
        name: 'Super Admin',
        tenantId: 'tenant-1',
        isActive: true,
        permissions: [],
      });
      prisma.userRoleAssignment.findFirst.mockResolvedValue(null);
      prisma.userRoleAssignment.create.mockResolvedValue({ id: 'a-1' });
      (prisma as unknown as { user: { update: jest.Mock } }).user.update = jest
        .fn()
        .mockResolvedValue({});

      await expect(
        service.assignRole(actor, { user_id: 'owner-1', role_id: 'role-sa' }),
      ).resolves.toBeDefined();
    });

    it("refuses to revoke the owner's Super Admin role", async () => {
      prisma.userRoleAssignment.findFirst.mockResolvedValue({
        id: 'assign-1',
        userId: 'owner-1',
        branchId: null,
        role: { name: 'Super Admin' },
      });

      await expect(service.revokeAssignment(actor, 'assign-1')).rejects.toThrow(
        /owner’s Super Admin role cannot be removed/i,
      );
    });
  });

  /**
   * The one-time module welcome, held per user so "once" survives a new
   * browser or a second device. It used to live in localStorage, which made
   * "once" mean "once per browser".
   */
  describe('markModuleWelcomeSeen', () => {
    const caller = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
    } as ActiveUser;

    it('returns the stored list the database reports back', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { module_welcomes_seen: ['LEAD_GEN'] },
      ]);

      await expect(
        service.markModuleWelcomeSeen(caller, 'LEAD_GEN'),
      ).resolves.toEqual({ moduleWelcomesSeen: ['LEAD_GEN'] });
    });

    /**
     * Appending happens in one SQL statement whose new value is computed from
     * the stored one, not by reading the array into JS and writing it back.
     * Two tabs marking two different services would clobber each other under
     * read-then-write; here the second statement sees the first one's result.
     */
    it('appends in a single statement rather than read-then-write', async () => {
      await service.markModuleWelcomeSeen(caller, 'GUARD_TOUR');

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // Marking the same service twice must not duplicate the entry, so the
    // statement guards with ANY(...) before appending.
    it('guards against appending a service already present', async () => {
      await service.markModuleWelcomeSeen(caller, 'FINANCE');

      // A tagged template hands the literal chunks in as the first argument.
      const [query] = prisma.$queryRaw.mock.calls[0] as [string[]];
      expect(query.join('')).toMatch(/ANY\("module_welcomes_seen"\)/);
      expect(query.join('')).toMatch(/array_append/);
    });

    // Scoped to the caller's own row. There is no parameter that could point
    // this at another user.
    it('writes only to the calling user by id', async () => {
      await service.markModuleWelcomeSeen(caller, 'LEAD_GEN');

      const [query, ...values] = prisma.$queryRaw.mock.calls[0] as [
        string[],
        ...unknown[],
      ];
      expect(query.join('')).toMatch(/WHERE "id" =/);
      // The id arrives as a bound parameter, not interpolated into the SQL.
      expect(values).toContain('user-1');
    });

    // A row that does not come back (deleted mid-request) must answer with an
    // empty list rather than undefined, which the client would spread.
    it('answers with an empty list when no row comes back', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.markModuleWelcomeSeen(caller, 'LEAD_GEN'),
      ).resolves.toEqual({ moduleWelcomesSeen: [] });
    });
  });
});
