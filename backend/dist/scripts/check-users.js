"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const users = await prisma.user.findMany({
        select: {
            email: true,
            name: true,
            role: true,
            tenant: {
                select: {
                    name: true,
                    slug: true
                }
            }
        }
    });
    console.log('Current Users in DB:', JSON.stringify(users, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=check-users.js.map