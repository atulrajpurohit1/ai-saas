const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({ where: { tenant: { slug: { startsWith: 'qae2e-' } } }, include: { roleAssignments: { include: { role: true } }, tenant: true } });
  for (const u of users) {
    console.log(u.email, 'isSuperAdmin=', u.isSuperAdmin, 'role=', u.role, 'tenant=', u.tenant.slug);
    for (const ra of u.roleAssignments) console.log('   assignment:', ra.role.name, 'active=', ra.isActive, 'branchId=', ra.branchId);
  }
  await p.$disconnect();
})();
