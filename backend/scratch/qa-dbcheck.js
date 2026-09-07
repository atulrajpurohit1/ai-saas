const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const counts = {};
    for (const m of ['tenant','user','guard','client','clientUser','lead','deal','proposal','site','shift','assignment','patrolRun','patrolRoute','checkpoint','patrolEvent','incident','incidentEvidence','patrolEvidence','emergencyAlert','invoice','timesheet','rateCard','rfp','vendor','apiKey','webhook','role','permission','auditLog','guardSyncQueue']) {
      try { counts[m] = await p[m].count(); } catch (e) { counts[m] = 'ERR:'+e.message.slice(0,60); }
    }
    console.log('COUNTS:', JSON.stringify(counts, null, 2));
    const t = await p.tenant.findMany({ select: { id:true, name:true, slug:true }, take: 20 });
    console.log('TENANTS:', JSON.stringify(t, null, 2));
    const u = await p.user.findMany({ select: { id:true, email:true, name:true, role:true, tenantId:true }, take: 20 });
    console.log('USERS:', JSON.stringify(u, null, 2));
  } catch (e) { console.error('ERR', e); }
  finally { await p.$disconnect(); }
})();
