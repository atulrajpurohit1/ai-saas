import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Creates (or updates) the first administrator.
 *
 * The email and password MUST be supplied in the environment. This script used
 * to hardcode admin@aisaascrm.com / Admin123!, and because this repository is
 * public, that was a working published login for any deployment it had ever
 * been run against -- which included production. Anyone who read the repo
 * could sign in as Super Admin. Hardcoding a credential in a seed script is
 * safe only while the repo is private and the script never touches a real
 * database; neither held here.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' \
 *     npx ts-node prisma/seed-admin.ts
 *
 * Refusing to run without them is deliberate. A default would be reintroducing
 * the same problem with extra steps: it would be committed, read, and
 * eventually be the password on somebody's production box.
 */

const MIN_PASSWORD_LENGTH = 12;

/** Passwords that have appeared in this repository or are obvious guesses. */
const FORBIDDEN_PASSWORDS = new Set([
  'admin123!',
  'admin123',
  'password',
  'password123',
  'changeme',
  'letmein',
]);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Refusing to run: ${name} is not set.`);
    console.error(
      "Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' npx ts-node prisma/seed-admin.ts",
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const plainPassword = requireEnv('ADMIN_PASSWORD');

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Refusing to run: ADMIN_PASSWORD is shorter than ${MIN_PASSWORD_LENGTH} characters.`,
    );
    process.exit(1);
  }
  if (FORBIDDEN_PASSWORDS.has(plainPassword.toLowerCase())) {
    console.error(
      'Refusing to run: that password has been published in this repository.',
    );
    process.exit(1);
  }

  const password = await bcrypt.hash(plainPassword, 10);
  const tenantName = process.env.ADMIN_TENANT_NAME?.trim() || 'Default Admin Tenant';
  const tenantSlug = process.env.ADMIN_TENANT_SLUG?.trim() || 'admin-tenant';

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: tenantName, slug: tenantSlug },
    });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.user.update({
      where: { email },
      data: { password, tenantId: tenant.id },
    });
    console.log(`Admin user updated: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        password,
        name: process.env.ADMIN_NAME?.trim() || 'Super Admin',
        tenantId: tenant.id,
      },
    });
    console.log(`Admin user created: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
