"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const guards = await prisma.guard.findMany({
        select: { id: true, email: true, phone: true, name: true, tenantId: true, branchId: true, createdAt: true, passwordHash: true },
    });
    const out = guards.map(g => ({ ...g, hasPassword: !!g.passwordHash, passwordHash: undefined }));
    console.log(JSON.stringify(out, null, 2));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=list_guards.js.map