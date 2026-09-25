// Creates a Lead-Gen-only demo tenant with realistic sample data, so the
// standalone experience can be seen rather than described.
//
//   node scratch/demo-leadgen.js           create (or recreate)
//   node scratch/demo-leadgen.js --clean   remove it
//
// Not part of the app.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const SLUG = 'leadgen-demo';
const EMAIL = 'demo@leadgen.test';
const PASSWORD = 'LeadGenDemo1!';

const LEADS = [
  { name: 'Marcus Webb', company: 'Northgate Logistics', email: 'm.webb@northgate-log.com', status: 'qualified' },
  { name: 'Priya Raman', company: 'Halcyon Data Centres', email: 'p.raman@halcyondc.com', status: 'contacted' },
  { name: 'Tom Ellery', company: 'Riverside Retail Park', email: 't.ellery@riversidepark.co', status: 'new' },
  { name: 'Sandra Okafor', company: 'Meridian Hospital Trust', email: 's.okafor@meridiantrust.org', status: 'qualified' },
  { name: 'James Whitfield', company: 'Blackthorn Construction', email: 'j.whitfield@blackthorn.build', status: 'contacted' },
  { name: 'Aisha Kelani', company: 'Vertex Business Campus', email: 'a.kelani@vertexcampus.com', status: 'new' },
  { name: 'Daniel Brook', company: 'Coastal Freight Terminal', email: 'd.brook@coastalfreight.com', status: 'qualified' },
  { name: 'Helen Voss', company: 'Ardent Pharmaceuticals', email: 'h.voss@ardentpharma.com', status: 'new' },
];

// Which lead index maps to which deal, and at what stage.
const DEALS = [
  { lead: 0, name: 'Northgate — 3 sites, 24/7 manned guarding', stage: 'Proposal' },
  { lead: 1, name: 'Halcyon DC — access control + patrol', stage: 'Contacted' },
  { lead: 3, name: 'Meridian Trust — hospital security contract', stage: 'Proposal' },
  { lead: 4, name: 'Blackthorn — construction site security', stage: 'New' },
  { lead: 6, name: 'Coastal Freight — port perimeter patrol', stage: 'Won' },
  { lead: 2, name: 'Riverside Retail — weekend cover', stage: 'New' },
  { lead: 5, name: 'Vertex Campus — reception + concierge', stage: 'Contacted' },
];

async function clean() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) return false;
  const t = { tenantId: tenant.id };

  await prisma.activity.deleteMany({ where: t }).catch(() => undefined);
  await prisma.note.deleteMany({ where: t }).catch(() => undefined);
  await prisma.proposal.deleteMany({ where: t }).catch(() => undefined);
  await prisma.deal.deleteMany({ where: t }).catch(() => undefined);
  await prisma.lead.deleteMany({ where: t }).catch(() => undefined);
  await prisma.userRoleAssignment.deleteMany({ where: t }).catch(() => undefined);
  await prisma.rolePermission
    .deleteMany({ where: { role: { tenantId: tenant.id } } })
    .catch(() => undefined);
  await prisma.role.deleteMany({ where: t }).catch(() => undefined);
  await prisma.user.deleteMany({ where: t }).catch(() => undefined);
  await prisma.tenantModule.deleteMany({ where: t }).catch(() => undefined);
  await prisma.tenantSubscription.deleteMany({ where: t }).catch(() => undefined);
  await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
  return true;
}

async function main() {
  if (process.argv.includes('--clean')) {
    console.log((await clean()) ? 'removed demo tenant' : 'nothing to remove');
    return prisma.$disconnect();
  }

  await clean();

  const tenant = await prisma.tenant.create({
    data: { name: 'Sentinel Security Group', slug: SLUG },
  });

  await prisma.tenantSubscription.create({
    data: { tenantId: tenant.id, status: 'ACTIVE' },
  });

  // The whole point of the demo: LEAD_GEN and nothing else.
  await prisma.tenantModule.create({
    data: { tenantId: tenant.id, module: 'LEAD_GEN' },
  });

  await prisma.user.create({
    data: {
      email: EMAIL,
      password: await bcrypt.hash(PASSWORD, 10),
      name: 'Demo Admin',
      tenantId: tenant.id,
      isSuperAdmin: true,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  const createdLeads = [];
  for (const [index, lead] of LEADS.entries()) {
    createdLeads.push(
      await prisma.lead.create({
        data: {
          ...lead,
          tenantId: tenant.id,
          // Spread creation dates over the last few weeks so the dashboard
          // trend chart has a shape rather than one spike.
          createdAt: new Date(Date.now() - (index + 1) * 3 * 24 * 60 * 60 * 1000),
        },
      }),
    );
  }

  for (const deal of DEALS) {
    await prisma.deal.create({
      data: {
        name: deal.name,
        stage: deal.stage,
        leadId: createdLeads[deal.lead].id,
        tenantId: tenant.id,
      },
    });
  }

  console.log('');
  console.log('  Lead Gen demo account ready');
  console.log('  ---------------------------------------');
  console.log('  URL      : http://localhost:3000/login');
  console.log(`  Email    : ${EMAIL}`);
  console.log(`  Password : ${PASSWORD}`);
  console.log('');
  console.log('  Tenant   : Sentinel Security Group');
  console.log('  Services : LEAD_GEN only');
  console.log(`  Data     : ${LEADS.length} leads, ${DEALS.length} deals`);
  console.log('');
  console.log('  Try: /shifts or /invoices -> "not part of your plan"');
  console.log('  Try: Settings > Your Plan  -> what is and is not included');
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
