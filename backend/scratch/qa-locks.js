const { PrismaClient } = require('@prisma/client');
const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + sep + 'connection_limit=1' } } });
(async () => {
  const acts = await p.$queryRawUnsafe(`
    SELECT pid, state, wait_event_type AS wt, wait_event AS we,
           EXTRACT(EPOCH FROM (now()-xact_start))::int AS xact_age_s,
           EXTRACT(EPOCH FROM (now()-state_change))::int AS since_change_s,
           left(query, 90) AS q
    FROM pg_stat_activity WHERE datname='neondb' ORDER BY xact_start NULLS LAST`);
  for (const a of acts) console.log(`pid=${a.pid} state=${a.state} wait=${a.wt||''}/${a.we||''} xact_age=${a.xact_age_s ?? '-'}s chg=${a.since_change_s}s :: ${a.q}`);
  await p.$disconnect();
})();
