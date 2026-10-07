/**
 * Verifies a seeded demo tenant (see seed-demo-showcase.ts). Read-only.
 *
 * Reads the tenant back and checks the things a demo would
 * actually break on: the credit-ledger invariant, invoice totals matching
 * their line items, every Kanban stage and lead status being represented,
 * the 8-week dashboard trend having spread, and the exception cases
 * (geofence failures, expired compliance, open disputes) existing.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!match) return undefined;
  return match.slice(`--${name}=`.length);
}

function ok(label: string, pass: boolean, detail: string) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} ${detail}`);
  return pass;
}

async function main() {
  const email = (arg('email') ?? 'demo@aegislead.co').trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { tenantId: true },
  });
  if (!user?.tenantId) {
    console.error(`No user/tenant found for ${email}.`);
    process.exit(1);
  }
  const TENANT = user.tenantId;
  const where = { tenantId: TENANT };
  let allPass = true;
  const check = (label: string, pass: boolean, detail: string) => {
    if (!ok(label, pass, detail)) allPass = false;
  };

  // 1. Credit ledger invariant.
  const sum = await prisma.creditLedgerEntry.aggregate({ where, _sum: { amount: true } });
  const bal = await prisma.tenantCreditBalance.findUnique({
    where: { tenantId: TENANT },
    select: { balance: true, lifetimePurchased: true, lifetimeConsumed: true },
  });
  check(
    'credit ledger sums to balance',
    (sum._sum.amount ?? 0) === (bal?.balance ?? -1),
    `ledger=${sum._sum.amount} balance=${bal?.balance} purchased=${bal?.lifetimePurchased} consumed=${bal?.lifetimeConsumed}`,
  );

  // 2. Every invoice total equals the sum of its items.
  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      invoiceNumber: true, totalAmount: true, totalHours: true, status: true,
      items: { select: { amount: true, workedHours: true } },
    },
  });
  const mismatched = invoices.filter((inv) => {
    const itemSum = Math.round(inv.items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    return Math.abs(itemSum - inv.totalAmount) > 0.05;
  });
  check(
    'invoice totals match their line items',
    mismatched.length === 0,
    mismatched.length
      ? `mismatched: ${mismatched.map((m) => m.invoiceNumber).join(', ')}`
      : `${invoices.length} invoices reconcile`,
  );

  const byStatus = invoices.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});
  check(
    'invoice statuses cover the workflow',
    ['draft', 'issued', 'paid', 'disputed', 'resolved'].every((s) => (byStatus[s] ?? 0) > 0),
    JSON.stringify(byStatus),
  );

  // 3. Every Kanban stage present.
  const deals = await prisma.deal.groupBy({ where, by: ['stage'], _count: true });
  const stages = deals.map((d) => d.stage);
  check(
    'every deal stage has at least one deal',
    ['New', 'Contacted', 'Proposal', 'Won', 'Lost'].every((s) => stages.includes(s)),
    stages.join(', '),
  );

  // 4. Every lead status present.
  const leads = await prisma.lead.groupBy({ where, by: ['status'], _count: true });
  const statuses = leads.map((l) => l.status);
  check(
    'lead statuses span the funnel',
    ['new', 'contacted', 'proposal_sent', 'responded', 'closed'].every((s) => statuses.includes(s)),
    statuses.join(', '),
  );

  // 5. Dashboard 8-week trend: leads must be spread, not a single spike.
  const leadDates = await prisma.lead.findMany({ where, select: { createdAt: true } });
  const weeks = new Set(
    leadDates.map((l) => {
      const d = new Date(l.createdAt);
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day);
      return d.toISOString().slice(0, 10);
    }),
  );
  check('leads spread across multiple weeks', weeks.size >= 4, `${weeks.size} distinct weeks`);

  // 6. Shifts both past and future, and some still open.
  const now = new Date();
  const [past, future, open] = await Promise.all([
    prisma.shift.count({ where: { ...where, startTime: { lt: now } } }),
    prisma.shift.count({ where: { ...where, startTime: { gte: now } } }),
    prisma.shift.count({ where: { ...where, status: 'open' } }),
  ]);
  check('schedule has past and future shifts', past > 0 && future > 0, `past=${past} future=${future} open=${open}`);

  // 7. Guard Tour exception cases.
  const [outside, missedRuns, inProgress] = await Promise.all([
    prisma.patrolEvent.count({ where: { ...where, verificationStatus: 'OUTSIDE_GEOFENCE' } }),
    prisma.patrolRun.count({ where: { ...where, status: 'missed' } }),
    prisma.patrolRun.count({ where: { ...where, status: 'in_progress' } }),
  ]);
  check(
    'patrol exceptions exist to demo',
    outside > 0 && missedRuns > 0,
    `outsideGeofence=${outside} missed=${missedRuns} inProgress=${inProgress}`,
  );

  // 8. Incidents across severity and review state.
  const sev = await prisma.incident.groupBy({ where, by: ['severity'], _count: true });
  const ist = await prisma.incident.groupBy({ where, by: ['status'], _count: true });
  check(
    'incidents cover severities and states',
    sev.length >= 4 && ist.length >= 3,
    `severities=${sev.map((s) => s.severity).join('/')} statuses=${ist.map((s) => s.status).join('/')}`,
  );

  // 9. Compliance: something expired and something expiring soon.
  const expired = await prisma.guardCompliance.count({
    where: { ...where, expirationDate: { lt: now } },
  });
  const soon = await prisma.guardCompliance.count({
    where: {
      ...where,
      expirationDate: { gte: now, lt: new Date(now.getTime() + 30 * 864e5) },
    },
  });
  check('compliance has expired + expiring docs', expired > 0 && soon > 0, `expired=${expired} expiringSoon=${soon}`);

  // 10. Timesheet approval queue is non-empty.
  const ts = await prisma.timesheet.groupBy({ where, by: ['status'], _count: true });
  const tsMap = Object.fromEntries(ts.map((t) => [t.status, t._count]));
  check(
    'timesheets include a pending queue',
    (tsMap.pending ?? 0) > 0 && (tsMap.approved ?? 0) > 0,
    JSON.stringify(tsMap),
  );

  // 11. Logins that must work.
  const [clientUsers, guardsWithPw] = await Promise.all([
    prisma.clientUser.count({ where: { ...where, emailVerified: true } }),
    prisma.guard.count({ where: { ...where, passwordHash: { not: null } } }),
  ]);
  check(
    'portal logins are usable',
    clientUsers > 0 && guardsWithPw > 0,
    `verifiedClientUsers=${clientUsers} guardsWithPassword=${guardsWithPw}`,
  );

  // 12. Nothing leaked outside this tenant: the seeded client emails and
  // guard emails must all belong to this tenant.
  const strayGuards = await prisma.guard.count({
    where: { email: { endsWith: '@aegislead-demo.example' }, tenantId: { not: TENANT } },
  });
  check('no seeded rows outside the demo tenant', strayGuards === 0, `strayGuards=${strayGuards}`);

  // --- Phase 2: the rest of the product -----------------------------------
  // These screens were empty after phase 1. The account owner asked for a
  // complete build-out, so each one needs rows or that part of the demo is
  // still a blank page.

  // 13. RFP pipeline spans every status.
  const rfpStatuses = await prisma.rfp.groupBy({ where, by: ['status'], _count: true });
  const rfpSeen = rfpStatuses.map((r) => r.status);
  check(
    'RFPs cover every pipeline status',
    ['DRAFT', 'GENERATED', 'FINALIZED', 'EVALUATED', 'AWARDED'].every((s) => rfpSeen.includes(s as any)),
    rfpSeen.join(', '),
  );

  // 14. An awarded RFP actually points at a vendor, and submissions exist.
  const [awarded, submissions, evaluations, perf] = await Promise.all([
    prisma.rfp.count({ where: { ...where, awardedVendorId: { not: null } } }),
    prisma.proposalSubmission.count({ where }),
    prisma.evaluationReport.count({ where }),
    prisma.vendorPerformance.count({ where }),
  ]);
  check(
    'RFP award trail is complete',
    awarded > 0 && submissions > 0 && evaluations > 0 && perf > 0,
    `awarded=${awarded} submissions=${submissions} evaluations=${evaluations} perfReviews=${perf}`,
  );

  // 15. Vendors, including an inactive one so the status filter is meaningful.
  const vendorStatuses = await prisma.vendor.groupBy({ where, by: ['status'], _count: true });
  check(
    'vendors include active and inactive',
    vendorStatuses.length >= 2,
    vendorStatuses.map((v) => `${v.status}=${v._count}`).join(' '),
  );

  // 16. Sales Accelerator has scored assessments tied to discovery sessions.
  const scored = await prisma.salesAssessment.count({
    where: { ...where, leadScore: { not: null }, discoverySessionId: { not: null } },
  });
  check('sales assessments are scored and linked', scored > 0, `scoredAssessments=${scored}`);

  // 17. Sales Calls span more than one outcome.
  const outcomes = await prisma.callRecord.groupBy({ where, by: ['outcome'], _count: true });
  check(
    'call log covers multiple outcomes',
    outcomes.length >= 4,
    outcomes.map((o) => o.outcome).join('/'),
  );

  // 18. An ACTIVE emergency alert exists - that is what makes the patrol
  // monitor screen worth opening during a demo.
  const alertStates = await prisma.emergencyAlert.groupBy({ where, by: ['status'], _count: true });
  const alertSeen = alertStates.map((a) => a.status);
  check(
    'emergency alerts cover all three states',
    ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].every((s) => alertSeen.includes(s)),
    alertSeen.join('/'),
  );

  // 19. Branding + integrations are configured.
  const [branding, domains, keys, hooks, deliveries, reqLogs] = await Promise.all([
    prisma.tenantBranding.count({ where }),
    prisma.customDomain.count({ where }),
    prisma.apiKey.count({ where }),
    prisma.webhook.count({ where }),
    prisma.webhookDelivery.count({ where: { webhook: { tenantId: TENANT } } }),
    prisma.apiRequestLog.count({ where }),
  ]);
  check(
    'branding and integrations are populated',
    branding > 0 && domains > 0 && keys > 0 && hooks > 0 && deliveries > 0 && reqLogs > 0,
    `branding=${branding} domains=${domains} apiKeys=${keys} webhooks=${hooks} deliveries=${deliveries} requestLogs=${reqLogs}`,
  );

  // 20. A webhook delivery failure exists, so the retry/error UI has a case.
  const failed = await prisma.webhookDelivery.count({
    where: { webhook: { tenantId: TENANT }, success: false },
  });
  check('webhook history includes a failure', failed > 0, `failedDeliveries=${failed}`);

  // 21. Team: more than one user, each with a role assignment, so the Roles
  // screen shows real people rather than just the owner.
  const staff = await prisma.user.count({ where });
  const assignments = await prisma.userRoleAssignment.count({ where });
  check(
    'team has multiple users with roles',
    staff >= 3 && assignments >= 3,
    `users=${staff} roleAssignments=${assignments}`,
  );

  console.log('');
  console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
