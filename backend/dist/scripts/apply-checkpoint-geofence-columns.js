"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const STATEMENTS = [
    `ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
    `ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
    `ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "geofence_radius_meters" INTEGER`,
    `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "verification_status" TEXT`,
    `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "distance_meters" DOUBLE PRECISION`,
    `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_latitude" DOUBLE PRECISION`,
    `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_longitude" DOUBLE PRECISION`,
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
//# sourceMappingURL=apply-checkpoint-geofence-columns.js.map