"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const targetTenantSlug = 'demo';
    const tenant = await prisma.tenant.findUnique({ where: { slug: targetTenantSlug } });
    if (!tenant) {
        console.log(`Tenant ${targetTenantSlug} not found.`);
        return;
    }
    const tenantId = tenant.id;
    await prisma.user.updateMany({
        data: { tenantId }
    });
    await prisma.client.updateMany({
        data: { tenantId }
    });
    await prisma.clientUser.updateMany({
        data: { tenantId }
    });
    await prisma.lead.updateMany({
        data: { tenantId }
    });
    await prisma.proposal.updateMany({
        data: { tenantId }
    });
    await prisma.site.updateMany({ data: { tenantId } });
    await prisma.guard.updateMany({ data: { tenantId } });
    console.log(`Successfully moved ALL data to tenant: ${tenant.name} (${targetTenantSlug})`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=sync-all-to-demo.js.map