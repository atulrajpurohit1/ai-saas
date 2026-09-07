const { PrismaClient } = require('@prisma/client');
const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + sep + 'connection_limit=1&connect_timeout=30' } } });
(async () => {
  try {
    const t0 = Date.now();
    const r = await p.$queryRawUnsafe('SELECT count(*)::int AS n FROM pg_stat_activity');
    console.log('pg_stat_activity count =', r[0].n, 'in', Date.now()-t0, 'ms');
    const r2 = await p.$queryRawUnsafe("SELECT state, count(*)::int AS n FROM pg_stat_activity GROUP BY state");
    console.log(JSON.stringify(r2));
    const tx = await p.$transaction(async (t) => { await t.tenant.count(); return 'ok'; });
    console.log('tx test:', tx);
  } catch (e) { console.error('ERR', e.message); }
  finally { await p.$disconnect(); }
})();
