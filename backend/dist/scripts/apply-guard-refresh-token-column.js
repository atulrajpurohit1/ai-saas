"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const STATEMENTS = [
    `ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT`,
];
async function main() {
    for (const sql of STATEMENTS) {
        console.log(`Running: ${sql}`);
        await prisma.$executeRawUnsafe(sql);
    }
    console.log('\nDone. Statement is an idempotent ADD COLUMN IF NOT EXISTS on a nullable column.');
}
main()
    .catch((err) => {
    console.error(err);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=apply-guard-refresh-token-column.js.map