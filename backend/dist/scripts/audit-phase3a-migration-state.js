"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('=== 1. _prisma_migrations record for the Phase 3A migration ===');
    const migrationRows = await prisma.$queryRawUnsafe(`SELECT migration_name, checksum, finished_at, applied_steps_count, logs
     FROM "_prisma_migrations"
     WHERE migration_name = '20260821220133_add_checkpoint_geofence_verification'`);
    console.log(JSON.stringify(migrationRows, null, 2));
    console.log('\n=== 2. Most recent 5 migration rows (context) ===');
    const recent = await prisma.$queryRawUnsafe(`SELECT migration_name, finished_at, applied_steps_count
     FROM "_prisma_migrations"
     ORDER BY started_at DESC
     LIMIT 5`);
    console.log(JSON.stringify(recent, null, 2));
    console.log('\n=== 3. Actual Checkpoint columns (information_schema) ===');
    const checkpointCols = await prisma.$queryRawUnsafe(`SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'Checkpoint' AND column_name IN ('latitude','longitude','geofence_radius_meters')
     ORDER BY column_name`);
    console.log(JSON.stringify(checkpointCols, null, 2));
    console.log('\n=== 4. Actual PatrolEvent columns (information_schema) ===');
    const patrolEventCols = await prisma.$queryRawUnsafe(`SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'PatrolEvent' AND column_name IN ('verification_status','distance_meters','submitted_latitude','submitted_longitude')
     ORDER BY column_name`);
    console.log(JSON.stringify(patrolEventCols, null, 2));
    console.log('\n=== 5. Prisma Client field access check (typed query, zero rows needed) ===');
    const checkpointSample = await prisma.checkpoint.findFirst({
        select: { id: true, latitude: true, longitude: true, geofenceRadiusMeters: true },
    });
    console.log('checkpoint.findFirst with new fields succeeded. Sample:', JSON.stringify(checkpointSample));
    const eventSample = await prisma.patrolEvent.findFirst({
        select: {
            id: true,
            verificationStatus: true,
            distanceMeters: true,
            submittedLatitude: true,
            submittedLongitude: true,
        },
    });
    console.log('patrolEvent.findFirst with new fields succeeded. Sample:', JSON.stringify(eventSample));
    console.log('\n=== 6. Counts (context only, not a data dump) ===');
    const checkpointCount = await prisma.checkpoint.count();
    const checkpointWithGeofence = await prisma.checkpoint.count({ where: { latitude: { not: null } } });
    const eventCount = await prisma.patrolEvent.count();
    const eventWithVerification = await prisma.patrolEvent.count({ where: { verificationStatus: { not: null } } });
    console.log({ checkpointCount, checkpointWithGeofence, eventCount, eventWithVerification });
}
main()
    .catch((err) => {
    console.error('AUDIT ERROR:', err);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=audit-phase3a-migration-state.js.map