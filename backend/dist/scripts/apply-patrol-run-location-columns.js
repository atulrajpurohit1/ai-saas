"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const STATEMENTS = [
    `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_latitude" DOUBLE PRECISION`,
    `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_longitude" DOUBLE PRECISION`,
    `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_accuracy_meters" DOUBLE PRECISION`,
    `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_location_at" TIMESTAMP(3)`,
];
async function main() {
    for (const sql of STATEMENTS) {
        console.log(`Running: ${sql}`);
        await prisma.$executeRawUnsafe(sql);
    }
    console.log('\nDone. All statements are idempotent ADD COLUMN IF NOT EXISTS on nullable columns.');
}
main()
    .catch((err) => {
    console.error(err);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=apply-patrol-run-location-columns.js.map