import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Creates (or resets the password of) a platform administrator -- the account
 * that runs AegisLead itself, not a user inside any tenant.
 *
 * Credentials MUST come from the environment. This script is committed to a
 * PUBLIC repository, so a default or an example value baked in here would be a
 * working published login for every deployment it had ever been run against.
 * That has already happened once in this repo's history (see seed-admin.ts),
 * and refusing to run without the variables is how it does not happen again.
 *
 *   PLATFORM_ADMIN_EMAIL=you@example.com \
 *   PLATFORM_ADMIN_PASSWORD='<strong password>' \
 *     npx ts-node prisma/seed-platform-admin.ts
 *
 * Idempotent: running it again on an existing address resets that account's
 * password and re-enables it, rather than failing on the unique constraint.
 */

const MIN_PASSWORD_LENGTH = 12;

/** Passwords published in this repository, or obvious guesses. */
const FORBIDDEN_PASSWORDS = new Set([
  'admin123!',
  'admin123',
  'password',
  'password123',
  'changeme',
  'letmein',
  'aegislead',
]);

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Refusing to run: ${name} is not set.`);
    console.error(
      "Usage: PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_PASSWORD='<strong password>' npx ts-node prisma/seed-platform-admin.ts",
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = requireEnv('PLATFORM_ADMIN_EMAIL').toLowerCase();
  const plainPassword = requireEnv('PLATFORM_ADMIN_PASSWORD');
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || 'Platform Admin';

  if (plainPassword.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Refusing to run: PLATFORM_ADMIN_PASSWORD is shorter than ${MIN_PASSWORD_LENGTH} characters.`,
    );
    process.exit(1);
  }
  if (FORBIDDEN_PASSWORDS.has(plainPassword.toLowerCase())) {
    console.error(
      'Refusing to run: that password is published or trivially guessable.',
    );
    process.exit(1);
  }

  const password = await bcrypt.hash(plainPassword, 10);

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });

  if (existing) {
    await prisma.platformAdmin.update({
      where: { email },
      data: {
        password,
        name,
        isActive: true,
        // Clear any lockout and any live session: whoever reruns this is
        // taking control of the account, and an old refresh token must not
        // keep working against the new password.
        failedAttempts: 0,
        lockedUntil: null,
        refreshTokenHash: null,
      },
    });
    console.log(`Platform admin updated: ${email}`);
  } else {
    await prisma.platformAdmin.create({
      data: { email, password, name },
    });
    console.log(`Platform admin created: ${email}`);
  }

  const total = await prisma.platformAdmin.count({ where: { isActive: true } });
  console.log(`Active platform admins: ${total}`);
  console.log(
    'This account is NOT a tenant user. It signs in at /super-admin and has no access to any tenant app.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
