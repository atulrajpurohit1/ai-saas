"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const clients = await prisma.client.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            tenantId: true,
            tenant: { select: { slug: true, name: true } }
        }
    });
    console.log('Clients:', JSON.stringify(clients, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=list-clients.js.map