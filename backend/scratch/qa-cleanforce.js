const { PrismaClient } = require('@prisma/client');
const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL + sep + 'connection_limit=5&pool_timeout=90&connect_timeout=90' } } });
async function retry(fn,n=6){let e;for(let i=0;i<n;i++){try{return await fn()}catch(x){e=x;if(!['P2024','P2028','P2010','P2037'].includes(x.code))throw x;await new Promise(r=>setTimeout(r,3000*(i+1)))}}throw e}
const del = async (m, where) => { try { await retry(()=>p[m].deleteMany({ where })); } catch (e) { console.log('  skip', m, e.message.slice(0,80)); } };
(async () => {
  const ts = await retry(()=>p.tenant.findMany({ where: { OR: [{ slug: { startsWith: 'warmup-del-' } }, { slug: { startsWith: 'qae2e-' } }, { slug: { startsWith: 'qafix-' } }] }, select: { id: true, slug: true } }));
  console.log('found', ts.length, 'tenants to purge');
  const order = ['patrolEvidence','patrolEvent','patrolRun','patrolRouteCheckpoint','patrolRoute','checkpoint','incidentEvidence','incident','emergencyAlert','attendanceEvent','guardSyncQueue','assignment','availability','shift','invoiceItem','invoiceDispute','invoice','timesheet','rateCard','dailyServiceReport','guardCompliance','site','guard','proposalComment','proposalVersion','proposal','note','activity','deal','lead','clientInsurancePolicy','clientUser','client','discoverySession','salesAssessment','userRoleAssignment','rolePermission','role','userSession','auditLog','user'];
  for (const t of ts) {
    const tid = t.id;
    for (const m of order) {
      // pick a plausible where clause
      if (['patrolRouteCheckpoint'].includes(m)) await del(m, { patrolRoute: { tenantId: tid } });
      else if (['attendanceEvent','assignment'].includes(m)) await del(m, { shift: { tenantId: tid } });
      else if (['availability','guardCompliance'].includes(m)) await del(m, { guard: { tenantId: tid } });
      else if (['invoiceItem','invoiceDispute'].includes(m)) await del(m, { invoice: { tenantId: tid } });
      else if (['proposalComment','proposalVersion'].includes(m)) await del(m, { proposal: { tenantId: tid } });
      else if (['rolePermission'].includes(m)) await del(m, { role: { tenantId: tid } });
      else await del(m, { tenantId: tid });
    }
    await retry(()=>p.tenant.delete({ where: { id: tid } })).then(()=>console.log('deleted', t.slug)).catch(e=>console.log('FAIL', t.slug, e.message.slice(0,140)));
  }
  await p.$disconnect();
})();
