"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const FIXTURE_PATTERNS = [
    /e2e/i,
    /forgotpw|wrongotp/i,
    /^warmup\d*/i,
    /^timingcheck\d*/i,
    /^(deploy|live|hm|brevo)check\d*/i,
    /^brevo\d+$/i,
    /^probeco[0-9a-f]+$/i,
    /^(credits|ent)-e2e-/i,
];
function isFixture(name, slug) {
    return FIXTURE_PATTERNS.some((pattern) => pattern.test(name) || pattern.test(slug));
}
function arg(name) {
    return process.argv
        .find((value) => value.startsWith(`--${name}=`))
        ?.split('=')[1];
}
async function deleteTenant(tenantId) {
    await prisma.$transaction(async (tx) => {
        const tables = await tx.$queryRaw `
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'tenant_id'
        ORDER BY table_name
      `;
        let remaining = tables.map((row) => row.table_name);
        for (let pass = 0; pass < 12 && remaining.length; pass += 1) {
            const blocked = [];
            for (const table of remaining) {
                try {
                    await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE tenant_id = $1`, tenantId);
                }
                catch {
                    blocked.push(table);
                }
            }
            if (blocked.length === remaining.length) {
                throw new Error(`Could not resolve delete order; still blocked: ${blocked.join(', ')}`);
            }
            remaining = blocked;
        }
        if (remaining.length) {
            throw new Error(`Gave up with tables still populated: ${remaining.join(', ')}`);
        }
        await tx.$executeRaw `DELETE FROM "Tenant" WHERE id = ${tenantId}`;
    }, { timeout: 120_000 });
}
async function main() {
    const apply = process.argv.includes('--apply');
    const slugs = (arg('slug') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    const all = await prisma.tenant.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { createdAt: 'asc' },
    });
    const targets = slugs.length
        ? all.filter((tenant) => slugs.includes(tenant.slug))
        : all.filter((tenant) => isFixture(tenant.name, tenant.slug));
    if (!targets.length) {
        console.log('Nothing matches; nothing to delete.');
        return;
    }
    console.log(`${targets.length} tenant(s) targeted for deletion out of ${all.length} total:\n`);
    targets.forEach((tenant) => console.log(`  ${tenant.name}  |  ${tenant.slug}`));
    if (!apply) {
        console.log(`\nDRY RUN — nothing deleted. Re-run with --apply to remove these ${targets.length} tenant(s).`);
        return;
    }
    console.log('');
    let deleted = 0;
    const failed = [];
    for (const tenant of targets) {
        try {
            await deleteTenant(tenant.id);
            console.log(`  DELETED  ${tenant.slug}`);
            deleted += 1;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`  FAILED   ${tenant.slug} — ${message}`);
            failed.push(tenant.slug);
        }
    }
    console.log(`\nDeleted ${deleted}, failed ${failed.length}.`);
    if (failed.length) {
        console.log(`Failed tenants were left untouched: ${failed.join(', ')}`);
        process.exitCode = 1;
    }
}
main()
    .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=delete-test-tenants.js.map