"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const tenants = await prisma.tenant.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            users: { select: { email: true } },
            clientUsers: { select: { email: true } }
        }
    });
    console.log('Tenants:', JSON.stringify(tenants, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=check-tenants.js.map