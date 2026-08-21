import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';
import { ALL_PERMISSION_KEYS } from './rbac.constants';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: {
    permission: { findMany: jest.Mock; upsert: jest.Mock };
    role: { findMany: jest.Mock; upsert: jest.Mock };
    rolePermission: { deleteMany: jest.Mock; createMany: jest.Mock };
    user: { findUnique: jest.Mock };
    userRoleAssignment: { findMany: jest.Mock; create: jest.Mock };
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
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn() },
      userRoleAssignment: { findMany: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
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
      Promise.resolve({ id: 'tenant-1:role:branch-admin', ...update, ...create }),
    );

    await service.ensureTenantSystemRoles('tenant-1');

    // The stale role must have been upserted and had its permission set
    // resynced against the full rbac.constants.ts definition.
    expect(prisma.role.upsert).toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).toHaveBeenCalled();
    const createManyCalls = prisma.rolePermission.createMany.mock.calls;
    const syncedForBranchAdmin = createManyCalls.some((call) =>
      call[0].data.length > 2,
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
});
