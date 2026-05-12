"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const clientUsers = await prisma.clientUser.findMany({
        select: {
            email: true,
            client: {
                select: {
                    name: true,
                    companyName: true
                }
            },
            tenant: {
                select: {
                    slug: true
                }
            }
        }
    });
    console.log('Current Client Users in DB:', JSON.stringify(clientUsers, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=check-client-users.js.map