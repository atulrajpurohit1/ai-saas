const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

function generatedPassword() {
  return `Guard@${randomBytes(4).toString('hex')}`;
}

function defaultEmailFor(guard) {
  return `guard.${guard.id.slice(0, 8)}@example.com`;
}

async function ensureGuardLoginColumns() {
  const columns = await prisma.$queryRawUnsafe(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'Guard'
      and column_name in ('email', 'password_hash')
  `);

  const names = new Set(columns.map((column) => column.column_name));
  if (!names.has('email') || !names.has('password_hash')) {
    throw new Error(
      'Guard login columns are missing. Run `npx prisma db push` or apply the guard-login migration before creating credentials.',
    );
  }
}

async function findGuard() {
  const guardId = process.env.GUARD_ID;
  const email = process.env.GUARD_EMAIL?.trim().toLowerCase();
  const phone = process.env.GUARD_PHONE?.trim();

  if (guardId) {
    return prisma.guard.findUnique({ where: { id: guardId } });
  }

  if (email || phone) {
    return prisma.guard.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return prisma.guard.findFirst({
    orderBy: { createdAt: 'desc' },
  });
}

async function main() {
  await ensureGuardLoginColumns();

  const guard = await findGuard();
  if (!guard) {
    throw new Error('No guard found. Create a guard from the admin Guards page first.');
  }

  const email = process.env.GUARD_EMAIL?.trim().toLowerCase() || guard.email || defaultEmailFor(guard);
  const phone = process.env.GUARD_PHONE?.trim() || guard.phone || null;
  const password = process.env.GUARD_PASSWORD || generatedPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const updated = await prisma.guard.update({
    where: { id: guard.id },
    data: {
      email,
      phone,
      passwordHash,
    },
    include: {
      tenant: { select: { name: true, slug: true } },
      availability: { select: { status: true } },
    },
  });

  console.log('--- GUARD PORTAL CREDENTIALS CREATED ---');
  console.log(`Guard: ${updated.name}`);
  console.log(`Guard ID: ${updated.id}`);
  console.log(`Tenant: ${updated.tenant.name} (${updated.tenant.slug})`);
  console.log(`Login URL: /guard/login`);
  console.log(`Email: ${updated.email}`);
  console.log(`Phone: ${updated.phone || 'not set'}`);
  console.log(`Password: ${password}`);
  console.log(`Availability: ${updated.availability?.status || 'available'}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
