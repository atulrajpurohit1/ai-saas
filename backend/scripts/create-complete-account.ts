/**
 * Creates one complete, ready-to-use account with a chosen Prospect Search
 * credit balance (default 500).
 *
 * "Complete" means everything AuthService.register() creates, plus the two
 * things a real signup deliberately leaves out:
 *
 *   - Tenant (slug derived from the company name, uniquified)
 *   - TenantSubscription, ACTIVE
 *   - TenantCreditBalance + a matching CreditLedgerEntry (so the ledger always
 *     sums to the balance -- the invariant the credits code relies on)
 *   - User, ADMIN + isSuperAdmin, email ALREADY VERIFIED (signup leaves this
 *     false and sends an OTP; an operator-created account has no inbox to
 *     check, so verifying here is what makes it loginable)
 *   - System roles for the tenant + the Super Admin assignment for the user
 *   - TenantModule rows for every ServiceModule, active. Signup grants no
 *     modules at all, and credits are gated on Lead Gen, so without these the
 *     500 credits exist but cannot be spent on anything. "Complete" is the
 *     whole product, so this grants Guard Tour and Finance too -- granting
 *     only Lead Gen would leave the guard and finance sections invisible.
 *
 * Credits are written as one PURCHASE ledger row for the full amount rather
 * than signup's 50 plus a 450 top-up: this account is provisioned, not
 * upgraded, and one row is the honest description of that.
 *
 * Dry run unless --apply is passed, because the local .env points at the
 * production database.
 *
 *   npx ts-node -T scripts/create-complete-account.ts \
 *     --email=owner@acme.com --company="Acme Security" --password='...'
 *
 *   # same command plus --apply actually writes it
 */
import {
  PrismaClient,
  Prisma,
  CreditEntryType,
  ServiceModule,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  systemRolePermissionKeys,
} from '../src/roles/rbac.constants';

const prisma = new PrismaClient();

/**
 * Every module, because this script provisions the Complete package. Listed
 * explicitly rather than read off the enum so adding a future ServiceModule
 * is a deliberate decision here, not an automatic grant.
 */
const COMPLETE_MODULES: ServiceModule[] = ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'];

const DEFAULT_CREDITS = 500;
const BCRYPT_PASSWORD_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

function arg(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!match) return undefined;
  return match.slice(`--${name}=`.length);
}

/** Mirrors AuthService.generateUniqueTenantSlug(). */
async function uniqueSlug(
  tx: Prisma.TransactionClient,
  company: string,
): Promise<string> {
  const base =
    company
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'company';

  let candidate = base;
  let suffix = 1;
  while (await tx.tenant.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function roleIdSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** RolesService.syncRolePermissions(), inlined. */
async function syncRolePermissions(roleId: string, permissionKeys: string[]) {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true },
  });
  const permissionIds = permissions.map((permission) => permission.id);

  if (permissionIds.length === 0) return;

  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });
}

/**
 * RolesService.ensurePermissions() + ensureTenantSystemRoles() +
 * ensureDefaultAssignmentForUser(), for a tenant known to be brand new.
 */
async function provisionRoles(tenantId: string, userId: string) {
  // Shared, global permission catalog -- upserted by key, so this is safe to
  // run against a database that already has it.
  await Promise.all(
    PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          name: permission.name,
          description: permission.description,
          module: permission.module,
        },
        create: {
          id: permission.key,
          key: permission.key,
          name: permission.name,
          description: permission.description,
          module: permission.module,
        },
      }),
    ),
  );

  for (const definition of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: definition.name } },
      update: {
        description: definition.description,
        isSystemRole: true,
        isActive: true,
      },
      create: {
        id: `${tenantId}:role:${roleIdSlug(definition.name)}`,
        tenantId,
        name: definition.name,
        description: definition.description,
        isSystemRole: true,
        isActive: true,
      },
    });

    await syncRolePermissions(
      role.id,
      systemRolePermissionKeys(definition.name),
    );
  }

  // The user is created isSuperAdmin, so the default role is Super Admin with
  // no branch scope -- same branch as ensureDefaultAssignmentForUser().
  const superAdmin = await prisma.role.findFirst({
    where: { tenantId, name: 'Super Admin', isActive: true },
    select: { id: true },
  });
  if (!superAdmin) {
    throw new Error('Super Admin role was not created; cannot assign a role.');
  }

  await prisma.userRoleAssignment.create({
    data: {
      tenantId,
      userId,
      roleId: superAdmin.id,
      branchId: null,
    },
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const email = (arg('email') ?? '').trim().toLowerCase();
  const company = (arg('company') ?? '').trim();
  const password = arg('password') ?? '';
  const name = (arg('name') ?? '').trim();
  const parsed = Number.parseInt(arg('credits') ?? '', 10);
  const credits =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CREDITS;

  const problems: string[] = [];
  if (!email || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    problems.push('--email=<address> is required and must look like an email');
  }
  if (!company) problems.push('--company="<company name>" is required');
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_LENGTH
  ) {
    problems.push(
      `--password=<password> is required, ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} bytes ` +
        '(the app rejects anything outside that range)',
    );
  }
  if (problems.length) {
    console.error('Cannot continue:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }

  // Checked before the transaction so the common mistake gets a clear message
  // rather than a P2002 from inside the writes.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, tenantId: true },
  });
  if (existing) {
    console.error(
      `An account with ${email} already exists (user ${existing.id}, tenant ` +
        `${existing.tenantId}, emailVerified=${existing.emailVerified}). ` +
        'Refusing to touch it -- pick another email, or adjust that account directly.',
    );
    process.exit(1);
  }

  console.log(`${apply ? 'Creating' : 'WOULD create'} a complete account:`);
  console.log(`  email      ${email}`);
  console.log(`  company    ${company}`);
  console.log(`  name       ${name || '(none)'}`);
  console.log(`  credits    ${credits}`);
  console.log(`  modules    ${COMPLETE_MODULES.join(', ')}`);
  console.log(`  verified   yes (loginable immediately, no OTP)`);
  console.log('');

  if (!apply) {
    console.log('Dry run -- nothing was written. Re-run with --apply.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_PASSWORD_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(tx, company);

    const tenant = await tx.tenant.create({
      data: { name: company, slug },
    });

    await tx.tenantSubscription.create({
      data: { tenantId: tenant.id, status: 'ACTIVE' },
    });

    await tx.tenantModule.createMany({
      data: COMPLETE_MODULES.map((module) => ({
        tenantId: tenant.id,
        module,
        isActive: true,
      })),
    });

    await tx.tenantCreditBalance.create({
      data: {
        tenantId: tenant.id,
        balance: credits,
        lifetimePurchased: credits,
      },
    });

    await tx.creditLedgerEntry.create({
      data: {
        tenantId: tenant.id,
        type: CreditEntryType.PURCHASE,
        amount: credits,
        balanceAfter: credits,
        description: `Account provisioned with ${credits} Prospect Search credits.`,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        tenantId: tenant.id,
        role: 'ADMIN',
        isSuperAdmin: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    return { tenant, user, slug };
  });

  // Roles are provisioned outside the transaction, as register() does it.
  //
  // This inlines RolesService.ensureTenantSystemRoles() +
  // ensureDefaultAssignmentForUser() rather than calling them: the service
  // takes AuditService and EntitlementsService in its constructor, and
  // standing up Nest's DI container for one script is more machinery than
  // this is worth. The two methods below touch only Prisma, and the shapes
  // they write (role id format, system flags, permission sync, assignment)
  // are copied from the service so the account is indistinguishable from a
  // signup. If SYSTEM_ROLES or PERMISSIONS change, this picks that up
  // automatically -- both are imported, not duplicated.
  await provisionRoles(result.tenant.id, result.user.id);

  const verify = await prisma.tenant.findUnique({
    where: { id: result.tenant.id },
    select: {
      id: true,
      name: true,
      slug: true,
      creditBalance: { select: { balance: true, lifetimePurchased: true } },
      modules: { select: { module: true, isActive: true } },
      subscription: { select: { status: true } },
      users: {
        select: {
          id: true,
          email: true,
          role: true,
          isSuperAdmin: true,
          emailVerified: true,
          roleAssignments: {
            where: { isActive: true },
            select: { role: { select: { name: true } } },
          },
        },
      },
    },
  });

  console.log('Created. Verified state read back from the database:');
  console.log(JSON.stringify(verify, null, 2));
  console.log('');
  console.log(`Log in at /login with ${email} and the password you passed.`);
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
