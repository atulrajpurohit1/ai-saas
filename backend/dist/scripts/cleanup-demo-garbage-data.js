"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const TARGET_TENANT_ID = 'ef1b8e7e-5d01-4f08-ba69-0279dc8c9139';
const GARBAGE_LEAD_IDS = [
    'bc2b4448-69a4-4e39-b14e-5d9a14e5e1d9',
    'be052c8d-91a5-4055-80d6-37d502298b68',
    '85af23ec-cc69-49f5-8c7c-f233bb847777',
    '55f5a61b-17e5-4212-b057-f8ce03e94374',
    '24d5e701-c076-4c0f-ad03-7767f6926cba',
    'f9df493d-c330-4bb4-b28f-b1c3bdace7d1',
    'f969dfae-ff4f-4d69-aeff-7fea7ced0e03',
    'ae3369e6-7e81-4db3-9ed1-e360afc4c7e9',
    '0d0c89ab-a4e7-4a8f-b78d-f450ba7791ad',
];
const GARBAGE_INCIDENT_IDS = ['4de08de2-cce6-49ce-9409-17231b1a328b'];
const GARBAGE_CHECKPOINT_IDS = ['30842c6b-67fd-48a8-8ecb-91d6a2466cb2'];
const GARBAGE_PROPOSAL_IDS = [
    'd032e3f0-9bcf-4fe5-9bae-17454fae9155',
    '459ca3e5-f1cc-4217-855d-eb815621320e',
    '7dd25bb9-ed89-44e4-94f0-4d9b0a302f5e',
];
const GARBAGE_SITE_ID = '1a8bf0b3-4133-4619-a264-670a2e783084';
const REALISTIC_SITE_NAME = 'Riverbend Distribution Center';
const REALISTIC_SITE_ADDRESS = '4820 Riverbend Industrial Pkwy, Charlotte, NC 28208';
async function assertTenantScoped(label, records, expectedIds) {
    if (records.length !== expectedIds.length) {
        throw new Error(`${label}: expected ${expectedIds.length} record(s), found ${records.length}. Aborting — data may have changed since the audit.`);
    }
    for (const record of records) {
        if (record.tenantId !== TARGET_TENANT_ID) {
            throw new Error(`${label} ${record.id} belongs to tenant ${record.tenantId}, not the target tenant. Aborting.`);
        }
    }
}
async function main() {
    const leads = await prisma.lead.findMany({ where: { id: { in: GARBAGE_LEAD_IDS } } });
    await assertTenantScoped('Lead', leads, GARBAGE_LEAD_IDS);
    const incidents = await prisma.incident.findMany({ where: { id: { in: GARBAGE_INCIDENT_IDS } } });
    await assertTenantScoped('Incident', incidents, GARBAGE_INCIDENT_IDS);
    const checkpoints = await prisma.checkpoint.findMany({ where: { id: { in: GARBAGE_CHECKPOINT_IDS } } });
    await assertTenantScoped('Checkpoint', checkpoints, GARBAGE_CHECKPOINT_IDS);
    const proposals = await prisma.proposal.findMany({ where: { id: { in: GARBAGE_PROPOSAL_IDS } } });
    await assertTenantScoped('Proposal', proposals, GARBAGE_PROPOSAL_IDS);
    const site = await prisma.site.findUniqueOrThrow({ where: { id: GARBAGE_SITE_ID } });
    if (site.tenantId !== TARGET_TENANT_ID) {
        throw new Error(`Site ${GARBAGE_SITE_ID} belongs to tenant ${site.tenantId}, not the target tenant. Aborting.`);
    }
    console.log('Pre-delete verification passed. Cleaning up...\n');
    for (const proposal of proposals) {
        await prisma.$transaction([
            prisma.proposalVersion.deleteMany({ where: { proposalId: proposal.id } }),
            prisma.proposalComment.deleteMany({ where: { proposalId: proposal.id } }),
        ]);
        await prisma.proposal.delete({ where: { id: proposal.id } });
        console.log(`Deleted Proposal "${proposal.title}" (${proposal.id})`);
    }
    for (const lead of leads) {
        await prisma.$transaction([
            prisma.salesAssessment.deleteMany({ where: { leadId: lead.id } }),
            prisma.discoverySession.deleteMany({ where: { leadId: lead.id } }),
            prisma.note.deleteMany({ where: { leadId: lead.id } }),
            prisma.deal.deleteMany({ where: { leadId: lead.id } }),
            prisma.proposal.updateMany({ where: { leadId: lead.id }, data: { leadId: null } }),
        ]);
        await prisma.lead.delete({ where: { id: lead.id } });
        console.log(`Deleted Lead "${lead.name}" (${lead.id})`);
    }
    for (const checkpoint of checkpoints) {
        await prisma.$transaction([
            prisma.patrolEvent.deleteMany({ where: { checkpointId: checkpoint.id } }),
            prisma.patrolRouteCheckpoint.deleteMany({ where: { checkpointId: checkpoint.id } }),
        ]);
        await prisma.checkpoint.delete({ where: { id: checkpoint.id } });
        console.log(`Deleted Checkpoint "${checkpoint.name}" (${checkpoint.id})`);
    }
    for (const incident of incidents) {
        await prisma.incident.delete({ where: { id: incident.id } });
        console.log(`Deleted Incident "${incident.title}" (${incident.id})`);
    }
    await prisma.site.update({
        where: { id: GARBAGE_SITE_ID },
        data: { name: REALISTIC_SITE_NAME, address: REALISTIC_SITE_ADDRESS },
    });
    console.log(`Renamed Site "${site.name}" -> "${REALISTIC_SITE_NAME}" (${GARBAGE_SITE_ID})`);
    const rateCards = await prisma.rateCard.findMany({ where: { tenantId: TARGET_TENANT_ID } });
    for (const card of rateCards) {
        const plausibleOvertime = Math.round(card.hourlyRate * 1.5 * 100) / 100;
        const plausibleHoliday = Math.round(card.hourlyRate * 2 * 100) / 100;
        const needsFix = (card.overtimeRate && (card.overtimeRate > card.hourlyRate * 5 || card.overtimeRate < card.hourlyRate)) ||
            (card.holidayRate && (card.holidayRate > card.hourlyRate * 5 || card.holidayRate < card.hourlyRate));
        if (needsFix) {
            await prisma.rateCard.update({
                where: { id: card.id },
                data: { overtimeRate: plausibleOvertime, holidayRate: plausibleHoliday },
            });
            console.log(`Fixed RateCard ${card.id}: overtime ${card.overtimeRate} -> ${plausibleOvertime}, holiday ${card.holidayRate} -> ${plausibleHoliday}`);
        }
    }
    const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: TARGET_TENANT_ID } });
    if (branding?.supportPhone) {
        const digits = branding.supportPhone.replace(/\D/g, '');
        let formatted = branding.supportPhone;
        if (digits.length === 11 && digits.startsWith('1')) {
            formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        else if (digits.length === 10) {
            formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        if (formatted !== branding.supportPhone) {
            await prisma.tenantBranding.update({
                where: { tenantId: TARGET_TENANT_ID },
                data: { supportPhone: formatted },
            });
            console.log(`Reformatted branding support_phone: "${branding.supportPhone}" -> "${formatted}"`);
        }
    }
    console.log('\nCleanup complete.');
}
main()
    .catch((err) => {
    console.error(err);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=cleanup-demo-garbage-data.js.map