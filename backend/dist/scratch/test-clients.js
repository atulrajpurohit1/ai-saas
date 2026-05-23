"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const user = await prisma.user.findFirst({ where: { email: 'admin@aisaascrm.com' } });
    console.log('Admin tenantId:', user ? user.tenantId : 'NOT FOUND');
    const clients = await prisma.client.findMany();
    console.log('All Clients:', clients);
    const clientUsers = await prisma.clientUser.findMany();
    console.log('All Client Users:', clientUsers);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=test-clients.js.map