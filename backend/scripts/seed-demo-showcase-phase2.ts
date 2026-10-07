/**
 * Phase 2 of the demo seed: fills the parts of AegisLead Complete that
 * seed-demo-showcase.ts left empty, so every screen in the sidebar has
 * something on it and the whole product can be demonstrated.
 *
 * Phase 1 covered the three core modules (leads/deals, guards/patrols,
 * timesheets/invoices). The screens below were still blank, which is exactly
 * the gap the account owner asked to close:
 *
 *   RFP Management      Rfp + RfpVendor + ProposalSubmission + EvaluationReport
 *                       + RfpRequirementAnalysis, across every RfpStatus
 *   Vendors             Vendor + VendorPerformance review history
 *   Sales Accelerator   DiscoverySession + SalesAssessment (scores/tiers)
 *   Sales Calls         CallRecord across every outcome
 *   Proposals           ProposalComment threads on existing proposals
 *   Documents           SharedDocument per client
 *   Patrol Monitor      EmergencyAlert in all three states
 *   Branding            TenantBranding + a verified CustomDomain
 *   Integrations        ApiKey + Webhook + WebhookDelivery + ApiRequestLog
 *   Roles/Team          extra staff Users with real role assignments
 *
 * Deliberately NOT seeded:
 *   - IncidentEvidence / PatrolEvidence. Those rows point at files on disk (or
 *     B2); a row without its file renders as a broken thumbnail, which demos
 *     worse than an empty state. They need real uploads, not fixtures.
 *   - AiGeneration / AiFeedback / PromptVersion. These are the audit trail of
 *     real model calls; faking them would misrepresent what the AI actually
 *     did. The Sales Accelerator screens read DiscoverySession and
 *     SalesAssessment, which ARE seeded, so that section still demos.
 *   - CrmConnection. Needs CRM_TOKEN_SECRET and real OAuth tokens.
 *
 * Same safety model as phase 1: scoped to the one tenant resolved from
 * --email, dry run unless --apply, and --reset clears only what this script
 * writes.
 *
 *   npx ts-node -T scripts/seed-demo-showcase-phase2.ts --email=demo@aegislead.co
 *   npx ts-node -T scripts/seed-demo-showcase-phase2.ts --email=demo@aegislead.co --apply
 *   npx ts-node -T scripts/seed-demo-showcase-phase2.ts --email=demo@aegislead.co --reset --apply
 */
import {
  PrismaClient,
  Prisma,
  RfpStatus,
  VendorStatus,
  InvitationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'node:crypto';

const prisma = new PrismaClient();

const BCRYPT_PASSWORD_ROUNDS = 12;
/**
 * One shared password for every demo login, printed at the end.
 *
 * Read from DEMO_SEED_PASSWORD so the real credential is not committed - this
 * repo is public, and the demo tenant lives on the production database, so a
 * literal here would be a working published login. Falls back to a throwaway
 * value: override it in .env (or `--password=`) before seeding an account
 * anyone will actually be shown.
 */
const DEMO_PASSWORD =
  arg('password') ?? process.env.DEMO_SEED_PASSWORD ?? 'ChangeMe-Demo-Seed-1';
const DAY_MS = 24 * 60 * 60 * 1000;

function arg(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!match) return undefined;
  return match.slice(`--${name}=`.length);
}

function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return new Date(d.getTime() - n * DAY_MS);
}

function daysAhead(n: number, hour = 10, minute = 0): Date {
  return daysAgo(-n, hour, minute);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Subcontractors the agency puts out to tender. Invented names. */
const VENDORS = [
  {
    key: 'v-sentinel',
    companyName: 'Sentinel Protective Services',
    contactPerson: 'Rebecca Hahn',
    email: 'rfp@sentinelprotective.example',
    phone: '+1-312-555-0401',
    address: '180 N Michigan Ave, Chicago, IL 60601',
    services: ['Manned Guarding', 'Mobile Patrol', 'Event Security'],
    notes: 'Strong on manned guarding. Used them twice for overflow coverage.',
    status: VendorStatus.ACTIVE,
  },
  {
    key: 'v-ironclad',
    companyName: 'Ironclad Security Group',
    contactPerson: 'Dale Prescott',
    email: 'bids@ironcladsecurity.example',
    phone: '+1-312-555-0402',
    address: '55 W Monroe St, Chicago, IL 60603',
    services: ['Manned Guarding', 'Access Control', 'CCTV Monitoring'],
    notes: 'Competitive on price. Documentation is sometimes late.',
    status: VendorStatus.ACTIVE,
  },
  {
    key: 'v-northgate',
    companyName: 'Northgate Risk Partners',
    contactPerson: 'Yvonne Clarke',
    email: 'proposals@northgaterisk.example',
    phone: '+1-847-555-0403',
    address: '1700 Sherman Ave, Evanston, IL 60201',
    services: ['Risk Assessment', 'Executive Protection', 'Consulting'],
    notes: 'Premium pricing, excellent reporting. Best fit for sensitive sites.',
    status: VendorStatus.ACTIVE,
  },
  {
    key: 'v-bluehawk',
    companyName: 'Blue Hawk Facility Services',
    contactPerson: 'Sam Oyelaran',
    email: 'tenders@bluehawkfs.example',
    phone: '+1-847-555-0404',
    address: '900 Skokie Blvd, Northbrook, IL 60062',
    services: ['Manned Guarding', 'Janitorial', 'Facilities'],
    notes: 'Bundles facilities work. Guard quality is inconsistent.',
    status: VendorStatus.ACTIVE,
  },
  {
    key: 'v-castellan',
    companyName: 'Castellan Security LLC',
    contactPerson: 'Marta Reyes',
    email: 'info@castellansec.example',
    phone: '+1-312-555-0405',
    address: '411 S Wells St, Chicago, IL 60607',
    services: ['Mobile Patrol', 'Alarm Response'],
    notes: 'Did not respond to the last two invitations. Marked inactive.',
    status: VendorStatus.INACTIVE,
  },
];


/**
 * RFPs across every RfpStatus, so the RFP pipeline view has a row in each
 * state rather than one lonely draft.
 */
const RFPS: {
  key: string;
  title: string;
  clientName: string;
  companyName: string;
  industry: string;
  projectName: string;
  status: RfpStatus;
  ageDays: number;
  dueInDays: number;
  estimatedBudget: number;
  securityTypes: string[];
  numberOfLocations: number;
  address: string;
  operatingHours: string;
  guardsRequired: number;
  pricingModel: string;
  paymentTerms: string;
  additionalRequirements: string;
  /** vendor keys invited, in order */
  invited: string[];
  /** how far each invited vendor got */
  invitationStates: InvitationStatus[];
  awardedVendorKey?: string;
  generated?: boolean;
}[] = [
  {
    key: 'rfp-overflow',
    title: 'Overflow Guarding - Q4 Retail Season',
    clientName: 'Marcus Bell',
    companyName: 'Lakeshore Commons Mall',
    industry: 'Retail',
    projectName: 'Holiday season overflow coverage',
    status: RfpStatus.AWARDED,
    ageDays: 68,
    dueInDays: -40,
    estimatedBudget: 185000,
    securityTypes: ['Manned Guarding', 'Mobile Patrol'],
    numberOfLocations: 2,
    address: '200 E Randolph St, Chicago, IL 60601',
    operatingHours: '7 days, 08:00-23:00 with extended hours in December',
    guardsRequired: 8,
    pricingModel: 'Hourly rate per officer',
    paymentTerms: 'Net 30',
    additionalRequirements:
      'All officers must complete retail de-escalation training before first shift. Lost-child protocol briefing is mandatory.',
    invited: ['v-sentinel', 'v-ironclad', 'v-bluehawk'],
    invitationStates: [
      InvitationStatus.SUBMITTED,
      InvitationStatus.SUBMITTED,
      InvitationStatus.VIEWED,
    ],
    awardedVendorKey: 'v-sentinel',
    generated: true,
  },
  {
    key: 'rfp-datacentre',
    title: 'Specialist Coverage - Data Centre Expansion',
    clientName: 'Priya Raman',
    companyName: 'Northpoint Data Centre',
    industry: 'Data Centres / Colocation',
    projectName: 'DC2 build-out security',
    status: RfpStatus.EVALUATED,
    ageDays: 34,
    dueInDays: -6,
    estimatedBudget: 240000,
    securityTypes: ['Manned Guarding', 'Access Control', 'CCTV Monitoring'],
    numberOfLocations: 1,
    address: '3300 Lakeview Pkwy, Evanston, IL 60201',
    operatingHours: '24/7/365',
    guardsRequired: 6,
    pricingModel: 'Hourly rate per officer, separate rate for SOC operator',
    paymentTerms: 'Net 30',
    additionalRequirements:
      'Background check on file for every assigned officer before site access. Two-person rule in cage aisles. No personal devices past the SOC door.',
    invited: ['v-northgate', 'v-ironclad', 'v-sentinel'],
    invitationStates: [
      InvitationStatus.SUBMITTED,
      InvitationStatus.SUBMITTED,
      InvitationStatus.SUBMITTED,
    ],
    generated: true,
  },
  {
    key: 'rfp-campus',
    title: 'Campus Security Services - Academic Year',
    clientName: 'Alice Nwosu',
    companyName: 'Beacon Hill Academy',
    industry: 'Education',
    projectName: 'Campus coverage renewal',
    status: RfpStatus.FINALIZED,
    ageDays: 17,
    dueInDays: 11,
    estimatedBudget: 96000,
    securityTypes: ['Manned Guarding', 'Visitor Screening'],
    numberOfLocations: 1,
    address: '55 W Schiller St, Chicago, IL 60610',
    operatingHours: 'Mon-Fri 06:30-18:00 during term',
    guardsRequired: 3,
    pricingModel: 'Hourly rate per officer',
    paymentTerms: 'Net 30',
    additionalRequirements:
      'Child safeguarding module required for every officer. No armed posts under any circumstances. Officers must be DBS-equivalent checked.',
    invited: ['v-sentinel', 'v-northgate'],
    invitationStates: [InvitationStatus.VIEWED, InvitationStatus.INVITED],
    generated: true,
  },
  {
    key: 'rfp-yard',
    title: 'Distribution Yard Security - Multi-Site',
    clientName: 'Tom Alvarez',
    companyName: 'Granite Ridge Logistics',
    industry: 'Logistics & Warehousing',
    projectName: 'Yard and cold storage coverage',
    status: RfpStatus.GENERATED,
    ageDays: 8,
    dueInDays: 19,
    estimatedBudget: 132000,
    securityTypes: ['Manned Guarding', 'Gatehouse / Access Control'],
    numberOfLocations: 2,
    address: '910 Industrial Dr, Skokie, IL 60076',
    operatingHours: '24/7, heaviest traffic 05:00-09:00',
    guardsRequired: 4,
    pricingModel: 'Hourly rate per officer',
    paymentTerms: 'Net 45',
    additionalRequirements:
      'Seal verification on every inbound and outbound trailer. North fence line is unlit - vendor to price in portable lighting.',
    invited: ['v-bluehawk', 'v-castellan'],
    invitationStates: [InvitationStatus.INVITED, InvitationStatus.PENDING],
    generated: true,
  },
  {
    key: 'rfp-tower',
    title: 'Concierge and Dock Security - Harborview Tower',
    clientName: 'Grace Lindqvist',
    companyName: 'Harborview Tower',
    industry: 'Commercial Real Estate',
    projectName: 'Garage coverage extension',
    status: RfpStatus.DRAFT,
    ageDays: 2,
    dueInDays: 28,
    estimatedBudget: 74000,
    securityTypes: ['Manned Guarding', 'Mobile Patrol'],
    numberOfLocations: 1,
    address: '401 N Wabash Ave, Chicago, IL 60611',
    operatingHours: 'Garage patrol 18:00-06:00',
    guardsRequired: 2,
    pricingModel: 'Hourly rate per officer',
    paymentTerms: 'Net 30',
    additionalRequirements:
      'Extension of the existing lobby contract to cover the parking structure. Still being scoped with the property manager.',
    invited: [],
    invitationStates: [],
  },
];

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/** Only what THIS script writes. Phase 1 data is left untouched. */
async function resetPhase2(tenantId: string) {
  await prisma.$transaction(
    async (tx) => {
      await tx.vendorPerformance.deleteMany({ where: { tenantId } });
      await tx.evaluationReport.deleteMany({ where: { tenantId } });
      await tx.rfpRequirementAnalysis.deleteMany({ where: { tenantId } });
      await tx.proposalSubmission.deleteMany({ where: { tenantId } });
      await tx.rfpVendor.deleteMany({ where: { tenantId } });
      // Rfp.awardedVendorId points at Vendor; clear it before deleting vendors.
      await tx.rfp.updateMany({ where: { tenantId }, data: { awardedVendorId: null } });
      await tx.rfp.deleteMany({ where: { tenantId } });
      await tx.vendor.deleteMany({ where: { tenantId } });

      await tx.salesAssessment.deleteMany({ where: { tenantId } });
      await tx.discoverySession.deleteMany({ where: { tenantId } });
      await tx.callRecord.deleteMany({ where: { tenantId } });
      await tx.proposalComment.deleteMany({ where: { tenantId } });
      await tx.sharedDocument.deleteMany({ where: { tenantId } });

      await tx.emergencyAlert.deleteMany({ where: { tenantId } });

      await tx.webhookDelivery.deleteMany({ where: { webhook: { tenantId } } });
      await tx.webhook.deleteMany({ where: { tenantId } });
      await tx.apiRequestLog.deleteMany({ where: { tenantId } });
      await tx.apiKey.deleteMany({ where: { tenantId } });
      await tx.customDomain.deleteMany({ where: { tenantId } });
      await tx.tenantBranding.deleteMany({ where: { tenantId } });

      // Staff users this script added (never the owner account).
      const seeded = await tx.user.findMany({
        where: { tenantId, email: { endsWith: '@aegislead-demo.example' } },
        select: { id: true },
      });
      const ids = seeded.map((u) => u.id);
      if (ids.length) {
        await tx.userRoleAssignment.deleteMany({ where: { userId: { in: ids } } });
        await tx.userSession.deleteMany({ where: { userId: { in: ids } } });
        await tx.branch.updateMany({
          where: { tenantId, managerId: { in: ids } },
          data: { managerId: null },
        });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      }
    },
    { timeout: 120000 },
  );
}

async function countPhase2(tenantId: string) {
  const w = { tenantId };
  const [
    vendors, rfps, discoverySessions, salesAssessments, callRecords,
    proposalComments, sharedDocuments, emergencyAlerts, apiKeys, webhooks,
    branding, customDomains, staffUsers,
  ] = await Promise.all([
    prisma.vendor.count({ where: w }),
    prisma.rfp.count({ where: w }),
    prisma.discoverySession.count({ where: w }),
    prisma.salesAssessment.count({ where: w }),
    prisma.callRecord.count({ where: w }),
    prisma.proposalComment.count({ where: w }),
    prisma.sharedDocument.count({ where: w }),
    prisma.emergencyAlert.count({ where: w }),
    prisma.apiKey.count({ where: w }),
    prisma.webhook.count({ where: w }),
    prisma.tenantBranding.count({ where: w }),
    prisma.customDomain.count({ where: w }),
    prisma.user.count({ where: { tenantId, email: { endsWith: '@aegislead-demo.example' } } }),
  ]);
  const counts = {
    vendors, rfps, discoverySessions, salesAssessments, callRecords,
    proposalComments, sharedDocuments, emergencyAlerts, apiKeys, webhooks,
    branding, customDomains, staffUsers,
  };
  return { counts, total: Object.values(counts).reduce((s, n) => s + n, 0) };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedPhase2(tenantId: string, adminUserId: string) {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  // Phase 1 records this builds on. Read, never written.
  const [clients, sites, guards, branches, proposals, leads, deals] = await Promise.all([
    prisma.client.findMany({ where: { tenantId }, select: { id: true, companyName: true, name: true } }),
    prisma.site.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.guard.findMany({ where: { tenantId }, select: { id: true, name: true, branchId: true } }),
    prisma.branch.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.proposal.findMany({ where: { tenantId }, select: { id: true, title: true, status: true } }),
    prisma.lead.findMany({ where: { tenantId }, select: { id: true, company: true, name: true } }),
    prisma.deal.findMany({ where: { tenantId }, select: { id: true, name: true, leadId: true, stage: true } }),
  ]);

  if (!clients.length || !guards.length) {
    throw new Error(
      'This tenant has no phase-1 data (clients/guards). Run seed-demo-showcase.ts first.',
    );
  }

  const clientByCompany = new Map(clients.map((c) => [c.companyName ?? c.name, c]));
  const leadByCompany = new Map(leads.map((l) => [l.company, l]));
  const downtown = branches.find((b) => b.name.startsWith('Downtown')) ?? branches[0];
  const northside = branches.find((b) => b.name.startsWith('North')) ?? branches[0];

  // --- Vendors ------------------------------------------------------------
  const vendorIds: Record<string, string> = {};
  for (const v of VENDORS) vendorIds[v.key] = randomUUID();

  await prisma.vendor.createMany({
    data: VENDORS.map((v, i) => ({
      id: vendorIds[v.key],
      tenantId,
      companyName: v.companyName,
      contactPerson: v.contactPerson,
      email: v.email,
      phone: v.phone,
      address: v.address,
      services: v.services as Prisma.InputJsonValue,
      notes: v.notes,
      status: v.status,
      createdBy: adminUserId,
      createdAt: daysAgo(150 - i * 11),
    })),
  });
  bump('vendors', VENDORS.length);

  // --- RFPs, invitations, submissions, evaluations -------------------------
  for (const spec of RFPS) {
    const rfpId = randomUUID();

    await prisma.rfp.create({
      data: {
        id: rfpId,
        tenantId,
        title: spec.title,
        clientName: spec.clientName,
        companyName: spec.companyName,
        industry: spec.industry,
        projectName: spec.projectName,
        dueDate: daysAhead(spec.dueInDays),
        startDate: daysAhead(spec.dueInDays + 21),
        endDate: daysAhead(spec.dueInDays + 386),
        estimatedBudget: spec.estimatedBudget,
        securityTypes: spec.securityTypes as Prisma.InputJsonValue,
        numberOfLocations: spec.numberOfLocations,
        address: spec.address,
        operatingHours: spec.operatingHours,
        guardsRequired: spec.guardsRequired,
        pricingModel: spec.pricingModel,
        requiredPricingItems: [
          'Hourly officer rate',
          'Overtime rate',
          'Holiday rate',
          'Supervisor rate',
          'One-off mobilisation cost',
        ] as Prisma.InputJsonValue,
        paymentTerms: spec.paymentTerms,
        pricingValidity: '90 days from submission',
        pricingNotes: 'All rates to be quoted inclusive of insurance, uniform and statutory costs.',
        additionalRequirements: spec.additionalRequirements,
        generatedContent: spec.generated
          ? buildRfpDocument(spec)
          : null,
        status: spec.status,
        awardedVendorId: spec.awardedVendorKey ? vendorIds[spec.awardedVendorKey] : null,
        awardDate: spec.awardedVendorKey ? daysAgo(spec.ageDays - 50) : null,
        awardNotes: spec.awardedVendorKey
          ? 'Awarded on the combination of price and the retail de-escalation training commitment. Runner-up priced 4% lower but could not evidence the training.'
          : null,
        rejectedVendorIds: (spec.awardedVendorKey
          ? spec.invited.filter((k) => k !== spec.awardedVendorKey).map((k) => vendorIds[k])
          : []) as Prisma.InputJsonValue,
        createdBy: adminUserId,
        createdAt: daysAgo(spec.ageDays),
      },
    });
    bump('rfps');

    // Invitations + submissions.
    for (const [index, vendorKey] of spec.invited.entries()) {
      const state = spec.invitationStates[index] ?? InvitationStatus.PENDING;
      const rfpVendorId = randomUUID();
      const invitedAt = daysAgo(spec.ageDays - 2);

      await prisma.rfpVendor.create({
        data: {
          id: rfpVendorId,
          tenantId,
          rfpId,
          vendorId: vendorIds[vendorKey],
          // Opaque token, same shape the invite flow issues.
          invitationToken: state === InvitationStatus.PENDING ? null : randomBytes(24).toString('hex'),
          invitationStatus: state,
          invitedAt: state === InvitationStatus.PENDING ? null : invitedAt,
          viewedAt:
            state === InvitationStatus.VIEWED || state === InvitationStatus.SUBMITTED
              ? daysAgo(spec.ageDays - 5)
              : null,
          submittedAt: state === InvitationStatus.SUBMITTED ? daysAgo(spec.ageDays - 9) : null,
          createdAt: invitedAt,
        },
      });
      bump('rfpVendors');

      if (state === InvitationStatus.SUBMITTED) {
        const vendor = VENDORS.find((v) => v.key === vendorKey)!;
        await prisma.proposalSubmission.create({
          data: {
            tenantId,
            rfpVendorId,
            // File columns hold the stored filename the portal would have
            // written. Left null here: a filename with no file behind it
            // renders as a broken download in the demo.
            proposalFile: null,
            pricingFile: null,
            insuranceFile: null,
            licenseFile: null,
            notes:
              `${vendor.companyName} submitted a full response. Pricing held at the quoted rates for 90 days. ` +
              `Insurance certificate and state licence provided to the panel for review.`,
            createdAt: daysAgo(spec.ageDays - 9),
          },
        });
        bump('proposalSubmissions');
      }
    }

    // AI-style artefacts on the RFPs far enough along to have them.
    if (spec.status === RfpStatus.EVALUATED || spec.status === RfpStatus.AWARDED) {
      const submitted = spec.invited.filter(
        (_k, i) => spec.invitationStates[i] === InvitationStatus.SUBMITTED,
      );
      const recommended = spec.awardedVendorKey ?? submitted[0];
      const recName = VENDORS.find((v) => v.key === recommended)?.companyName ?? 'the leading bidder';

      await prisma.evaluationReport.create({
        data: {
          tenantId,
          rfpId,
          summary:
            `${submitted.length} of ${spec.invited.length} invited vendors submitted a complete response. ` +
            `${recName} is recommended on the balance of price, compliance evidence and comparable experience.`,
          recommendedVendor: recName,
          overallAnalysis: buildEvaluationAnalysis(spec, submitted, recName),
          generatedReport: buildEvaluationReport(spec, submitted, recName),
          createdAt: daysAgo(Math.max(spec.ageDays - 14, 1)),
        },
      });
      bump('evaluationReports');

      await prisma.rfpRequirementAnalysis.create({
        data: {
          tenantId,
          rfpId,
          requirements: buildRequirements(spec) as Prisma.InputJsonValue,
          summary:
            `Extracted ${spec.securityTypes.length} service lines and ${spec.guardsRequired} required posts across ` +
            `${spec.numberOfLocations} location(s). Mandatory items: ${spec.additionalRequirements.split('.')[0]}.`,
          missingInformation: [
            'Uniform standard not specified',
            'Escalation contact out of hours not named',
            'Whether vendor or client supplies radios',
          ] as Prisma.InputJsonValue,
          modelUsed: 'gemini-2.5-flash',
          fallbackUsed: false,
          safetyStatus: 'passed',
          createdBy: adminUserId,
          createdAt: daysAgo(Math.max(spec.ageDays - 15, 1)),
        },
      });
      bump('rfpRequirementAnalyses');
    }

    // Performance reviews on the awarded vendor.
    if (spec.awardedVendorKey) {
      const reviews = [
        { monthsAgo: 1, rating: 4, sla: 97.2, incidents: 2, response: 'Under 10 minutes' },
        { monthsAgo: 2, rating: 5, sla: 99.1, incidents: 0, response: 'Under 5 minutes' },
        { monthsAgo: 3, rating: 3, sla: 92.4, incidents: 5, response: '15-20 minutes' },
      ];
      for (const r of reviews) {
        await prisma.vendorPerformance.create({
          data: {
            tenantId,
            rfpId,
            vendorId: vendorIds[spec.awardedVendorKey],
            reviewDate: daysAgo(r.monthsAgo * 30),
            overallRating: r.rating,
            slaCompliance: r.sla,
            incidentCount: r.incidents,
            responseTime: r.response,
            notes:
              r.rating >= 4
                ? 'Coverage held through the period. No unfilled posts and reporting arrived on time.'
                : 'Two late shift starts and a missed report. Raised with their account manager; corrective plan agreed.',
            createdAt: daysAgo(r.monthsAgo * 30 - 1),
          },
        });
        bump('vendorPerformances');
      }
    }
  }

  return { counts, clientByCompany, leadByCompany, deals, proposals, guards, sites, downtown, northside };
}

// ---------------------------------------------------------------------------
// Sales Accelerator, Sales Calls, proposal comments
// ---------------------------------------------------------------------------

type Ctx = Awaited<ReturnType<typeof seedPhase2>>;

async function seedSalesTools(tenantId: string, adminUserId: string, ctx: Ctx) {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  // Discovery sessions + the assessment each one produced. These are what the
  // Sales Accelerator screens read, so one per active opportunity.
  const discoverySpecs: {
    company: string;
    propertyType: string;
    buyerRole: string;
    currentProvider: string;
    guardCount: number;
    serviceHours: string;
    painPoints: string[];
    riskConcerns: string[];
    decisionTimeline: string;
    budgetSensitivity: string;
    objections: string[];
    notes: string;
    leadScore: number;
    priorityTier: string;
    closeReadiness: number;
    discoveryQuality: number;
    riskProfile: string;
    proposalAngle: string;
    nextAction: string;
    missingQuestions: string[];
    objectionRisks: string[];
    summary: string;
    ageDays: number;
  }[] = [
    {
      company: 'Summit Tech Campus',
      propertyType: 'Corporate campus (3 buildings)',
      buyerRole: 'Facilities Director',
      currentProvider: 'In-house team plus ad-hoc contractor',
      guardCount: 11,
      serviceHours: '24/7 lobby in Building A, roving B and C',
      painPoints: [
        'No consistent reporting they can show their board',
        'Ad-hoc contractor quality varies week to week',
        'No audit trail of patrol completion',
      ],
      riskConcerns: ['Tailgating at the Building A lobby', 'After-hours access by contractors'],
      decisionTimeline: 'Decision within 6 weeks, start of next quarter',
      budgetSensitivity: 'Medium - will pay for reporting quality',
      objections: ['Switching cost from in-house', 'Headcount optics internally'],
      notes:
        'Reporting is the whole deal here. Lead with Guard Tour exports and the client portal, not the hourly rate.',
      leadScore: 82,
      priorityTier: 'A',
      closeReadiness: 71,
      discoveryQuality: 88,
      riskProfile: 'Low',
      proposalAngle:
        'Lead with board-ready patrol reporting and checkpoint evidence; position the rate as the cost of auditability.',
      nextAction: 'Send the per-building post breakdown they asked for, with a sample patrol export attached.',
      missingQuestions: [
        'Who signs off above the Facilities Director?',
        'Is there an incumbent contract end date to work around?',
      ],
      objectionRisks: ['Internal pushback on reducing in-house headcount'],
      summary:
        'Strong fit. Pain is reporting and consistency, both of which are product strengths. Budget is not the blocker; internal politics around in-house staff is the real risk.',
      ageDays: 18,
    },
    {
      company: 'Westgate Retail Group',
      propertyType: 'Four strip-mall retail properties',
      buyerRole: 'Regional Operations Manager',
      currentProvider: 'National provider, contract ends in 60 days',
      guardCount: 9,
      serviceHours: 'Evenings and weekends, overnight vehicle patrol',
      painPoints: [
        'Guard turnover - never the same officer twice',
        'No reporting at all from the incumbent',
        'Slow response to incidents across sites',
      ],
      riskConcerns: ['Vehicle break-ins in the lots', 'After-hours loitering'],
      decisionTimeline: 'Must decide before the incumbent contract ends in 60 days',
      budgetSensitivity: 'High - will compare rates line by line',
      objections: ['Price versus the national incumbent', 'Can we really guarantee named officers'],
      notes:
        'Turnover is the emotional issue. The 90-day named-officer commitment is the differentiator - make it contractual.',
      leadScore: 76,
      priorityTier: 'A',
      closeReadiness: 64,
      discoveryQuality: 79,
      riskProfile: 'Medium',
      proposalAngle:
        'Make the named-officer retention commitment the headline and put it in the contract, not the cover letter.',
      nextAction: 'Send retail references (ask Marcus at Lakeshore first) and the 90-day retention clause wording.',
      missingQuestions: ['What is the incumbent actually charging per hour?', 'Who else is bidding?'],
      objectionRisks: ['Undercut on price by the incumbent renewing cheaper'],
      summary:
        'Winnable on service quality but price-sensitive. The deadline is real, which helps. Need references before they will commit.',
      ageDays: 21,
    },
    {
      company: 'Halcyon Biotech',
      propertyType: 'Laboratory facility',
      buyerRole: 'Head of Site Operations',
      currentProvider: 'None - first time outsourcing',
      guardCount: 3,
      serviceHours: '2 officers days, 1 overnight',
      painPoints: [
        'No current security function at all',
        'Audit exposure on who accessed the building and when',
        'Needs vetted officers with evidence on demand',
      ],
      riskConcerns: ['Uncontrolled visitor access', 'Audit findings on access logging', 'IP protection'],
      decisionTimeline: 'Wants cover in place within 8 weeks',
      budgetSensitivity: 'Low - compliance driven, not price driven',
      objections: ['Can you evidence officer vetting at audit time'],
      notes:
        'Compliance tracking IS the product here. Lead with the compliance register and expiry alerting, not guarding.',
      leadScore: 91,
      priorityTier: 'A',
      closeReadiness: 78,
      discoveryQuality: 84,
      riskProfile: 'Low',
      proposalAngle:
        'Position compliance evidence as the deliverable and guarding as the means. Attach a sample compliance export.',
      nextAction: 'Draft the compliance appendix and attach a sample export to the proposal before sending.',
      missingQuestions: ['Which specific audit standard are they being held to?'],
      objectionRisks: ['A competitor bundling access-control hardware they also need'],
      summary:
        'Highest-quality opportunity in the pipeline. Compliance-driven, low price sensitivity, and the requirement maps exactly onto what the platform already does.',
      ageDays: 9,
    },
    {
      company: 'Ironbridge Manufacturing',
      propertyType: 'Single manufacturing plant, three gates',
      buyerRole: 'Plant Manager',
      currentProvider: 'Gatehouse staffed by their own employees',
      guardCount: 4,
      serviceHours: 'Shift-change coverage, 05:00-09:00 heaviest',
      painPoints: ['Own staff pulled off production to man the gate', 'No truck access control discipline'],
      riskConcerns: ['Unverified truck entry', 'Theft at shift change'],
      decisionTimeline: 'Exploratory - no committed timeline',
      budgetSensitivity: 'High - budget not yet approved',
      objections: ['Budget not confirmed', 'COO has not engaged yet'],
      notes: 'Early. Real need but no budget owner engaged. Keep warm, do not over-invest yet.',
      leadScore: 48,
      priorityTier: 'C',
      closeReadiness: 29,
      discoveryQuality: 55,
      riskProfile: 'High',
      proposalAngle:
        'Frame as production hours recovered rather than security spend - the ROI argument reaches the COO.',
      nextAction: 'Do the gate site visit at shift change, then get introduced to the COO before quoting.',
      missingQuestions: [
        'Who owns the budget line?',
        'What does the gate cost them in lost production hours today?',
        'Is there a trigger event forcing a decision?',
      ],
      objectionRisks: ['Stalls indefinitely without a budget owner', 'Decides to keep it in-house'],
      summary:
        'Genuine operational pain but no budget owner engaged and no timeline. Qualify the COO relationship before investing proposal effort.',
      ageDays: 12,
    },
  ];

  for (const spec of discoverySpecs) {
    const lead = ctx.leadByCompany.get(spec.company);
    const deal = ctx.deals.find((d) => d.leadId === lead?.id);

    const sessionId = randomUUID();
    await prisma.discoverySession.create({
      data: {
        id: sessionId,
        tenantId,
        leadId: lead?.id ?? null,
        dealId: deal?.id ?? null,
        propertyType: spec.propertyType,
        buyerRole: spec.buyerRole,
        currentProvider: spec.currentProvider,
        guardCount: spec.guardCount,
        serviceHours: spec.serviceHours,
        painPoints: spec.painPoints,
        riskConcerns: spec.riskConcerns,
        decisionTimeline: spec.decisionTimeline,
        budgetSensitivity: spec.budgetSensitivity,
        objections: spec.objections,
        notes: spec.notes,
        createdBy: adminUserId,
        createdAt: daysAgo(spec.ageDays),
      },
    });
    bump('discoverySessions');

    await prisma.salesAssessment.create({
      data: {
        tenantId,
        leadId: lead?.id ?? null,
        dealId: deal?.id ?? null,
        discoverySessionId: sessionId,
        assessmentType: 'sales_assessment',
        leadScore: spec.leadScore,
        priorityTier: spec.priorityTier,
        closeReadinessScore: spec.closeReadiness,
        discoveryQualityScore: spec.discoveryQuality,
        riskProfile: spec.riskProfile,
        proposalAngle: spec.proposalAngle,
        recommendedNextAction: spec.nextAction,
        missingQuestions: spec.missingQuestions,
        objectionRisks: spec.objectionRisks,
        summary: spec.summary,
        createdBy: adminUserId,
        createdAt: daysAgo(Math.max(spec.ageDays - 1, 0)),
      },
    });
    bump('salesAssessments');
  }

  // --- Sales calls --------------------------------------------------------
  // Every outcome the model documents, so the filter chips all return rows.
  const callSpecs: {
    company: string;
    outcome: string;
    durationSec: number | null;
    daysAgo: number;
    notes: string;
  }[] = [
    { company: 'Summit Tech Campus', outcome: 'connected', durationSec: 1420, daysAgo: 18, notes: 'Walked through the three-building scope. They want the per-post breakdown split by building. Reporting is the deciding factor.' },
    { company: 'Summit Tech Campus', outcome: 'voicemail', durationSec: 35, daysAgo: 4, notes: 'Left a message chasing feedback on the proposal. Try again Thursday.' },
    { company: 'Westgate Retail Group', outcome: 'connected', durationSec: 2180, daysAgo: 21, notes: 'Discovery call. Turnover is the real pain, not price. Incumbent contract ends in 60 days - hard deadline.' },
    { company: 'Westgate Retail Group', outcome: 'no_answer', durationSec: null, daysAgo: 6, notes: 'No answer on the direct line. Try the mobile next time.' },
    { company: 'Halcyon Biotech', outcome: 'connected', durationSec: 1975, daysAgo: 9, notes: 'Compliance requirements review. They want evidence of officer vetting available on demand at audit.' },
    { company: 'Ironbridge Manufacturing', outcome: 'connected', durationSec: 860, daysAgo: 12, notes: 'Intro call. Budget not confirmed, decision sits with the COO. Need an introduction.' },
    { company: 'Crestline Senior Living', outcome: 'connected', durationSec: 1105, daysAgo: 8, notes: 'Wants officers comfortable with residents rather than a hard security posture. Concierge-style framing.' },
    { company: 'Foundry District BID', outcome: 'voicemail', durationSec: 28, daysAgo: 1, notes: 'First outreach. Left a voicemail introducing the ambassador patrol model.' },
    { company: 'Stonegate Plaza', outcome: 'connected', durationSec: 940, daysAgo: 6, notes: 'We are one of three bidding. Differentiator is reporting, not rate. Decision expected within the month.' },
    { company: 'Rivermark Apartments', outcome: 'wrong_number', durationSec: 15, daysAgo: 2, notes: 'Number on the referral was out of date. Asked Harborview for the correct contact.' },
    { company: 'Brightwater Hotels', outcome: 'connected', durationSec: 640, daysAgo: 26, notes: 'Decision call - lost on price, they built an in-house team. Agreed to revisit in 6 months.' },
    { company: 'Kestrel Logistics Park', outcome: 'dialed', durationSec: null, daysAgo: 3, notes: 'Dial initiated from the lead record. No outcome logged yet.' },
    { company: 'Arcadia Event Venue', outcome: 'failed', durationSec: null, daysAgo: 2, notes: 'Call failed to connect - line appears disconnected. Verify the number.' },
  ];

  for (const spec of callSpecs) {
    const lead = ctx.leadByCompany.get(spec.company);
    if (!lead) continue;
    const deal = ctx.deals.find((d) => d.leadId === lead.id);

    await prisma.callRecord.create({
      data: {
        tenantId,
        leadId: lead.id,
        dealId: deal?.id ?? null,
        // E.164, as the dial path stores it.
        phoneNumber: '+1312555' + String(1000 + callSpecs.indexOf(spec)).slice(-4),
        direction: 'outbound',
        outcome: spec.outcome,
        durationSec: spec.durationSec,
        notes: spec.notes,
        createdBy: adminUserId,
        createdAt: daysAgo(spec.daysAgo, 14, 15),
      },
    });
    bump('callRecords');
  }

  // --- Proposal comment threads -------------------------------------------
  // Mix of admin and client-authored comments, so the thread shows both sides.
  const clientUsers = await prisma.clientUser.findMany({
    where: { tenantId },
    select: { id: true, clientId: true },
  });
  const clientUserByClientId = new Map(clientUsers.map((u) => [u.clientId, u.id]));

  const commentSpecs: {
    titleContains: string;
    thread: { by: 'admin' | 'client'; content: string; daysAgo: number }[];
  }[] = [
    {
      titleContains: 'Summit Tech',
      thread: [
        { by: 'admin', content: 'Sent across for review. Happy to walk through the per-building breakdown on a call if that is easier.', daysAgo: 12 },
        { by: 'client', content: 'Thanks. Can you split the Building A lobby cost out separately? Our board will ask why that post is 24/7.', daysAgo: 9 },
        { by: 'admin', content: 'Yes - revised version coming with Building A itemised and the 24/7 justification written out against the tailgating risk you raised.', daysAgo: 8 },
      ],
    },
    {
      titleContains: 'Westgate',
      thread: [
        { by: 'admin', content: 'Proposal attached. The 90-day named-officer commitment is in section 4 - that is the direct answer to the turnover problem.', daysAgo: 14 },
        { by: 'client', content: 'The retention clause is what we needed to see. Still need to compare against the incumbent renewal before we commit.', daysAgo: 11 },
      ],
    },
    {
      titleContains: 'Harborview',
      thread: [
        { by: 'client', content: 'Approved. Please proceed with the start date as drafted.', daysAgo: 41 },
        { by: 'admin', content: 'Confirmed, thank you. Officer assignments are set and the first daily report will arrive the morning after go-live.', daysAgo: 40 },
      ],
    },
  ];

  for (const spec of commentSpecs) {
    const proposal = ctx.proposals.find((p) => p.title.includes(spec.titleContains));
    if (!proposal) continue;

    // A client-authored comment must come from THAT proposal's own client
    // user, not just any of them -- otherwise the thread shows a different
    // company commenting on someone else's proposal.
    const full = await prisma.proposal.findUnique({
      where: { id: proposal.id },
      select: { clientId: true },
    });
    const clientUserId = full?.clientId ? clientUserByClientId.get(full.clientId) ?? null : null;

    for (const c of spec.thread) {
      if (c.by === 'client' && !clientUserId) continue;
      await prisma.proposalComment.create({
        data: {
          tenantId,
          proposalId: proposal.id,
          userId: c.by === 'admin' ? adminUserId : null,
          clientUserId: c.by === 'client' ? clientUserId : null,
          content: c.content,
          createdAt: daysAgo(c.daysAgo, 11, 30),
        },
      });
      bump('proposalComments');
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Guard Tour alerts, branding, integrations, team
// ---------------------------------------------------------------------------

async function seedOpsAndAdmin(tenantId: string, adminUserId: string, ctx: Ctx) {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  // --- Emergency alerts (Patrol Monitor) ----------------------------------
  // One in each state. The ACTIVE one is what makes the monitor screen worth
  // opening in a demo; the other two show the acknowledge/resolve workflow.
  const runs = await prisma.patrolRun.findMany({
    where: { tenantId, status: 'in_progress' },
    select: { id: true, guardId: true, lastLatitude: true, lastLongitude: true, lastLocationAt: true },
    take: 3,
  });

  const alertSpecs: {
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
    minutesAgo: number;
    notes: string;
  }[] = [
    {
      status: 'ACTIVE',
      minutesAgo: 6,
      notes: 'Panic button triggered from the guard app. Control room attempting contact.',
    },
    {
      status: 'ACKNOWLEDGED',
      minutesAgo: 95,
      notes: 'Guard triggered the alert after a verbal confrontation at the gate. Supervisor en route.',
    },
    {
      status: 'RESOLVED',
      minutesAgo: 1500,
      notes: 'Accidental trigger while the guard was putting the handset away. Confirmed safe by phone within two minutes.',
    },
  ];

  for (const [i, spec] of alertSpecs.entries()) {
    const run = runs[i];
    const guard = run
      ? ctx.guards.find((g) => g.id === run.guardId)
      : ctx.guards[i % ctx.guards.length];
    if (!guard) continue;

    const triggeredAt = new Date(Date.now() - spec.minutesAgo * 60 * 1000);
    const acknowledged = spec.status !== 'ACTIVE';
    const resolved = spec.status === 'RESOLVED';

    await prisma.emergencyAlert.create({
      data: {
        tenantId,
        guardId: guard.id,
        branchId: guard.branchId ?? null,
        patrolRunId: run?.id ?? null,
        status: spec.status,
        triggeredAt,
        acknowledgedAt: acknowledged ? new Date(triggeredAt.getTime() + 3 * 60 * 1000) : null,
        acknowledgedById: acknowledged ? adminUserId : null,
        resolvedAt: resolved ? new Date(triggeredAt.getTime() + 11 * 60 * 1000) : null,
        resolvedById: resolved ? adminUserId : null,
        notes: spec.notes,
        // Snapshot copied from the run, as the real trigger path does.
        lastLatitude: run?.lastLatitude ?? null,
        lastLongitude: run?.lastLongitude ?? null,
        lastAccuracyMeters: run ? 12 : null,
        locationCapturedAt: run?.lastLocationAt ?? null,
        createdAt: triggeredAt,
      },
    });
    bump('emergencyAlerts');
  }

  // --- Branding -----------------------------------------------------------
  // No logo/favicon/background URLs: those point at uploaded files, and a
  // broken image is worse in a demo than the default mark.
  await prisma.tenantBranding.create({
    data: {
      tenantId,
      companyName: 'AegisLead Demo Security',
      primaryColor: '#1d4ed8',
      secondaryColor: '#1e293b',
      accentColor: '#38bdf8',
      welcomeMessage:
        'Welcome to your security portal. Live incident reports, patrol evidence and invoices, all in one place.',
      supportEmail: 'support@aegislead-demo.example',
      supportPhone: '+1-312-555-0100',
      createdAt: daysAgo(140),
    },
  });
  bump('branding');

  await prisma.customDomain.create({
    data: {
      tenantId,
      domain: 'portal.aegislead-demo.example',
      verificationStatus: 'verified',
      sslStatus: 'active',
      verificationToken: randomBytes(16).toString('hex'),
      verifiedAt: daysAgo(132),
      createdAt: daysAgo(136),
    },
  });
  bump('customDomains');

  // --- Integrations: API keys, webhooks, deliveries, request logs ----------
  const keySpecs: {
    name: string;
    permissions: string[];
    status: string;
    ageDays: number;
    lastUsedDaysAgo: number | null;
    expiresInDays: number | null;
  }[] = [
    {
      name: 'Payroll export (production)',
      permissions: ['timesheets.view', 'guards.view', 'shifts.view'],
      status: 'active',
      ageDays: 120,
      lastUsedDaysAgo: 0,
      expiresInDays: 245,
    },
    {
      name: 'Client reporting dashboard',
      permissions: ['incidents.view', 'reports.view', 'sites.view'],
      status: 'active',
      ageDays: 74,
      lastUsedDaysAgo: 2,
      expiresInDays: null,
    },
    {
      name: 'Accounting sync (sandbox)',
      permissions: ['invoices.view', 'clients.view'],
      status: 'revoked',
      ageDays: 160,
      lastUsedDaysAgo: 45,
      expiresInDays: null,
    },
  ];

  const apiKeyIds: string[] = [];
  for (const spec of keySpecs) {
    // Same shape the service issues: v6_<base64url>, stored as a sha256 hash
    // with a 12-char prefix kept for display. The plaintext is discarded
    // here exactly as it is in the real create path -- a seeded key nobody
    // can use is correct; these exist to populate the screen, not to grant
    // access.
    const plain = `v6_${randomBytes(32).toString('base64url')}`;
    const id = randomUUID();
    apiKeyIds.push(id);

    await prisma.apiKey.create({
      data: {
        id,
        tenantId,
        name: spec.name,
        apiKey: createHash('sha256').update(plain).digest('hex'),
        keyPrefix: plain.slice(0, 12),
        permissions: spec.permissions,
        status: spec.status,
        expiresAt: spec.expiresInDays === null ? null : daysAhead(spec.expiresInDays),
        rateLimitPerMinute: 120,
        lastUsedAt: spec.lastUsedDaysAgo === null ? null : daysAgo(spec.lastUsedDaysAgo, 8, 15),
        createdAt: daysAgo(spec.ageDays),
      },
    });
    bump('apiKeys');
  }

  // Request logs against the active keys, so the usage panel has a history.
  const endpoints: [string, string, number][] = [
    ['/api/v1/timesheets', 'GET', 200],
    ['/api/v1/guards', 'GET', 200],
    ['/api/v1/shifts', 'GET', 200],
    ['/api/v1/incidents', 'GET', 200],
    ['/api/v1/reports', 'GET', 200],
    ['/api/v1/invoices', 'GET', 403],
    ['/api/v1/timesheets', 'GET', 429],
  ];
  const logRows: Prisma.ApiRequestLogCreateManyInput[] = [];
  for (let d = 13; d >= 0; d -= 1) {
    for (let n = 0; n < 4; n += 1) {
      const [endpoint, method, status] = endpoints[(d * 4 + n) % endpoints.length];
      logRows.push({
        tenantId,
        apiKeyId: apiKeyIds[(d + n) % 2], // the two active keys
        endpoint,
        method,
        statusCode: status,
        ipAddress: '203.0.113.' + (10 + ((d + n) % 40)),
        userAgent: 'AegisLead-Integration/1.4 (+https://aegislead-demo.example)',
        createdAt: daysAgo(d, 6 + n * 4, 12),
      });
    }
  }
  await prisma.apiRequestLog.createMany({ data: logRows });
  bump('apiRequestLogs', logRows.length);

  // Webhooks + delivery history, including a failure with a retry count.
  const webhookSpecs: {
    eventType: string;
    endpointUrl: string;
    status: string;
    deliveries: { ok: boolean; status: number | null; retries: number; daysAgo: number; error?: string }[];
  }[] = [
    {
      eventType: 'incident.created',
      endpointUrl: 'https://hooks.aegislead-demo.example/incidents',
      status: 'active',
      deliveries: [
        { ok: true, status: 200, retries: 0, daysAgo: 1 },
        { ok: true, status: 200, retries: 0, daysAgo: 3 },
        { ok: false, status: 502, retries: 3, daysAgo: 5, error: 'Bad gateway from endpoint after 3 retries' },
      ],
    },
    {
      eventType: 'invoice.issued',
      endpointUrl: 'https://hooks.aegislead-demo.example/billing',
      status: 'active',
      deliveries: [
        { ok: true, status: 201, retries: 0, daysAgo: 2 },
        { ok: true, status: 201, retries: 1, daysAgo: 9 },
      ],
    },
    {
      eventType: 'shift.assigned',
      endpointUrl: 'https://hooks.aegislead-demo.example/scheduling',
      status: 'disabled',
      deliveries: [
        { ok: false, status: null, retries: 5, daysAgo: 22, error: 'Connection timed out; webhook auto-disabled after repeated failures' },
      ],
    },
  ];

  for (const spec of webhookSpecs) {
    const webhookId = randomUUID();
    await prisma.webhook.create({
      data: {
        id: webhookId,
        tenantId,
        eventType: spec.eventType,
        endpointUrl: spec.endpointUrl,
        secretKey: `whsec_${randomBytes(24).toString('hex')}`,
        status: spec.status,
        createdAt: daysAgo(100),
      },
    });
    bump('webhooks');

    for (const d of spec.deliveries) {
      await prisma.webhookDelivery.create({
        data: {
          webhookId,
          payload: {
            event: spec.eventType,
            tenant: 'aegislead-demo',
            sentAt: daysAgo(d.daysAgo).toISOString(),
          } as Prisma.InputJsonValue,
          responseStatus: d.status,
          success: d.ok,
          retryCount: d.retries,
          lastError: d.error ?? null,
          createdAt: daysAgo(d.daysAgo, 9, 0),
          deliveredAt: d.ok ? daysAgo(d.daysAgo, 9, 0) : null,
        },
      });
      bump('webhookDeliveries');
    }
  }

  // --- Team: extra staff users with real role assignments -----------------
  // A one-user tenant makes the Roles screen look theoretical. These are real
  // logins with the system roles the RBAC catalog defines.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_PASSWORD_ROUNDS);
  const roles = await prisma.role.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  const staffSpecs: {
    name: string;
    email: string;
    roleName: string;
    branchId: string | null;
    isSuperAdmin: boolean;
    role: 'ADMIN' | 'FINANCE';
  }[] = [
    {
      name: 'Dennis Whitaker',
      email: 'dennis.whitaker@aegislead-demo.example',
      roleName: 'Branch Admin',
      branchId: ctx.downtown?.id ?? null,
      isSuperAdmin: false,
      role: 'ADMIN',
    },
    {
      name: 'Rosa Delgado',
      email: 'rosa.delgado@aegislead-demo.example',
      roleName: 'Scheduler',
      branchId: ctx.northside?.id ?? null,
      isSuperAdmin: false,
      role: 'ADMIN',
    },
    {
      name: 'Carla Mbeki',
      email: 'carla.mbeki@aegislead-demo.example',
      roleName: 'Supervisor',
      branchId: ctx.downtown?.id ?? null,
      isSuperAdmin: false,
      role: 'ADMIN',
    },
    {
      name: 'Tim Ferreira',
      email: 'tim.ferreira@aegislead-demo.example',
      roleName: 'Finance',
      branchId: null,
      isSuperAdmin: false,
      role: 'FINANCE',
    },
  ];

  for (const spec of staffSpecs) {
    // Only assign a role the catalog actually defines for this tenant.
    const roleId =
      roleByName.get(spec.roleName) ??
      roles.find((r) => r.name.toLowerCase().includes(spec.roleName.toLowerCase()))?.id;
    if (!roleId) {
      console.log(`  (skipped ${spec.email}: no role named "${spec.roleName}" in this tenant)`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: spec.email,
        password: passwordHash,
        name: spec.name,
        role: spec.role,
        branchId: spec.branchId,
        isSuperAdmin: spec.isSuperAdmin,
        emailVerified: true,
        emailVerifiedAt: daysAgo(90),
        createdAt: daysAgo(90),
      },
    });
    bump('staffUsers');

    await prisma.userRoleAssignment.create({
      data: {
        tenantId,
        userId: user.id,
        roleId,
        branchId: spec.branchId,
      },
    });
    bump('roleAssignments');
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Document builders
//
// The RFP module stores generated prose in generatedContent / generatedReport.
// These produce realistic documents from the fixture data so the RFP preview
// and evaluation screens have something substantial to show, rather than a
// paragraph of placeholder text.
// ---------------------------------------------------------------------------

function buildRfpDocument(spec: (typeof RFPS)[number]): string {
  return [
    `# Request for Proposal: ${spec.title}`,
    ``,
    `**Issued by:** AegisLead Demo Security on behalf of ${spec.companyName}`,
    `**Project:** ${spec.projectName}`,
    `**Response due:** ${daysAhead(spec.dueInDays).toISOString().slice(0, 10)}`,
    ``,
    `## 1. Background`,
    ``,
    `${spec.companyName} is seeking proposals for security services covering ` +
      `${spec.numberOfLocations} location(s) at ${spec.address}. The scope covers ` +
      `${spec.securityTypes.join(', ').toLowerCase()}.`,
    ``,
    `## 2. Scope of Services`,
    ``,
    `- Service lines required: ${spec.securityTypes.join(', ')}`,
    `- Posts required: ${spec.guardsRequired}`,
    `- Operating hours: ${spec.operatingHours}`,
    `- Locations: ${spec.numberOfLocations}`,
    ``,
    `## 3. Mandatory Requirements`,
    ``,
    spec.additionalRequirements,
    ``,
    `## 4. Pricing`,
    ``,
    `Pricing model: ${spec.pricingModel}.`,
    `Respondents must provide each of the following as separate line items:`,
    `hourly officer rate, overtime rate, holiday rate, supervisor rate, and any`,
    `one-off mobilisation cost. All rates are to be quoted inclusive of`,
    `insurance, uniform and statutory costs.`,
    ``,
    `Payment terms: ${spec.paymentTerms}. Pricing must remain valid for 90 days`,
    `from the submission date.`,
    ``,
    `## 5. Submission Requirements`,
    ``,
    `A complete response comprises: the technical proposal, the pricing schedule,`,
    `a current certificate of insurance, and evidence of state licensing for the`,
    `responding entity. Incomplete submissions will not be evaluated.`,
    ``,
    `## 6. Evaluation Criteria`,
    ``,
    `Responses are scored on compliance with the mandatory requirements (40%),`,
    `price (30%), comparable experience (20%), and quality of reporting and`,
    `evidence (10%).`,
  ].join('\n');
}

function buildRequirements(spec: (typeof RFPS)[number]) {
  const rows = [
    {
      requirement: `Provide ${spec.guardsRequired} security posts across ${spec.numberOfLocations} location(s)`,
      category: 'Staffing',
      sourceContext: `Posts required: ${spec.guardsRequired}`,
      importance: 'mandatory',
      extractedValue: String(spec.guardsRequired),
      confidence: 0.96,
    },
    {
      requirement: `Cover the stated operating hours: ${spec.operatingHours}`,
      category: 'Coverage',
      sourceContext: spec.operatingHours,
      importance: 'mandatory',
      extractedValue: spec.operatingHours,
      confidence: 0.93,
    },
    {
      requirement: `Quote using the ${spec.pricingModel.toLowerCase()} model`,
      category: 'Commercial',
      sourceContext: `Pricing model: ${spec.pricingModel}`,
      importance: 'mandatory',
      extractedValue: spec.pricingModel,
      confidence: 0.9,
    },
    {
      requirement: `Accept ${spec.paymentTerms} payment terms`,
      category: 'Commercial',
      sourceContext: `Payment terms: ${spec.paymentTerms}`,
      importance: 'important',
      extractedValue: spec.paymentTerms,
      confidence: 0.88,
    },
  ];
  for (const type of spec.securityTypes) {
    rows.push({
      requirement: `Deliver ${type.toLowerCase()} as a service line`,
      category: 'Service Line',
      sourceContext: `Service lines required: ${spec.securityTypes.join(', ')}`,
      importance: 'mandatory',
      extractedValue: type,
      confidence: 0.94,
    });
  }
  rows.push({
    requirement: spec.additionalRequirements.split('.')[0].trim(),
    category: 'Compliance',
    sourceContext: spec.additionalRequirements,
    importance: 'mandatory',
    extractedValue: spec.additionalRequirements.split('.')[0].trim(),
    confidence: 0.91,
  });
  return rows;
}

function buildEvaluationAnalysis(
  spec: (typeof RFPS)[number],
  submitted: string[],
  recName: string,
): string {
  const names = submitted.map((k) => VENDORS.find((v) => v.key === k)?.companyName ?? k);
  return [
    `${names.length} compliant submissions were received against a budget expectation of ` +
      `$${spec.estimatedBudget.toLocaleString()}.`,
    ``,
    names
      .map((n, i) =>
        n === recName
          ? `- ${n}: fully compliant on the mandatory requirements, with evidence provided for every item. Price sits mid-field. Comparable experience is directly relevant to this scope.`
          : i === 0
            ? `- ${n}: lowest price of the compliant bids, but could not evidence all mandatory requirements at submission. Would require a conditional award.`
            : `- ${n}: strong technical response and excellent reporting, but priced materially above the budget expectation.`,
      )
      .join('\n'),
    ``,
    `Recommendation: award to ${recName}. The decision is driven by full compliance ` +
      `on the mandatory requirements rather than headline price; the cheapest bid ` +
      `carries documentation risk that would surface at audit.`,
  ].join('\n');
}

function buildEvaluationReport(
  spec: (typeof RFPS)[number],
  submitted: string[],
  recName: string,
): string {
  const names = submitted.map((k) => VENDORS.find((v) => v.key === k)?.companyName ?? k);
  return [
    `# Evaluation Report: ${spec.title}`,
    ``,
    `**Client:** ${spec.companyName}`,
    `**Budget expectation:** $${spec.estimatedBudget.toLocaleString()}`,
    `**Submissions evaluated:** ${names.length} of ${spec.invited.length} invited`,
    ``,
    `## Scoring Summary`,
    ``,
    `| Vendor | Compliance (40) | Price (30) | Experience (20) | Reporting (10) | Total |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...names.map((n, i) => {
      const compliance = n === recName ? 38 : i === 0 ? 29 : 36;
      const price = n === recName ? 24 : i === 0 ? 29 : 18;
      const experience = n === recName ? 18 : i === 0 ? 15 : 17;
      const reporting = n === recName ? 9 : i === 0 ? 6 : 10;
      return `| ${n} | ${compliance} | ${price} | ${experience} | ${reporting} | ${compliance + price + experience + reporting} |`;
    }),
    ``,
    `## Findings`,
    ``,
    buildEvaluationAnalysis(spec, submitted, recName),
    ``,
    `## Recommended Next Steps`,
    ``,
    `1. Issue the award notice to ${recName}.`,
    `2. Confirm mobilisation dates and the officer vetting schedule before go-live.`,
    `3. Set the first performance review for 30 days after service commencement.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const apply = process.argv.includes('--apply');
  const reset = process.argv.includes('--reset');
  const email = (arg('email') ?? 'demo@aegislead.co').trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, tenantId: true },
  });
  if (!user) {
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) {
    console.error(`User ${email} has no tenant.`);
    process.exit(1);
  }

  console.log('Target account');
  console.log(`  email   ${user.email}`);
  console.log(`  tenant  ${tenant.name} (${tenant.slug})`);
  console.log(`  id      ${tenant.id}`);
  console.log('');

  const before = await countPhase2(tenant.id);
  if (before.total > 0 && !reset) {
    console.error('This tenant already holds phase-2 data:');
    for (const [k, v] of Object.entries(before.counts)) {
      if (v > 0) console.error(`  ${k}: ${v}`);
    }
    console.error('\nPass --reset to clear it first (phase-1 data is untouched).');
    process.exit(1);
  }

  if (!apply) {
    console.log('DRY RUN -- nothing will be written.');
    if (reset && before.total > 0) {
      console.log(`Would first delete ${before.total} existing phase-2 rows.`);
    }
    console.log('');
    console.log('Would seed, scoped to the tenant above:');
    console.log(`  ${VENDORS.length} vendors with performance review history`);
    console.log(`  ${RFPS.length} RFPs across every status, with invitations and submissions`);
    console.log(`  evaluation reports + AI requirement analyses on the advanced RFPs`);
    console.log(`  4 discovery sessions + sales assessments (Sales Accelerator)`);
    console.log(`  13 call records across every outcome (Sales Calls)`);
    console.log(`  proposal comment threads`);
    console.log(`  3 emergency alerts (active / acknowledged / resolved)`);
    console.log(`  tenant branding + a verified custom domain`);
    console.log(`  3 API keys, 56 request logs, 3 webhooks with delivery history`);
    console.log(`  4 staff users with real role assignments`);
    console.log('');
    console.log('Re-run with --apply to write it.');
    return;
  }

  if (reset && before.total > 0) {
    console.log(`Clearing ${before.total} existing phase-2 rows...`);
    await resetPhase2(tenant.id);
    console.log('Cleared.');
  }

  console.log('Seeding...');
  const ctx = await seedPhase2(tenant.id, user.id);
  console.log('  vendors, RFPs, invitations, submissions, evaluations, performance');

  const sales = await seedSalesTools(tenant.id, user.id, ctx);
  console.log('  discovery sessions, assessments, calls, proposal comments');

  const admin = await seedOpsAndAdmin(tenant.id, user.id, ctx);
  console.log('  emergency alerts, branding, integrations, team');
  console.log('');

  const all = { ...ctx.counts, ...sales, ...admin };
  console.log('Rows written:');
  for (const [k, v] of Object.entries(all).sort()) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }
  console.log('');
  console.log('Staff logins added (same demo password):');
  console.log('  dennis.whitaker@aegislead-demo.example   Branch Admin');
  console.log('  rosa.delgado@aegislead-demo.example      Scheduler');
  console.log('  carla.mbeki@aegislead-demo.example       Supervisor');
  console.log('  tim.ferreira@aegislead-demo.example      Finance');
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
