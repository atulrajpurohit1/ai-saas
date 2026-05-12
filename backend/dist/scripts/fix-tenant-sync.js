"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const targetTenantSlug = 'admin-tenant';
    const adminEmail = 'demo@gmail.com';
    const tenant = await prisma.tenant.findUnique({ where: { slug: targetTenantSlug } });
    if (!tenant) {
        console.log(`Tenant ${targetTenantSlug} not found.`);
        return;
    }
    await prisma.user.update({
        where: { email: adminEmail },
        data: { tenantId: tenant.id }
    });
    console.log(`Successfully moved ${adminEmail} to tenant: ${tenant.name} (${targetTenantSlug})`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=fix-tenant-sync.js.map