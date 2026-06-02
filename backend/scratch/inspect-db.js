const fs = require('fs');
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

const expectedTables = [
  'Activity',
  'AiFeedback',
  'AiGeneration',
  'Assignment',
  'AttendanceEvent',
  'AuditLog',
  'Availability',
  'Client',
  'ClientUser',
  'DailyServiceReport',
  'Deal',
  'Guard',
  'Incident',
  'Invoice',
  'InvoiceDispute',
  'InvoiceItem',
  'Lead',
  'Note',
  'Proposal',
  'ProposalComment',
  'ProposalVersion',
  'RateCard',
  'RecommendationAction',
  'SharedDocument',
  'Shift',
  'Site',
  'Tenant',
  'Timesheet',
  'User',
  '_prisma_migrations',
];

loadEnv('.env');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const url = new URL(databaseUrl);
const prisma = new PrismaClient();

async function inspectSchema() {
  const connection = await prisma.$queryRaw`
    SELECT current_database() AS database, current_schema() AS schema
  `;

  const tables = await prisma.$queryRaw`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  const foreignKeys = await prisma.$queryRaw`
    SELECT
      conname AS constraint_name,
      conrelid::regclass::text AS table_name,
      confrelid::regclass::text AS references_table,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `;

  const indexes = await prisma.$queryRaw`
    SELECT tablename AS table_name, indexname AS index_name
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;

  const tableNames = tables.map((row) => row.table_name);
  const missingTables = expectedTables.filter((table) => !tableNames.includes(table));

  console.log('target_host=' + url.hostname);
  console.log('target_database=' + url.pathname.replace(/^\//, ''));
  console.log('sslmode=' + url.searchParams.get('sslmode'));
  console.log('current_database=' + connection[0].database);
  console.log('current_schema=' + connection[0].schema);
  console.log('table_count=' + tableNames.length);
  console.log('tables=' + tableNames.join(', '));
  console.log('missing_expected_tables=' + (missingTables.length ? missingTables.join(', ') : 'none'));
  console.log('foreign_key_count=' + foreignKeys.length);
  console.log(
    'foreign_keys=' +
      foreignKeys
        .map((fk) => `${fk.table_name}.${fk.constraint_name}->${fk.references_table}`)
        .join(', '),
  );
  console.log('index_count=' + indexes.length);
  console.log(
    'indexes=' +
      indexes.map((index) => `${index.table_name}.${index.index_name}`).join(', '),
  );
}

async function runCrudSmokeTest() {
  const stamp = Date.now();
  const start = new Date('2026-06-02T09:00:00.000Z');
  const end = new Date('2026-06-02T17:00:00.000Z');
  const checks = [];

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `Neon QA Tenant ${stamp}`,
          slug: `neon-qa-${stamp}`,
        },
      });
      checks.push('Tenant create/read');

      const user = await tx.user.create({
        data: {
          email: `neon.qa.user.${stamp}@example.com`,
          password: 'test-password-hash',
          name: 'Neon QA User',
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      });
      await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: { refreshToken: 'test-refresh-token' },
      });
      checks.push('Authentication/User queries');

      const lead = await tx.lead.create({
        data: {
          name: 'Neon QA Lead',
          company: 'Neon QA Company',
          email: `lead.${stamp}@example.com`,
          tenantId: tenant.id,
        },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'qualified' } });
      await tx.lead.findMany({ where: { tenantId: tenant.id } });
      checks.push('Leads CRUD');

      const disposableLead = await tx.lead.create({
        data: {
          name: 'Disposable Lead',
          company: 'Disposable Company',
          tenantId: tenant.id,
        },
      });
      const disposableDeal = await tx.deal.create({
        data: {
          name: 'Disposable Deal',
          tenantId: tenant.id,
          leadId: disposableLead.id,
        },
      });
      await tx.deal.delete({ where: { id: disposableDeal.id } });
      await tx.lead.delete({ where: { id: disposableLead.id } });

      const client = await tx.client.create({
        data: {
          name: 'Neon QA Client',
          companyName: 'Neon QA Client Co',
          email: `client.${stamp}@example.com`,
          phone: '+15550000000',
          tenantId: tenant.id,
        },
      });
      await tx.client.update({
        where: { id: client.id },
        data: { phone: '+15550000001' },
      });
      await tx.client.findFirstOrThrow({ where: { id: client.id, tenantId: tenant.id } });
      await tx.clientUser.create({
        data: {
          email: `client.user.${stamp}@example.com`,
          password: 'test-password-hash',
          clientId: client.id,
          tenantId: tenant.id,
        },
      });
      checks.push('Clients CRUD/client-user');

      const deal = await tx.deal.create({
        data: {
          name: 'Neon QA Deal',
          tenantId: tenant.id,
          leadId: lead.id,
          clientId: client.id,
        },
      });
      await tx.deal.update({ where: { id: deal.id }, data: { stage: 'proposal' } });
      await tx.deal.findFirstOrThrow({ where: { id: deal.id, tenantId: tenant.id } });
      checks.push('Deals CRUD');

      const note = await tx.note.create({
        data: {
          content: 'Neon QA note',
          tenantId: tenant.id,
          leadId: lead.id,
          dealId: deal.id,
        },
      });
      await tx.note.findMany({ where: { tenantId: tenant.id } });
      await tx.note.delete({ where: { id: note.id } });
      checks.push('Notes CRUD');

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'NEON_QA',
          entityType: 'Tenant',
          entityId: tenant.id,
          details: 'Migration verification audit event',
        },
      });
      await tx.auditLog.findMany({ where: { tenantId: tenant.id } });
      checks.push('Audit logs CRUD');

      const proposal = await tx.proposal.create({
        data: {
          title: 'Neon QA Proposal',
          content: 'Proposal content',
          tenantId: tenant.id,
          leadId: lead.id,
          dealId: deal.id,
          clientId: client.id,
        },
      });
      await tx.proposalVersion.create({
        data: {
          proposalId: proposal.id,
          content: proposal.content,
          versionNumber: 1,
        },
      });
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: 'sent', content: 'Updated proposal content' },
      });
      await tx.proposalComment.create({
        data: {
          content: 'Looks good',
          proposalId: proposal.id,
          userId: user.id,
          tenantId: tenant.id,
        },
      });
      await tx.sharedDocument.create({
        data: {
          name: 'Neon QA Doc',
          url: 'https://example.com/neon-qa.pdf',
          clientId: client.id,
          tenantId: tenant.id,
          uploadedBy: user.id,
        },
      });
      await tx.proposal.findFirstOrThrow({
        where: { id: proposal.id, tenantId: tenant.id },
        include: { versions: true, comments: true },
      });
      checks.push('Proposals CRUD/comments/share');

      const site = await tx.site.create({
        data: {
          name: 'Neon QA Site',
          address: '1 Neon Way',
          tenantId: tenant.id,
          clientId: client.id,
        },
      });

      const guard = await tx.guard.create({
        data: {
          name: 'Neon QA Guard',
          phone: '+15551112222',
          email: `guard.${stamp}@example.com`,
          passwordHash: 'test-password-hash',
          tenantId: tenant.id,
        },
      });
      await tx.guard.update({
        where: { id: guard.id },
        data: { phone: '+15552223333' },
      });
      await tx.availability.upsert({
        where: { guardId: guard.id },
        create: {
          guardId: guard.id,
          tenantId: tenant.id,
          status: 'available',
        },
        update: { status: 'available' },
      });
      await tx.guard.findFirstOrThrow({
        where: { id: guard.id, tenantId: tenant.id },
        include: { availability: true },
      });
      checks.push('Guards CRUD/availability');

      const shift = await tx.shift.create({
        data: {
          siteId: site.id,
          startTime: start,
          endTime: end,
          requiredGuards: 1,
          tenantId: tenant.id,
        },
      });
      await tx.assignment.create({
        data: {
          shiftId: shift.id,
          guardId: guard.id,
          status: 'confirmed',
        },
      });
      await tx.attendanceEvent.create({
        data: {
          guardId: guard.id,
          shiftId: shift.id,
          type: 'CHECK_IN',
          tenantId: tenant.id,
        },
      });
      checks.push('Shift/assignment/attendance relations');

      const incident = await tx.incident.create({
        data: {
          tenantId: tenant.id,
          shiftId: shift.id,
          siteId: site.id,
          guardId: guard.id,
          title: 'Neon QA Incident',
          description: 'Smoke-test incident',
          severity: 'low',
          occurredAt: start,
        },
      });
      await tx.incident.update({
        where: { id: incident.id },
        data: {
          status: 'approved',
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: 'Verified during Neon migration',
        },
      });
      await tx.incident.findFirstOrThrow({
        where: { id: incident.id, tenantId: tenant.id },
        include: { reviewedBy: true, guard: true, shift: true, site: true },
      });
      checks.push('Incidents CRUD/review');

      await tx.dailyServiceReport.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          siteId: site.id,
          reportDate: start,
          summary: 'All clear',
        },
      });

      const rateCard = await tx.rateCard.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          siteId: site.id,
          roleName: 'Security Guard',
          hourlyRate: 25,
          effectiveFrom: start,
        },
      });

      const timesheet = await tx.timesheet.create({
        data: {
          tenantId: tenant.id,
          guardId: guard.id,
          shiftId: shift.id,
          siteId: site.id,
          clientId: client.id,
          checkInTime: start,
          checkOutTime: end,
          totalHours: 8,
          status: 'approved',
          approvedBy: user.id,
          approvedAt: end,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          siteId: site.id,
          invoiceNumber: `NEON-QA-${stamp}`,
          billingStartDate: start,
          billingEndDate: end,
          totalHours: 8,
          hourlyRate: 25,
          subtotal: 200,
          tax: 0,
          totalAmount: 200,
          status: 'issued',
          issuedAt: end,
          dueDate: new Date('2026-06-30T00:00:00.000Z'),
          rateCardId: rateCard.id,
          rateSource: 'rate_card',
        },
      });
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          timesheetId: timesheet.id,
          rateCardId: rateCard.id,
          shiftId: shift.id,
          guardId: guard.id,
          workedHours: 8,
          hourlyRate: 25,
          amount: 200,
        },
      });
      await tx.invoiceDispute.create({
        data: {
          invoiceId: invoice.id,
          clientId: client.id,
          tenantId: tenant.id,
          reason: 'qa',
          description: 'Smoke-test dispute',
        },
      });
      await Promise.all([
        tx.invoice.findMany({ where: { tenantId: tenant.id }, include: { items: true, disputes: true } }),
        tx.invoiceDispute.findMany({ where: { tenantId: tenant.id } }),
        tx.rateCard.findMany({ where: { tenantId: tenant.id } }),
        tx.timesheet.findMany({ where: { tenantId: tenant.id } }),
      ]);
      checks.push('Finance CRUD/reporting queries');

      const aiGeneration = await tx.aiGeneration.create({
        data: {
          tenantId: tenant.id,
          promptVersion: 'qa-v1',
          modelUsed: 'qa-model',
          sourceModule: 'ai-insights',
          generatedOutput: { summary: 'ok' },
          createdBy: user.id,
        },
      });
      const action = await tx.recommendationAction.create({
        data: {
          tenantId: tenant.id,
          aiGenerationId: aiGeneration.id,
          recommendationId: `rec-${stamp}`,
          actionType: 'create_follow_up_task',
          title: 'QA Action',
          description: 'Smoke-test action',
          targetModule: 'clients',
          targetEntityId: client.id,
        },
      });
      await tx.aiFeedback.create({
        data: {
          tenantId: tenant.id,
          aiGenerationId: aiGeneration.id,
          recommendationId: `rec-${stamp}`,
          actionId: action.id,
          rating: 5,
          feedbackText: 'Accurate',
          isUseful: true,
          isAccurate: true,
          createdBy: user.id,
        },
      });
      await Promise.all([
        tx.client.findMany({ where: { tenantId: tenant.id } }),
        tx.guard.findMany({ where: { tenantId: tenant.id } }),
        tx.site.findMany({ where: { tenantId: tenant.id } }),
        tx.shift.findMany({ where: { tenantId: tenant.id } }),
        tx.incident.findMany({ where: { tenantId: tenant.id } }),
        tx.invoice.findMany({ where: { tenantId: tenant.id } }),
        tx.aiGeneration.findMany({ where: { tenantId: tenant.id } }),
        tx.recommendationAction.findMany({ where: { tenantId: tenant.id } }),
        tx.aiFeedback.findMany({ where: { tenantId: tenant.id } }),
      ]);
      checks.push('AI insights/monitoring queries');

      throw new Error('ROLLBACK_OK');
    }, { maxWait: 10000, timeout: 120000 });
  } catch (error) {
    if (error.message !== 'ROLLBACK_OK') {
      throw error;
    }
  }

  console.log('crud_smoke_status=passed_rolled_back');
  console.log('crud_smoke_checks=' + checks.join('; '));
}

async function main() {
  await prisma.$connect();
  await inspectSchema();
  await runCrudSmokeTest();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('verification_error=' + (error.stack || error.message));
  await prisma.$disconnect();
  process.exit(1);
});
