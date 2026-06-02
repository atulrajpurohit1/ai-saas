const fs = require('fs');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

function loadEnv(path) {
  const content = fs.readFileSync(path, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const index = line.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index);
    const value = line.slice(index + 1).replace(/^['"]|['"]$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

loadEnv('.env');

const prisma = new PrismaClient();

const credentials = {
  admin: {
    email: 'admin.neon@ai-saas.local',
    password: 'Admin@Neon2026!',
    name: 'Neon Demo Admin',
  },
  client: {
    email: 'client.neon@ai-saas.local',
    password: 'Client@Neon2026!',
    name: 'Neon Demo Client User',
  },
  guard: {
    email: 'guard.neon@ai-saas.local',
    phone: '+15550102026',
    password: 'Guard@Neon2026!',
    name: 'Neon Demo Guard',
  },
};

const tenantSeed = {
  name: 'Neon Demo Security',
  slug: 'neon-demo-security',
};

const clientSeed = {
  name: 'Acme Logistics',
  companyName: 'Acme Logistics',
  email: 'security-contact@acme-logistics.local',
  phone: '+15550103030',
};

function tomorrowAt(hour) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function findOrCreate(model, where, createData, updateData = createData) {
  const existing = await model.findFirst({ where });

  if (existing) {
    return model.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  return model.create({ data: createData });
}

async function ensureProposalVersion(tx, proposalId, content) {
  const firstVersion = await tx.proposalVersion.findFirst({
    where: { proposalId, versionNumber: 1 },
  });

  if (firstVersion) {
    return tx.proposalVersion.update({
      where: { id: firstVersion.id },
      data: { content },
    });
  }

  return tx.proposalVersion.create({
    data: {
      proposalId,
      content,
      versionNumber: 1,
    },
  });
}

async function ensureComment(tx, data) {
  const existing = await tx.proposalComment.findFirst({
    where: {
      proposalId: data.proposalId,
      tenantId: data.tenantId,
      content: data.content,
    },
  });

  if (existing) {
    return existing;
  }

  return tx.proposalComment.create({ data });
}

async function ensureAuditLog(tx, data) {
  const existing = await tx.auditLog.findFirst({
    where: {
      tenantId: data.tenantId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
    },
  });

  if (existing) {
    return existing;
  }

  return tx.auditLog.create({ data });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const parsedUrl = new URL(databaseUrl);
  if (!parsedUrl.hostname.endsWith('.neon.tech')) {
    throw new Error(`Refusing to seed credentials because DATABASE_URL is not Neon: ${parsedUrl.hostname}`);
  }

  const [adminPasswordHash, clientPasswordHash, guardPasswordHash] = await Promise.all([
    bcrypt.hash(credentials.admin.password, 10),
    bcrypt.hash(credentials.client.password, 10),
    bcrypt.hash(credentials.guard.password, 10),
  ]);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.upsert({
      where: { slug: tenantSeed.slug },
      update: { name: tenantSeed.name },
      create: tenantSeed,
    });

    const admin = await tx.user.upsert({
      where: { email: credentials.admin.email },
      update: {
        password: adminPasswordHash,
        name: credentials.admin.name,
        role: 'ADMIN',
        tenantId: tenant.id,
        refreshToken: null,
      },
      create: {
        email: credentials.admin.email,
        password: adminPasswordHash,
        name: credentials.admin.name,
        role: 'ADMIN',
        tenantId: tenant.id,
      },
    });

    const client = await findOrCreate(
      tx.client,
      { tenantId: tenant.id, name: clientSeed.name },
      {
        ...clientSeed,
        tenantId: tenant.id,
      },
      clientSeed,
    );

    const clientUser = await tx.clientUser.upsert({
      where: { email: credentials.client.email },
      update: {
        password: clientPasswordHash,
        clientId: client.id,
        tenantId: tenant.id,
        refreshToken: null,
      },
      create: {
        email: credentials.client.email,
        password: clientPasswordHash,
        clientId: client.id,
        tenantId: tenant.id,
      },
    });

    const lead = await findOrCreate(
      tx.lead,
      { tenantId: tenant.id, company: client.companyName || client.name },
      {
        name: 'Acme Logistics Security Evaluation',
        company: client.companyName || client.name,
        email: client.email,
        status: 'qualified',
        tenantId: tenant.id,
      },
      {
        name: 'Acme Logistics Security Evaluation',
        email: client.email,
        status: 'qualified',
      },
    );

    const deal = await findOrCreate(
      tx.deal,
      { tenantId: tenant.id, name: 'Acme Logistics - Guarding Contract' },
      {
        name: 'Acme Logistics - Guarding Contract',
        stage: 'proposal',
        tenantId: tenant.id,
        leadId: lead.id,
        clientId: client.id,
      },
      {
        stage: 'proposal',
        leadId: lead.id,
        clientId: client.id,
      },
    );

    const proposalContent = [
      'Managed security proposal for Acme Logistics.',
      '',
      'Scope:',
      '- One trained guard assigned to the main logistics gate.',
      '- Daily shift coverage with incident reporting.',
      '- Client portal access for proposals, documents, and updates.',
      '',
      'This record is linked to the Neon demo client, lead, and deal so it appears in both the admin proposal section and the client portal.',
    ].join('\n');

    const proposal = await findOrCreate(
      tx.proposal,
      { tenantId: tenant.id, title: 'Acme Logistics Security Services Proposal' },
      {
        title: 'Acme Logistics Security Services Proposal',
        content: proposalContent,
        status: 'sent',
        tenantId: tenant.id,
        leadId: lead.id,
        dealId: deal.id,
        clientId: client.id,
      },
      {
        content: proposalContent,
        status: 'sent',
        leadId: lead.id,
        dealId: deal.id,
        clientId: client.id,
      },
    );

    await ensureProposalVersion(tx, proposal.id, proposalContent);

    await ensureComment(tx, {
      content: 'Admin shared this proposal with the client portal.',
      proposalId: proposal.id,
      userId: admin.id,
      tenantId: tenant.id,
    });

    await ensureComment(tx, {
      content: 'Client can review and approve this linked proposal.',
      proposalId: proposal.id,
      clientUserId: clientUser.id,
      tenantId: tenant.id,
    });

    const document = await findOrCreate(
      tx.sharedDocument,
      { tenantId: tenant.id, clientId: client.id, name: 'Acme Security Scope.pdf' },
      {
        name: 'Acme Security Scope.pdf',
        url: 'https://example.com/acme-security-scope.pdf',
        description: 'Demo shared document visible in the client portal.',
        clientId: client.id,
        tenantId: tenant.id,
        uploadedBy: admin.id,
      },
      {
        url: 'https://example.com/acme-security-scope.pdf',
        description: 'Demo shared document visible in the client portal.',
        uploadedBy: admin.id,
      },
    );

    const site = await findOrCreate(
      tx.site,
      { tenantId: tenant.id, clientId: client.id, name: 'Acme Logistics Main Gate' },
      {
        name: 'Acme Logistics Main Gate',
        address: '100 Neon Way, Demo City',
        instructions: 'Check trucks at Gate A and escalate incidents through the guard portal.',
        tenantId: tenant.id,
        clientId: client.id,
      },
      {
        address: '100 Neon Way, Demo City',
        instructions: 'Check trucks at Gate A and escalate incidents through the guard portal.',
        clientId: client.id,
      },
    );

    const guard = await findOrCreate(
      tx.guard,
      { tenantId: tenant.id, email: credentials.guard.email },
      {
        name: credentials.guard.name,
        phone: credentials.guard.phone,
        email: credentials.guard.email,
        passwordHash: guardPasswordHash,
        tenantId: tenant.id,
      },
      {
        name: credentials.guard.name,
        phone: credentials.guard.phone,
        email: credentials.guard.email,
        passwordHash: guardPasswordHash,
      },
    );

    await tx.availability.upsert({
      where: { guardId: guard.id },
      update: {
        status: 'available',
        startDate: null,
        endDate: null,
      },
      create: {
        guardId: guard.id,
        tenantId: tenant.id,
        status: 'available',
      },
    });

    const shiftStart = tomorrowAt(9);
    const shiftEnd = tomorrowAt(17);

    const shift = await findOrCreate(
      tx.shift,
      { tenantId: tenant.id, siteId: site.id, startTime: shiftStart },
      {
        siteId: site.id,
        startTime: shiftStart,
        endTime: shiftEnd,
        requiredGuards: 1,
        status: 'assigned',
        tenantId: tenant.id,
      },
      {
        endTime: shiftEnd,
        requiredGuards: 1,
        status: 'assigned',
      },
    );

    const assignment = await findOrCreate(
      tx.assignment,
      { shiftId: shift.id, guardId: guard.id },
      {
        shiftId: shift.id,
        guardId: guard.id,
        status: 'confirmed',
      },
      {
        status: 'confirmed',
      },
    );

    await ensureAuditLog(tx, {
      tenantId: tenant.id,
      userId: admin.id,
      action: 'NEON_DEMO_CREDENTIALS_LINKED',
      entityType: 'Tenant',
      entityId: tenant.id,
      details: 'Created/updated linked admin, client, guard, proposal, site, shift, and assignment demo records.',
    });

    await ensureAuditLog(tx, {
      tenantId: tenant.id,
      userId: admin.id,
      action: 'DOCUMENT_SHARED',
      entityType: 'Document',
      entityId: document.id,
      details: 'Demo document shared with the linked client.',
    });

    const verification = {
      adminTenantUsers: await tx.user.count({
        where: { tenantId: tenant.id, email: credentials.admin.email },
      }),
      clientPortalProposals: await tx.proposal.count({
        where: { tenantId: tenant.id, clientId: client.id },
      }),
      clientPortalDocuments: await tx.sharedDocument.count({
        where: { tenantId: tenant.id, clientId: client.id },
      }),
      guardAssignedShifts: await tx.assignment.count({
        where: {
          guardId: guard.id,
          shift: {
            tenantId: tenant.id,
            site: { clientId: client.id },
          },
        },
      }),
      proposalDealClientLinks: await tx.proposal.count({
        where: {
          id: proposal.id,
          tenantId: tenant.id,
          clientId: client.id,
          leadId: lead.id,
          dealId: deal.id,
        },
      }),
    };

    return {
      tenant,
      admin,
      client,
      clientUser,
      lead,
      deal,
      proposal,
      document,
      site,
      guard,
      shift,
      assignment,
      verification,
      targetHost: parsedUrl.hostname,
    };
  }, { maxWait: 10000, timeout: 60000 });

  console.log('--- NEON LINKED DEMO CREDENTIALS READY ---');
  console.log(`Database host: ${result.targetHost}`);
  console.log(`Tenant: ${result.tenant.name} (${result.tenant.slug})`);
  console.log('');
  console.log('Admin panel');
  console.log('Login URL: /login');
  console.log(`Email: ${credentials.admin.email}`);
  console.log(`Password: ${credentials.admin.password}`);
  console.log('');
  console.log('Client portal');
  console.log('Login URL: /client/login');
  console.log(`Email: ${credentials.client.email}`);
  console.log(`Password: ${credentials.client.password}`);
  console.log(`Linked client: ${result.client.name} (${result.client.id})`);
  console.log('');
  console.log('Guard portal');
  console.log('Login URL: /guard/login');
  console.log(`Identifier: ${credentials.guard.email}`);
  console.log(`Phone: ${credentials.guard.phone}`);
  console.log(`Password: ${credentials.guard.password}`);
  console.log(`Linked guard: ${result.guard.name} (${result.guard.id})`);
  console.log('');
  console.log('Relationship map');
  console.log(`Tenant -> ${result.tenant.id}`);
  console.log(`Client -> ${result.client.id}`);
  console.log(`ClientUser -> ${result.clientUser.id}`);
  console.log(`Lead -> ${result.lead.id}`);
  console.log(`Deal -> ${result.deal.id}`);
  console.log(`Proposal -> ${result.proposal.id}`);
  console.log(`Document -> ${result.document.id}`);
  console.log(`Site -> ${result.site.id}`);
  console.log(`Guard -> ${result.guard.id}`);
  console.log(`Shift -> ${result.shift.id}`);
  console.log(`Assignment -> ${result.assignment.id}`);
  console.log('');
  console.log('Link verification');
  console.log(`Admin user in tenant: ${result.verification.adminTenantUsers === 1 ? 'yes' : 'no'}`);
  console.log(`Client-visible proposals: ${result.verification.clientPortalProposals}`);
  console.log(`Client-visible documents: ${result.verification.clientPortalDocuments}`);
  console.log(`Guard assigned shifts for client site: ${result.verification.guardAssignedShifts}`);
  console.log(`Proposal linked to client + lead + deal: ${result.verification.proposalDealClientLinks === 1 ? 'yes' : 'no'}`);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
