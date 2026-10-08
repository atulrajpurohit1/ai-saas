/**
 * Fills one existing tenant with a coherent book of demo business data, so the
 * account can be shown to a prospective client as a working agency rather than
 * a set of empty screens.
 *
 * Scope: every row written is scoped to the one tenant resolved from --email,
 * and nothing outside that tenant is read for writing or modified. The local
 * .env points at the production database, so this is a DRY RUN unless --apply
 * is passed, and it refuses outright if the target tenant already holds
 * business data (pass --reset to clear only that tenant's demo rows first).
 *
 * What it writes, and why it is shaped this way:
 *
 *   - 2 Branches, so the branch switcher and branch-scoped views have
 *     something to switch between. The demo user is isSuperAdmin and sees both.
 *   - 6 Clients, each with sites, a rate card and a portal login.
 *   - 9 Sites across those clients.
 *   - 14 Guards, with real bcrypt passwords so the GUARD PORTAL can be
 *     demoed, plus availability and compliance documents (one expiring soon
 *     and one expired, because the compliance screen is only interesting when
 *     something needs attention).
 *   - Shifts across the last 8 weeks and the next 10 days, with attendance
 *     events on the past ones. Future shifts left partly unfilled so the
 *     scheduling gap is visible.
 *   - Checkpoints + patrol routes + patrol runs with checkpoint scans,
 *     including one OUTSIDE_GEOFENCE scan and one missed run, so Guard Tour
 *     shows both the happy path and an exception.
 *   - Incidents at every severity and in every review state.
 *   - Timesheets -> Invoices (draft/issued/paid/disputed), with invoice items
 *     derived from the actual shifts and the client's rate card, so the
 *     finance numbers reconcile instead of being arbitrary.
 *   - Daily service reports, published and draft.
 *   - CRM pipeline: leads at each status, deals across every Kanban stage,
 *     notes, activities and proposals.
 *   - Prospect Search history + saved searches, and a credit ledger that
 *     tells a believable usage story.
 *
 * Dates are spread across the last 8 weeks because the dashboard charts an
 * 8-week trend off createdAt and compares the last 7 days with the 7 before
 * it -- seeding everything at "now" would render one flat spike and a null
 * delta, which looks broken in a demo.
 *
 * The credit ledger keeps the invariant the credits code relies on: balance
 * equals the sum of the ledger's amounts, and every row carries the running
 * balanceAfter.
 *
 *   npx ts-node -T scripts/seed-demo-showcase.ts --email=demo@aegislead.co
 *   npx ts-node -T scripts/seed-demo-showcase.ts --email=demo@aegislead.co --rehearse
 *   npx ts-node -T scripts/seed-demo-showcase.ts --email=demo@aegislead.co --apply
 *   npx ts-node -T scripts/seed-demo-showcase.ts --email=demo@aegislead.co --reset --apply
 */
import {
  PrismaClient,
  Prisma,
  AttendanceEventType,
  CreditEntryType,
  CreditReservationStatus,
  ReportEmailMode,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
// Imported rather than copied, so the seeded verification outcomes cannot
// drift from the only values the patrol code ever writes.
import { CheckpointVerificationStatus } from '../src/patrols/checkpoint-verification.constants';

const client = new PrismaClient();

/**
 * Every seed function writes through this binding rather than the client
 * directly, so --rehearse can point it at a transaction that is rolled back.
 * That exercises every constraint, required field and enum value against the
 * real database without persisting anything -- worth having, because the local
 * .env points at production and there is no local Postgres to practise on.
 */
let prisma: PrismaClient | Prisma.TransactionClient = client;

/** Matches src/auth/password-policy.ts, so seeded logins behave like real ones. */
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

/** Midnight-anchored "n days ago", so seeded dates are stable within a day. */
function daysAgo(n: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return new Date(d.getTime() - n * DAY_MS);
}

function daysAhead(n: number, hour = 9, minute = 0): Date {
  return daysAgo(-n, hour, minute);
}

function hoursAfter(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Deterministic pseudo-randomness. A fixed seed means re-running after a
 * --reset reproduces the same demo, so a scripted walkthrough does not change
 * under the presenter.
 */
let randomState = 1337;
function rand(): number {
  randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
  return randomState / 0x7fffffff;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

// ---------------------------------------------------------------------------
// The fictional agency's book of business.
//
// Names are invented. They are deliberately generic-but-plausible commercial
// security accounts (hospital, mall, data centre, campus) so the demo reads as
// a real mid-size guarding company without naming any actual organisation.
// ---------------------------------------------------------------------------

type SiteSpec = {
  key: string;
  name: string;
  address: string;
  instructions: string;
  /** Checkpoints get a geofence around this point so Guard Tour verifies. */
  lat: number;
  lng: number;
};

type ClientSpec = {
  key: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  branchKey: 'downtown' | 'northside';
  contactEmail: string;
  hourlyRate: number;
  overtimeRate: number;
  holidayRate: number;
  billingNotes: string;
  internalNotes: string;
  reportEmailEnabled: boolean;
  reportEmailMode: ReportEmailMode;
  sites: SiteSpec[];
};

const CLIENTS: ClientSpec[] = [
  {
    key: 'meridian',
    name: 'Dana Whitfield',
    companyName: 'Meridian General Hospital',
    email: 'facilities@meridiangeneral.example',
    phone: '+1-312-555-0142',
    branchKey: 'downtown',
    contactEmail: 'dana.whitfield@meridiangeneral.example',
    hourlyRate: 32.5,
    overtimeRate: 48.75,
    holidayRate: 65,
    billingNotes: 'Net 30. PO number must appear on every invoice.',
    internalNotes:
      'Largest account. Night coverage is contractual - never leave the ED entrance unstaffed.',
    reportEmailEnabled: true,
    reportEmailMode: ReportEmailMode.AUTOMATIC,
    sites: [
      {
        key: 'meridian-main',
        name: 'Meridian General - Main Campus',
        address: '1400 W Harrison St, Chicago, IL 60607',
        instructions:
          'Report to the security desk in the main lobby. Badge required above floor 3. Escort policy applies after 20:00.',
        lat: 41.8743,
        lng: -87.6636,
      },
      {
        key: 'meridian-ed',
        name: 'Meridian General - Emergency Department',
        address: '1412 W Harrison St, Chicago, IL 60607',
        instructions:
          'Two guards minimum at all times. De-escalation protocol posted at the triage desk.',
        lat: 41.8748,
        lng: -87.6641,
      },
    ],
  },
  {
    key: 'lakeshore',
    name: 'Marcus Bell',
    companyName: 'Lakeshore Commons Mall',
    email: 'operations@lakeshorecommons.example',
    phone: '+1-312-555-0188',
    branchKey: 'downtown',
    contactEmail: 'marcus.bell@lakeshorecommons.example',
    hourlyRate: 26,
    overtimeRate: 39,
    holidayRate: 52,
    billingNotes: 'Net 15. Consolidated monthly invoice per site.',
    internalNotes:
      'Holiday season needs 4 extra guards from late November. Mall manager prefers a single point of contact.',
    reportEmailEnabled: true,
    reportEmailMode: ReportEmailMode.MANUAL,
    sites: [
      {
        key: 'lakeshore-mall',
        name: 'Lakeshore Commons - Retail Concourse',
        address: '200 E Randolph St, Chicago, IL 60601',
        instructions:
          'Foot patrol of all three levels. Lost-child protocol takes priority over everything else.',
        lat: 41.8848,
        lng: -87.6215,
      },
      {
        key: 'lakeshore-garage',
        name: 'Lakeshore Commons - Parking Structure',
        address: '210 E Randolph St, Chicago, IL 60601',
        instructions:
          'Vehicle patrol levels P1-P5 hourly. Log every abandoned vehicle with plate and level.',
        lat: 41.8852,
        lng: -87.6209,
      },
    ],
  },
  {
    key: 'northpoint',
    name: 'Priya Raman',
    companyName: 'Northpoint Data Centre',
    email: 'security@northpointdc.example',
    phone: '+1-847-555-0119',
    branchKey: 'northside',
    contactEmail: 'priya.raman@northpointdc.example',
    hourlyRate: 41,
    overtimeRate: 61.5,
    holidayRate: 82,
    billingNotes: 'Net 30. Rates are contractual through the end of the term.',
    internalNotes:
      'Highest-margin account. All guards require a background check on file before their first shift.',
    reportEmailEnabled: true,
    reportEmailMode: ReportEmailMode.AUTOMATIC,
    sites: [
      {
        key: 'northpoint-dc1',
        name: 'Northpoint DC1',
        address: '3300 Lakeview Pkwy, Evanston, IL 60201',
        instructions:
          'Mantrap entry only. No personal phones past the SOC door. Two-person rule in the cage aisles.',
        lat: 42.0451,
        lng: -87.6877,
      },
    ],
  },
  {
    key: 'granite',
    name: 'Tom Alvarez',
    companyName: 'Granite Ridge Logistics',
    email: 'yard@graniteridge.example',
    phone: '+1-847-555-0177',
    branchKey: 'northside',
    contactEmail: 'tom.alvarez@graniteridge.example',
    hourlyRate: 24.5,
    overtimeRate: 36.75,
    holidayRate: 49,
    billingNotes: 'Net 45. Approved by finance as an exception.',
    internalNotes:
      'Chronically slow payer - chase at day 30. Yard is unlit on the north fence.',
    reportEmailEnabled: false,
    reportEmailMode: ReportEmailMode.MANUAL,
    sites: [
      {
        key: 'granite-yard',
        name: 'Granite Ridge - Distribution Yard',
        address: '910 Industrial Dr, Skokie, IL 60076',
        instructions:
          'Gatehouse check-in for all trucks. Seal numbers recorded on inbound and outbound.',
        lat: 42.0324,
        lng: -87.7416,
      },
      {
        key: 'granite-warehouse',
        name: 'Granite Ridge - Cold Storage',
        address: '930 Industrial Dr, Skokie, IL 60076',
        instructions:
          'Dock doors verified locked at shift end. Freezer alarm panel checked hourly.',
        lat: 42.0331,
        lng: -87.7423,
      },
    ],
  },
  {
    key: 'beacon',
    name: 'Alice Nwosu',
    companyName: 'Beacon Hill Academy',
    email: 'admin@beaconhillacademy.example',
    phone: '+1-312-555-0203',
    branchKey: 'downtown',
    contactEmail: 'alice.nwosu@beaconhillacademy.example',
    hourlyRate: 28,
    overtimeRate: 42,
    holidayRate: 56,
    billingNotes: 'Net 30. Invoice the business office, not the principal.',
    internalNotes:
      'Guards on campus must have the child-safeguarding module. No armed posts, ever.',
    reportEmailEnabled: true,
    reportEmailMode: ReportEmailMode.MANUAL,
    sites: [
      {
        key: 'beacon-campus',
        name: 'Beacon Hill Academy - Campus',
        address: '55 W Schiller St, Chicago, IL 60610',
        instructions:
          'Visitor screening at the Schiller gate. Door sweep at 15:30 after dismissal.',
        lat: 41.9075,
        lng: -87.6291,
      },
    ],
  },
  {
    key: 'harborview',
    name: 'Grace Lindqvist',
    companyName: 'Harborview Tower',
    email: 'property@harborviewtower.example',
    phone: '+1-312-555-0244',
    branchKey: 'downtown',
    contactEmail: 'grace.lindqvist@harborviewtower.example',
    hourlyRate: 30,
    overtimeRate: 45,
    holidayRate: 60,
    billingNotes: 'Net 30. Tenant chargebacks itemised separately.',
    internalNotes: 'New account, started this quarter. Property manager is detail-oriented.',
    reportEmailEnabled: false,
    reportEmailMode: ReportEmailMode.MANUAL,
    sites: [
      {
        key: 'harborview-lobby',
        name: 'Harborview Tower - Lobby and Docks',
        address: '401 N Wabash Ave, Chicago, IL 60611',
        instructions:
          'Concierge desk coverage 06:00-22:00. Freight dock access by appointment only.',
        lat: 41.8893,
        lng: -87.6266,
      },
    ],
  },
];

type GuardSpec = {
  key: string;
  name: string;
  email: string;
  phone: string;
  branchKey: 'downtown' | 'northside';
  salary: number;
  available: boolean;
  notes: string;
};

const GUARDS: GuardSpec[] = [
  { key: 'g-reyes', name: 'Luis Reyes', email: 'luis.reyes@aegislead-demo.example', phone: '+1-312-555-1001', branchKey: 'downtown', salary: 52000, available: true, notes: 'Site lead at Meridian. Trusted with the ED post.' },
  { key: 'g-okafor', name: 'Ada Okafor', email: 'ada.okafor@aegislead-demo.example', phone: '+1-312-555-1002', branchKey: 'downtown', salary: 54000, available: true, notes: 'De-escalation trainer. Covers supervisor shifts.' },
  { key: 'g-tran', name: 'Minh Tran', email: 'minh.tran@aegislead-demo.example', phone: '+1-312-555-1003', branchKey: 'downtown', salary: 48000, available: true, notes: 'Prefers nights. Very reliable on the garage patrol.' },
  { key: 'g-silva', name: 'Camila Silva', email: 'camila.silva@aegislead-demo.example', phone: '+1-312-555-1004', branchKey: 'downtown', salary: 47500, available: true, notes: 'Bilingual. Good with retail customer contact.' },
  { key: 'g-boyd', name: 'Derek Boyd', email: 'derek.boyd@aegislead-demo.example', phone: '+1-312-555-1005', branchKey: 'downtown', salary: 46000, available: false, notes: 'On approved leave this week - back Monday.' },
  { key: 'g-haddad', name: 'Nadia Haddad', email: 'nadia.haddad@aegislead-demo.example', phone: '+1-312-555-1006', branchKey: 'downtown', salary: 49000, available: true, notes: 'Safeguarding module complete. Cleared for the academy.' },
  { key: 'g-kowalski', name: 'Peter Kowalski', email: 'peter.kowalski@aegislead-demo.example', phone: '+1-312-555-1007', branchKey: 'downtown', salary: 45000, available: true, notes: 'Newer hire. Pair with a site lead for now.' },
  { key: 'g-mensah', name: 'Kofi Mensah', email: 'kofi.mensah@aegislead-demo.example', phone: '+1-847-555-1008', branchKey: 'northside', salary: 58000, available: true, notes: 'Cleared for DC1. Holds the current background check.' },
  { key: 'g-novak', name: 'Eva Novak', email: 'eva.novak@aegislead-demo.example', phone: '+1-847-555-1009', branchKey: 'northside', salary: 57000, available: true, notes: 'SOC experience. Handles the mantrap procedure well.' },
  { key: 'g-ibrahim', name: 'Yusuf Ibrahim', email: 'yusuf.ibrahim@aegislead-demo.example', phone: '+1-847-555-1010', branchKey: 'northside', salary: 44000, available: true, notes: 'Yard patrol. Knows the Granite Ridge seal process.' },
  { key: 'g-park', name: 'Soo-jin Park', email: 'soojin.park@aegislead-demo.example', phone: '+1-847-555-1011', branchKey: 'northside', salary: 45500, available: true, notes: 'Cold storage certified. Watches the freezer panel.' },
  { key: 'g-dubois', name: 'Henri Dubois', email: 'henri.dubois@aegislead-demo.example', phone: '+1-847-555-1012', branchKey: 'northside', salary: 46500, available: false, notes: 'Licence renewal in progress - do not schedule until cleared.' },
  { key: 'g-adeyemi', name: 'Tolu Adeyemi', email: 'tolu.adeyemi@aegislead-demo.example', phone: '+1-312-555-1013', branchKey: 'downtown', salary: 47000, available: true, notes: 'Floater across downtown sites. Flexible on short notice.' },
  { key: 'g-weiss', name: 'Hannah Weiss', email: 'hannah.weiss@aegislead-demo.example', phone: '+1-847-555-1014', branchKey: 'northside', salary: 48500, available: true, notes: 'Report writing is excellent - good for incident-heavy posts.' },
];

// ---------------------------------------------------------------------------
// Sales pipeline.
//
// Lead statuses are the backend enum (new | contacted | proposal_sent |
// responded | closed, from leads/dto/update-lead-status.dto.ts). Deal stages
// are the title-case DealStage enum the Kanban board columns are built from
// (New | Contacted | Proposal | Won | Lost). Every stage and status has at
// least one row so no column or filter renders empty.
// ---------------------------------------------------------------------------

type LeadSpec = {
  key: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'new' | 'contacted' | 'proposal_sent' | 'responded' | 'closed';
  /** Days before today the lead entered the pipeline. */
  ageDays: number;
  notes: string[];
  deal?: {
    name: string;
    stage: 'New' | 'Contacted' | 'Proposal' | 'Won' | 'Lost';
    /** Links a won deal to the client it became. */
    clientKey?: string;
    activities?: {
      type: 'call' | 'meeting' | 'task';
      subject: string;
      description: string;
      status: 'pending' | 'completed';
      dueInDays: number;
    }[];
    proposal?: {
      title: string;
      status: 'draft' | 'sent' | 'accepted' | 'rejected';
      content: string;
    };
  };
};

const LEADS: LeadSpec[] = [
  {
    key: 'l-summit',
    name: 'Rachel Okonjo',
    company: 'Summit Tech Campus',
    email: 'rachel.okonjo@summittech.example',
    phone: '+1-312-555-0301',
    status: 'responded',
    ageDays: 46,
    notes: [
      'Inbound from the website. Three buildings, wants unarmed coverage plus a lobby concierge post.',
      'Asked specifically about patrol reporting they can show their own board. Guard Tour exports are the hook here.',
    ],
    deal: {
      name: 'Summit Tech Campus - 3 buildings',
      stage: 'Proposal',
      activities: [
        { type: 'meeting', subject: 'Walkthrough of all three buildings', description: 'Met facilities lead on site. Counted 11 posts across the campus.', status: 'completed', dueInDays: -18 },
        { type: 'call', subject: 'Follow up on proposal pricing', description: 'They want the per-post breakdown split by building.', status: 'pending', dueInDays: 2 },
      ],
      proposal: {
        title: 'Security Services Proposal - Summit Tech Campus',
        status: 'sent',
        content:
          'Scope: unarmed officer coverage across three campus buildings, 24/7 lobby presence in Building A, and roving patrol of B and C on a 90-minute interval.\n\nStaffing: 11 posts, 6 officers per rotation, one site supervisor.\n\nIncluded: Guard Tour checkpoint scanning with geofence verification, daily service reports delivered to your facilities team each morning, and a client portal login for live incident visibility.\n\nRate: 29.50 per officer hour, billed monthly on Net 30 terms. Overtime at 1.5x by prior written approval only.',
      },
    },
  },
  {
    key: 'l-westgate',
    name: 'Daniel Mercer',
    company: 'Westgate Retail Group',
    email: 'daniel.mercer@westgateretail.example',
    phone: '+1-312-555-0302',
    status: 'proposal_sent',
    ageDays: 33,
    notes: [
      'Four strip-mall properties. Currently with a national provider and unhappy about guard turnover.',
    ],
    deal: {
      name: 'Westgate Retail - 4 properties',
      stage: 'Proposal',
      activities: [
        { type: 'call', subject: 'Discovery call', description: 'Pain is turnover and no reporting. Incumbent contract ends in 60 days.', status: 'completed', dueInDays: -21 },
        { type: 'task', subject: 'Send references from comparable retail accounts', description: 'Lakeshore Commons is the closest comparable - ask Marcus first.', status: 'pending', dueInDays: 4 },
      ],
      proposal: {
        title: 'Security Services Proposal - Westgate Retail Group',
        status: 'sent',
        content:
          'Scope: evening and weekend coverage across four retail properties, with vehicle patrol between sites on a published schedule.\n\nStaffing: 2 officers per property during peak hours, 1 roving vehicle patrol covering all four overnight.\n\nRetention commitment: named officers per property with a 90-day minimum assignment, which directly addresses the turnover problem raised in discovery.\n\nRate: 27.00 per officer hour, 31.00 per vehicle patrol hour. Net 30.',
      },
    },
  },
  {
    key: 'l-ironbridge',
    name: 'Susan Petrova',
    company: 'Ironbridge Manufacturing',
    email: 'susan.petrova@ironbridgemfg.example',
    phone: '+1-847-555-0303',
    status: 'contacted',
    ageDays: 27,
    notes: ['Single plant, three gates. Needs access control at the truck entrance more than guarding.'],
    deal: {
      name: 'Ironbridge Manufacturing - plant security',
      stage: 'Contacted',
      activities: [
        { type: 'call', subject: 'Intro call', description: 'Budget not confirmed yet. Decision sits with their COO.', status: 'completed', dueInDays: -12 },
        { type: 'meeting', subject: 'Site visit to scope the gates', description: 'Need to see shift-change traffic at the truck entrance.', status: 'pending', dueInDays: 6 },
      ],
    },
  },
  {
    key: 'l-crestline',
    name: 'Omar Haddad',
    company: 'Crestline Senior Living',
    email: 'omar.haddad@crestlineliving.example',
    phone: '+1-312-555-0304',
    status: 'contacted',
    ageDays: 19,
    notes: ['Two residences. Overnight concierge-style coverage, very low incident expectation.'],
    deal: {
      name: 'Crestline Senior Living - overnight coverage',
      stage: 'Contacted',
      activities: [
        { type: 'call', subject: 'Qualification call', description: 'Wants officers comfortable with residents, not a hard security posture.', status: 'completed', dueInDays: -8 },
      ],
    },
  },
  {
    key: 'l-pinnacle',
    name: 'Grace Lindqvist',
    company: 'Harborview Tower',
    email: 'grace.lindqvist@harborviewtower.example',
    phone: '+1-312-555-0244',
    status: 'closed',
    ageDays: 74,
    notes: [
      'Closed won. Started with the lobby and dock posts; they have already asked about adding garage coverage.',
    ],
    deal: {
      name: 'Harborview Tower - lobby and dock posts',
      stage: 'Won',
      clientKey: 'harborview',
      activities: [
        { type: 'meeting', subject: 'Contract signing', description: 'Signed for the lobby and dock posts. Garage is a Q+1 upsell.', status: 'completed', dueInDays: -41 },
        { type: 'task', subject: 'Schedule the 30-day service review', description: 'Property manager is detail-oriented - come with patrol completion numbers.', status: 'pending', dueInDays: 9 },
      ],
      proposal: {
        title: 'Security Services Agreement - Harborview Tower',
        status: 'accepted',
        content:
          'Scope: concierge desk coverage 06:00-22:00 daily, freight dock access control by appointment, and overnight building lock-up verification.\n\nStaffing: 2 officers on the day rotation, 1 overnight.\n\nIncluded: daily service reports, client portal access for the property management team, and monthly patrol completion reporting.\n\nRate: 30.00 per officer hour. Net 30.',
      },
    },
  },
  {
    key: 'l-brightwater',
    name: 'Victor Chen',
    company: 'Brightwater Hotels',
    email: 'victor.chen@brightwaterhotels.example',
    phone: '+1-312-555-0305',
    status: 'closed',
    ageDays: 58,
    notes: ['Closed lost on price. Went with an in-house team. Worth revisiting in 6 months.'],
    deal: {
      name: 'Brightwater Hotels - 2 properties',
      stage: 'Lost',
      activities: [
        { type: 'call', subject: 'Decision call', description: 'Lost on price - they built an in-house team instead. Revisit in 6 months.', status: 'completed', dueInDays: -26 },
      ],
      proposal: {
        title: 'Security Services Proposal - Brightwater Hotels',
        status: 'rejected',
        content:
          'Scope: overnight front-desk security presence at two downtown properties, with incident reporting into the hotel duty manager.\n\nStaffing: 1 officer per property overnight, supervisor on call.\n\nRate: 28.50 per officer hour. Net 30.',
      },
    },
  },
  {
    key: 'l-foundry',
    name: 'Nina Castellano',
    company: 'Foundry District BID',
    email: 'nina.castellano@foundrybid.example',
    phone: '+1-312-555-0306',
    status: 'new',
    ageDays: 5,
    notes: ['Business improvement district. Wants ambassador-style patrol, not hard security. Fresh inbound.'],
    deal: {
      name: 'Foundry District BID - ambassador patrol',
      stage: 'New',
      activities: [
        { type: 'call', subject: 'First outreach call', description: 'Left a voicemail. Try again midweek.', status: 'pending', dueInDays: 1 },
      ],
    },
  },
  {
    key: 'l-arcadia',
    name: 'Felix Osei',
    company: 'Arcadia Event Venue',
    email: 'felix.osei@arcadiavenue.example',
    phone: '+1-312-555-0307',
    status: 'new',
    ageDays: 3,
    notes: ['Event-by-event staffing rather than a standing contract. Good filler work between fixed posts.'],
    deal: {
      name: 'Arcadia Event Venue - event staffing',
      stage: 'New',
    },
  },
  {
    key: 'l-rivermark',
    name: 'Joanna Pike',
    company: 'Rivermark Apartments',
    email: 'joanna.pike@rivermark.example',
    phone: '+1-312-555-0308',
    status: 'new',
    ageDays: 2,
    notes: ['Referral from Harborview property management. Warm intro - call this week.'],
  },
  {
    key: 'l-halcyon',
    name: 'Bret Vaughan',
    company: 'Halcyon Biotech',
    email: 'bret.vaughan@halcyonbio.example',
    phone: '+1-847-555-0309',
    status: 'responded',
    ageDays: 38,
    notes: [
      'Lab facility, needs vetted officers and a clean compliance trail. Compliance tracking is the selling point.',
    ],
    deal: {
      name: 'Halcyon Biotech - lab facility',
      stage: 'Proposal',
      activities: [
        { type: 'meeting', subject: 'Compliance requirements review', description: 'Walked through licence and background-check tracking. They want evidence on demand.', status: 'completed', dueInDays: -9 },
        { type: 'task', subject: 'Draft the compliance appendix', description: 'Attach a sample compliance export to the proposal.', status: 'pending', dueInDays: 3 },
      ],
      proposal: {
        title: 'Security Services Proposal - Halcyon Biotech',
        status: 'draft',
        content:
          'Scope: controlled-access officer coverage for the lab facility, with visitor escort and after-hours access logging.\n\nStaffing: 2 officers on days, 1 overnight, all background-checked before first assignment.\n\nCompliance: every assigned officer has licence and background-check records tracked in-platform with expiry alerting, exportable for your audits on request.\n\nRate: 38.00 per officer hour. Net 30.\n\nStatus: draft pending the compliance appendix.',
      },
    },
  },
  {
    key: 'l-stonegate',
    name: 'Alan Reddick',
    company: 'Stonegate Plaza',
    email: 'alan.reddick@stonegateplaza.example',
    phone: '+1-312-555-0310',
    status: 'proposal_sent',
    // Also in the 8-14 day window, so the dashboard delta compares 3 recent
    // leads against 2 rather than against an empty period.
    ageDays: 13,
    notes: ['Mixed-use plaza. Comparing three vendors - decision expected within the month.'],
    deal: {
      name: 'Stonegate Plaza - mixed-use coverage',
      stage: 'Contacted',
      activities: [
        { type: 'call', subject: 'Vendor comparison call', description: 'We are one of three. Differentiator is the reporting, not the rate.', status: 'completed', dueInDays: -6 },
      ],
    },
  },
  {
    key: 'l-kestrel',
    name: 'Maya Sorenson',
    company: 'Kestrel Logistics Park',
    email: 'maya.sorenson@kestrelpark.example',
    phone: '+1-847-555-0311',
    status: 'contacted',
    // 11 days: deliberately inside the 8-14 day window. The dashboard's
    // "vs previous 7 days" delta is null unless that window has leads in it,
    // and a blank delta on the headline tile looks like a broken chart.
    ageDays: 11,
    notes: ['Large yard, similar profile to Granite Ridge. Reuse that scope as the starting point.'],
    deal: {
      name: 'Kestrel Logistics Park - yard security',
      stage: 'Contacted',
    },
  },
];

// ---------------------------------------------------------------------------
// Target resolution + reset
// ---------------------------------------------------------------------------

/**
 * Counts the business rows this script owns, so we can refuse to seed on top
 * of an account that already has data and would end up with duplicates.
 */
async function countBusinessData(tenantId: string) {
  const where = { tenantId };
  const [
    branches, clients, sites, guards, shifts, incidents, leads, deals,
    proposals, invoices, timesheets, rateCards, reports, checkpoints,
    patrolRoutes, patrolRuns, clientUsers, prospectHistory, savedSearches,
  ] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.client.count({ where }),
    prisma.site.count({ where }),
    prisma.guard.count({ where }),
    prisma.shift.count({ where }),
    prisma.incident.count({ where }),
    prisma.lead.count({ where }),
    prisma.deal.count({ where }),
    prisma.proposal.count({ where }),
    prisma.invoice.count({ where }),
    prisma.timesheet.count({ where }),
    prisma.rateCard.count({ where }),
    prisma.dailyServiceReport.count({ where }),
    prisma.checkpoint.count({ where }),
    prisma.patrolRoute.count({ where }),
    prisma.patrolRun.count({ where }),
    prisma.clientUser.count({ where }),
    prisma.prospectSearchHistory.count({ where }),
    prisma.savedProspectSearch.count({ where }),
  ]);

  const counts = {
    branches, clients, sites, guards, shifts, incidents, leads, deals,
    proposals, invoices, timesheets, rateCards, reports, checkpoints,
    patrolRoutes, patrolRuns, clientUsers, prospectHistory, savedSearches,
  };
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, total };
}

/**
 * Deletes this tenant's demo business data, children first so no foreign key
 * is ever left dangling. Deliberately does NOT touch the tenant, its users,
 * roles, modules, subscription or credit balance -- those are the account
 * itself, not the demo data layered on top of it.
 *
 * The credit ledger is rewound to a single PURCHASE row for the balance,
 * because the seed writes usage rows and re-running must not stack them.
 *
 * Takes its client as an argument rather than reaching for the module binding,
 * so it can run either in its own transaction or inside the rehearsal's.
 */
async function resetTenantWith(tx: Prisma.TransactionClient, tenantId: string) {
  {
    await tx.patrolEvidence.deleteMany({ where: { tenantId } });
    await tx.patrolEvent.deleteMany({ where: { tenantId } });
    await tx.patrolRun.deleteMany({ where: { tenantId } });
    await tx.patrolRouteCheckpoint.deleteMany({
      where: { patrolRoute: { tenantId } },
    });
    await tx.patrolRoute.deleteMany({ where: { tenantId } });
    await tx.checkpoint.deleteMany({ where: { tenantId } });

    await tx.incidentEvidence.deleteMany({ where: { tenantId } });
    await tx.incident.deleteMany({ where: { tenantId } });

    await tx.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
    await tx.invoiceDispute.deleteMany({ where: { tenantId } });
    await tx.invoice.deleteMany({ where: { tenantId } });
    await tx.timesheet.deleteMany({ where: { tenantId } });
    await tx.rateCard.deleteMany({ where: { tenantId } });
    await tx.dailyServiceReport.deleteMany({ where: { tenantId } });

    await tx.attendanceEvent.deleteMany({ where: { tenantId } });
    await tx.assignment.deleteMany({ where: { shift: { tenantId } } });
    await tx.shift.deleteMany({ where: { tenantId } });
    await tx.availability.deleteMany({ where: { tenantId } });
    await tx.guardCompliance.deleteMany({ where: { tenantId } });
    await tx.guard.deleteMany({ where: { tenantId } });

    await tx.proposalComment.deleteMany({ where: { tenantId } });
    await tx.proposalVersion.deleteMany({
      where: { proposal: { tenantId } },
    });
    await tx.proposal.deleteMany({ where: { tenantId } });
    await tx.activity.deleteMany({ where: { tenantId } });
    await tx.note.deleteMany({ where: { tenantId } });
    await tx.callRecord.deleteMany({ where: { tenantId } });
    await tx.deal.deleteMany({ where: { tenantId } });
    await tx.lead.deleteMany({ where: { tenantId } });

    await tx.clientInsurancePolicy.deleteMany({ where: { tenantId } });
    await tx.site.deleteMany({ where: { tenantId } });
    await tx.clientUser.deleteMany({ where: { tenantId } });
    await tx.client.deleteMany({ where: { tenantId } });

    await tx.prospectSearchHistory.deleteMany({ where: { tenantId } });
    await tx.savedProspectSearch.deleteMany({ where: { tenantId } });

    // Branch last: sites, guards, shifts and invoices all point at it.
    // Users may too, so detach them rather than deleting the user.
    await tx.user.updateMany({
      where: { tenantId, branchId: { not: null } },
      data: { branchId: null },
    });
    await tx.userRoleAssignment.updateMany({
      where: { tenantId, branchId: { not: null } },
      data: { branchId: null },
    });
    await tx.branch.updateMany({
      where: { tenantId },
      data: { managerId: null },
    });
    await tx.branch.deleteMany({ where: { tenantId } });

    // Rewind the ledger to one PURCHASE row matching the balance, keeping the
    // invariant that balance == sum(amount).
    const balance = await tx.tenantCreditBalance.findUnique({
      where: { tenantId },
      select: { balance: true },
    });
    const amount = balance?.balance ?? 0;
    await tx.creditLedgerEntry.deleteMany({ where: { tenantId } });
    if (balance) {
      await tx.tenantCreditBalance.update({
        where: { tenantId },
        data: { lifetimePurchased: amount, lifetimeConsumed: 0 },
      });
      await tx.creditLedgerEntry.create({
        data: {
          tenantId,
          type: CreditEntryType.PURCHASE,
          amount,
          balanceAfter: amount,
          description: `Account provisioned with ${amount} Prospect Search credits.`,
        },
      });
    }
  }
}

/** Normal path: the reset gets its own transaction. */
async function resetTenant(tenantId: string) {
  await client.$transaction((tx) => resetTenantWith(tx, tenantId), {
    timeout: 120000,
  });
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

type Seeded = {
  branchIds: Record<string, string>;
  clientIds: Record<string, string>;
  siteIds: Record<string, string>;
  guardIds: Record<string, string>;
  rateCardIds: Record<string, string>;
  counts: Record<string, number>;
};

async function seed(tenantId: string, adminUserId: string): Promise<Seeded> {
  const counts: Record<string, number> = {};
  const bump = (key: string, n = 1) => {
    counts[key] = (counts[key] ?? 0) + n;
  };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_PASSWORD_ROUNDS);

  // --- Branches -----------------------------------------------------------
  // The demo user manages Downtown, so the "my branch" views are populated.
  const downtown = await prisma.branch.create({
    data: {
      tenantId,
      name: 'Downtown Operations',
      location: 'Chicago, IL - Loop',
      status: 'active',
      managerId: adminUserId,
      createdAt: daysAgo(180),
    },
  });
  const northside = await prisma.branch.create({
    data: {
      tenantId,
      name: 'North Side Operations',
      location: 'Evanston, IL',
      status: 'active',
      createdAt: daysAgo(120),
    },
  });
  bump('branches', 2);

  const branchIds: Record<string, string> = {
    downtown: downtown.id,
    northside: northside.id,
  };

  // --- Clients, sites, rate cards, portal logins --------------------------
  const clientIds: Record<string, string> = {};
  const siteIds: Record<string, string> = {};
  const rateCardIds: Record<string, string> = {};

  for (const spec of CLIENTS) {
    const branchId = branchIds[spec.branchKey];
    // Harborview is the newest account; the rest predate it.
    const clientAge = spec.key === 'harborview' ? 41 : 150 + CLIENTS.indexOf(spec) * 12;

    const client = await prisma.client.create({
      data: {
        tenantId,
        branchId,
        name: spec.name,
        companyName: spec.companyName,
        email: spec.email,
        phone: spec.phone,
        billingNotes: spec.billingNotes,
        internalNotes: spec.internalNotes,
        reportEmailEnabled: spec.reportEmailEnabled,
        reportEmailMode: spec.reportEmailMode,
        createdAt: daysAgo(clientAge),
      },
    });
    clientIds[spec.key] = client.id;
    bump('clients');

    for (const siteSpec of spec.sites) {
      const site = await prisma.site.create({
        data: {
          tenantId,
          branchId,
          clientId: client.id,
          name: siteSpec.name,
          address: siteSpec.address,
          instructions: siteSpec.instructions,
          createdAt: daysAgo(clientAge - 2),
        },
      });
      siteIds[siteSpec.key] = site.id;
      bump('sites');
    }

    // One client-wide rate card, effective from before the oldest invoice so
    // every invoice can legitimately cite it.
    const rateCard = await prisma.rateCard.create({
      data: {
        tenantId,
        clientId: client.id,
        siteId: null,
        roleName: 'Security Officer',
        hourlyRate: spec.hourlyRate,
        overtimeRate: spec.overtimeRate,
        holidayRate: spec.holidayRate,
        effectiveFrom: daysAgo(clientAge - 3),
        effectiveTo: null,
        status: 'active',
        createdAt: daysAgo(clientAge - 3),
      },
    });
    rateCardIds[spec.key] = rateCard.id;
    bump('rateCards');

    // Client portal login, verified so it can actually sign in.
    await prisma.clientUser.create({
      data: {
        tenantId,
        clientId: client.id,
        email: spec.contactEmail,
        password: passwordHash,
        emailVerified: true,
        emailVerifiedAt: daysAgo(clientAge - 1),
        createdAt: daysAgo(clientAge - 1),
      },
    });
    bump('clientUsers');
  }

  // Certificates of insurance: one current, one expiring soon, one expired,
  // so the compliance screen has all three states to show.
  const coiSpecs: {
    clientKey: string;
    policyNumber: string;
    carrier: string;
    expiresInDays: number;
  }[] = [
    { clientKey: 'meridian', policyNumber: 'GL-884120-A', carrier: 'Lakefront Casualty', expiresInDays: 212 },
    { clientKey: 'lakeshore', policyNumber: 'GL-771903-B', carrier: 'Midwest Mutual', expiresInDays: 24 },
    { clientKey: 'granite', policyNumber: 'GL-559017-C', carrier: 'Prairie Indemnity', expiresInDays: -16 },
    { clientKey: 'northpoint', policyNumber: 'GL-640255-D', carrier: 'Lakefront Casualty', expiresInDays: 301 },
  ];
  for (const coi of coiSpecs) {
    await prisma.clientInsurancePolicy.create({
      data: {
        tenantId,
        clientId: clientIds[coi.clientKey],
        siteId: null,
        type: 'General Liability',
        policyNumber: coi.policyNumber,
        insurer: coi.carrier,
        coverageAmount: 2000000,
        effectiveDate: daysAgo(365 - Math.max(coi.expiresInDays, 0)),
        expirationDate: daysAhead(coi.expiresInDays),
        notes:
          coi.expiresInDays < 0
            ? 'Renewal certificate requested from the broker - overdue.'
            : coi.expiresInDays < 30
              ? 'Renewal in progress, certificate expected shortly.'
              : null,
        createdBy: adminUserId,
        createdAt: daysAgo(120),
      },
    });
    bump('insurancePolicies');
  }

  // --- Guards, availability, compliance -----------------------------------
  const guardIds: Record<string, string> = {};

  for (const spec of GUARDS) guardIds[spec.key] = randomUUID();

  await prisma.guard.createMany({
    data: GUARDS.map((spec, index) => ({
      id: guardIds[spec.key],
      tenantId,
      branchId: branchIds[spec.branchKey],
      name: spec.name,
      email: spec.email,
      phone: spec.phone,
      // Real hash, so the guard portal can be demoed with these accounts.
      passwordHash,
      salary: spec.salary,
      bankDetails: 'Direct deposit on file (demo record - no real account).',
      personalNotes: spec.notes,
      createdAt: daysAgo(160 - index * 4),
    })),
  });
  bump('guards', GUARDS.length);

  await prisma.availability.createMany({
    data: GUARDS.map((spec) => ({
      tenantId,
      guardId: guardIds[spec.key],
      status: spec.available ? 'available' : 'unavailable',
      startDate: spec.available ? null : daysAgo(2),
      endDate: spec.available ? null : daysAhead(5),
      createdAt: daysAgo(60),
    })),
  });
  bump('availability', GUARDS.length);

  // Compliance documents. Most are current; two expire soon and two have
  // lapsed, because an all-green compliance screen demonstrates nothing.
  // Status is always derived server-side from expirationDate, never stored.
  const complianceSpecs: {
    guardKey: string;
    type: string;
    docNumber: string;
    authority: string;
    expiresInDays: number;
  }[] = [
    { guardKey: 'g-reyes', type: 'Security Guard Licence', docNumber: 'IL-PERC-884210', authority: 'Illinois IDFPR', expiresInDays: 288 },
    { guardKey: 'g-reyes', type: 'First Aid / CPR', docNumber: 'AHA-553019', authority: 'American Heart Association', expiresInDays: 140 },
    { guardKey: 'g-okafor', type: 'Security Guard Licence', docNumber: 'IL-PERC-884311', authority: 'Illinois IDFPR', expiresInDays: 199 },
    { guardKey: 'g-okafor', type: 'De-escalation Certification', docNumber: 'DE-2024-118', authority: 'Crisis Prevention Institute', expiresInDays: 95 },
    { guardKey: 'g-tran', type: 'Security Guard Licence', docNumber: 'IL-PERC-884455', authority: 'Illinois IDFPR', expiresInDays: 26 },
    { guardKey: 'g-silva', type: 'Security Guard Licence', docNumber: 'IL-PERC-884502', authority: 'Illinois IDFPR', expiresInDays: 321 },
    { guardKey: 'g-boyd', type: 'Security Guard Licence', docNumber: 'IL-PERC-884610', authority: 'Illinois IDFPR', expiresInDays: 73 },
    { guardKey: 'g-haddad', type: 'Child Safeguarding Module', docNumber: 'CSG-7741', authority: 'Beacon Hill Academy', expiresInDays: 258 },
    { guardKey: 'g-haddad', type: 'Security Guard Licence', docNumber: 'IL-PERC-884733', authority: 'Illinois IDFPR', expiresInDays: 177 },
    { guardKey: 'g-kowalski', type: 'Security Guard Licence', docNumber: 'IL-PERC-884890', authority: 'Illinois IDFPR', expiresInDays: 11 },
    { guardKey: 'g-mensah', type: 'Security Guard Licence', docNumber: 'IL-PERC-885012', authority: 'Illinois IDFPR', expiresInDays: 244 },
    { guardKey: 'g-mensah', type: 'Background Check', docNumber: 'BGC-2026-3310', authority: 'Northpoint Data Centre', expiresInDays: 165 },
    { guardKey: 'g-novak', type: 'Security Guard Licence', docNumber: 'IL-PERC-885144', authority: 'Illinois IDFPR', expiresInDays: 203 },
    { guardKey: 'g-novak', type: 'Background Check', docNumber: 'BGC-2026-3311', authority: 'Northpoint Data Centre', expiresInDays: 158 },
    { guardKey: 'g-ibrahim', type: 'Security Guard Licence', docNumber: 'IL-PERC-885277', authority: 'Illinois IDFPR', expiresInDays: 130 },
    { guardKey: 'g-park', type: 'Security Guard Licence', docNumber: 'IL-PERC-885390', authority: 'Illinois IDFPR', expiresInDays: 268 },
    { guardKey: 'g-park', type: 'Cold Storage Safety', docNumber: 'CSS-9920', authority: 'Granite Ridge Logistics', expiresInDays: 88 },
    { guardKey: 'g-dubois', type: 'Security Guard Licence', docNumber: 'IL-PERC-885401', authority: 'Illinois IDFPR', expiresInDays: -9 },
    { guardKey: 'g-adeyemi', type: 'Security Guard Licence', docNumber: 'IL-PERC-885566', authority: 'Illinois IDFPR', expiresInDays: 232 },
    { guardKey: 'g-weiss', type: 'Security Guard Licence', docNumber: 'IL-PERC-885678', authority: 'Illinois IDFPR', expiresInDays: 191 },
    { guardKey: 'g-weiss', type: 'First Aid / CPR', docNumber: 'AHA-553420', authority: 'American Heart Association', expiresInDays: -31 },
  ];
  await prisma.guardCompliance.createMany({
    data: complianceSpecs.map((spec) => ({
      tenantId,
      guardId: guardIds[spec.guardKey],
      type: spec.type,
      documentNumber: spec.docNumber,
      issuingAuthority: spec.authority,
      issueDate: daysAgo(365 + Math.max(-spec.expiresInDays, 0)),
      expirationDate: daysAhead(spec.expiresInDays),
      notes:
        spec.expiresInDays < 0
          ? 'EXPIRED - guard must not be scheduled until this is renewed.'
          : spec.expiresInDays < 30
            ? 'Renewal submitted, awaiting the updated document.'
            : null,
      createdBy: adminUserId,
      createdAt: daysAgo(100),
    })),
  });
  bump('complianceRecords', complianceSpecs.length);

  return { branchIds, clientIds, siteIds, guardIds, rateCardIds, counts };
}

// ---------------------------------------------------------------------------
// Operations: checkpoints, patrol routes, shifts, attendance, patrol runs,
// incidents, timesheets.
// ---------------------------------------------------------------------------

/** Which guards normally work which site, so the schedule looks deliberate. */
const SITE_STAFFING: Record<string, { guardKeys: string[]; postsPerDay: number }> = {
  'meridian-main': { guardKeys: ['g-reyes', 'g-okafor', 'g-adeyemi'], postsPerDay: 2 },
  'meridian-ed': { guardKeys: ['g-okafor', 'g-silva', 'g-kowalski'], postsPerDay: 2 },
  'lakeshore-mall': { guardKeys: ['g-silva', 'g-adeyemi', 'g-kowalski'], postsPerDay: 2 },
  'lakeshore-garage': { guardKeys: ['g-tran', 'g-boyd'], postsPerDay: 1 },
  'northpoint-dc1': { guardKeys: ['g-mensah', 'g-novak'], postsPerDay: 2 },
  'granite-yard': { guardKeys: ['g-ibrahim', 'g-weiss'], postsPerDay: 1 },
  'granite-warehouse': { guardKeys: ['g-park', 'g-ibrahim'], postsPerDay: 1 },
  'beacon-campus': { guardKeys: ['g-haddad', 'g-kowalski'], postsPerDay: 1 },
  'harborview-lobby': { guardKeys: ['g-adeyemi', 'g-tran', 'g-weiss'], postsPerDay: 1 },
};

/** Checkpoints per site, offset slightly from the site's coordinates. */
const CHECKPOINTS: Record<string, { name: string; note: string; dLat: number; dLng: number }[]> = {
  'meridian-main': [
    { name: 'Main Lobby Desk', note: 'Ground floor, by the visitor badge printer.', dLat: 0, dLng: 0 },
    { name: 'Pharmacy Corridor', note: 'Level 2, outside the dispensary door.', dLat: 0.0004, dLng: 0.0003 },
    { name: 'Roof Access Door', note: 'Stairwell C, top landing.', dLat: -0.0003, dLng: 0.0005 },
    { name: 'Loading Bay', note: 'Rear of building, bay 2.', dLat: 0.0006, dLng: -0.0004 },
  ],
  'meridian-ed': [
    { name: 'Triage Desk', note: 'Beside the ambulance entrance.', dLat: 0, dLng: 0 },
    { name: 'Ambulance Bay', note: 'Outside, under the canopy.', dLat: 0.0003, dLng: 0.0002 },
    { name: 'ED Waiting Room', note: 'Far corner by the vending machines.', dLat: -0.0002, dLng: 0.0004 },
  ],
  'lakeshore-mall': [
    { name: 'North Entrance', note: 'By the mall directory.', dLat: 0, dLng: 0 },
    { name: 'Food Court', note: 'Centre of level 2.', dLat: 0.0004, dLng: 0.0003 },
    { name: 'Anchor Store Corridor', note: 'Level 1, west wing.', dLat: -0.0004, dLng: 0.0002 },
    { name: 'Service Corridor', note: 'Behind the food court, staff only.', dLat: 0.0002, dLng: -0.0005 },
  ],
  'lakeshore-garage': [
    { name: 'P1 Elevator Lobby', note: 'Ground level by the pay station.', dLat: 0, dLng: 0 },
    { name: 'P3 Stairwell', note: 'South stairwell, level 3.', dLat: 0.0003, dLng: 0.0003 },
    { name: 'P5 Roof Deck', note: 'Open-air top level.', dLat: 0.0005, dLng: 0.0005 },
  ],
  'northpoint-dc1': [
    { name: 'Mantrap Entry', note: 'Badge plus PIN, outer door.', dLat: 0, dLng: 0 },
    { name: 'SOC Door', note: 'Operations centre, no phones past this point.', dLat: 0.0002, dLng: 0.0002 },
    { name: 'Cage Aisle A', note: 'Two-person rule applies.', dLat: 0.0004, dLng: 0.0001 },
    { name: 'Generator Yard', note: 'Exterior, east fence line.', dLat: -0.0004, dLng: 0.0004 },
  ],
  'granite-yard': [
    { name: 'Gatehouse', note: 'Truck check-in window.', dLat: 0, dLng: 0 },
    { name: 'North Fence Line', note: 'Unlit section - carry a torch.', dLat: 0.0006, dLng: 0.0002 },
    { name: 'Trailer Row', note: 'Parked trailers, seals checked here.', dLat: 0.0003, dLng: -0.0004 },
  ],
  'granite-warehouse': [
    { name: 'Dock Doors 1-6', note: 'Verify locked at shift end.', dLat: 0, dLng: 0 },
    { name: 'Freezer Alarm Panel', note: 'Checked hourly, log the temperature.', dLat: 0.0002, dLng: 0.0003 },
  ],
  'beacon-campus': [
    { name: 'Schiller Gate', note: 'Visitor screening point.', dLat: 0, dLng: 0 },
    { name: 'Gymnasium Doors', note: 'Checked on the dismissal sweep.', dLat: 0.0003, dLng: 0.0002 },
    { name: 'Science Wing', note: 'Second floor corridor.', dLat: -0.0002, dLng: 0.0003 },
  ],
  'harborview-lobby': [
    { name: 'Concierge Desk', note: 'Main lobby, street side.', dLat: 0, dLng: 0 },
    { name: 'Freight Dock', note: 'Lower level, appointment access only.', dLat: 0.0003, dLng: -0.0003 },
    { name: 'Tenant Mail Room', note: 'Off the lobby corridor.', dLat: 0.0001, dLng: 0.0004 },
  ],
};

async function seedOperations(
  tenantId: string,
  adminUserId: string,
  seeded: Seeded,
) {
  const { branchIds, clientIds, siteIds, guardIds } = seeded;
  const counts: Record<string, number> = {};
  const bump = (key: string, n = 1) => {
    counts[key] = (counts[key] ?? 0) + n;
  };

  const siteToClient: Record<string, string> = {};
  const siteToBranch: Record<string, string> = {};
  for (const client of CLIENTS) {
    for (const site of client.sites) {
      siteToClient[site.key] = clientIds[client.key];
      siteToBranch[site.key] = branchIds[client.branchKey];
    }
  }
  const siteSpecByKey: Record<string, SiteSpec> = {};
  for (const client of CLIENTS) {
    for (const site of client.sites) siteSpecByKey[site.key] = site;
  }

  // --- Checkpoints + one patrol route per site ----------------------------
  const checkpointIds: Record<string, string[]> = {};
  const routeIds: Record<string, string> = {};

  for (const [siteKey, checkpoints] of Object.entries(CHECKPOINTS)) {
    const siteSpec = siteSpecByKey[siteKey];
    const ids: string[] = [];

    for (const cp of checkpoints) {
      const checkpoint = await prisma.checkpoint.create({
        data: {
          tenantId,
          siteId: siteIds[siteKey],
          name: cp.name,
          description: `${cp.name} patrol checkpoint.`,
          locationNote: cp.note,
          // A stable, scannable value per checkpoint, matching the QR the
          // guard app expects to read.
          qrCodeValue: `AEGIS-${siteKey.toUpperCase()}-${cp.name.replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()}`,
          latitude: siteSpec.lat + cp.dLat,
          longitude: siteSpec.lng + cp.dLng,
          geofenceRadiusMeters: 50,
          status: 'active',
          createdAt: daysAgo(90),
        },
      });
      ids.push(checkpoint.id);
      bump('checkpoints');
    }
    checkpointIds[siteKey] = ids;

    const route = await prisma.patrolRoute.create({
      data: {
        tenantId,
        siteId: siteIds[siteKey],
        name: `${siteSpec.name.split(' - ').pop()} - Standard Round`,
        description: `Standard patrol round covering ${ids.length} checkpoints in sequence.`,
        status: 'active',
        createdAt: daysAgo(88),
        checkpoints: {
          create: ids.map((checkpointId, index) => ({
            checkpointId,
            sequenceOrder: index + 1,
          })),
        },
      },
    });
    routeIds[siteKey] = route.id;
    bump('patrolRoutes');
    bump('routeCheckpoints', ids.length);
  }

  // --- Shifts -------------------------------------------------------------
  // Past shifts (56 days back) get assignments, attendance, timesheets and
  // patrol runs. Future shifts (next 10 days) are the live schedule, with
  // some deliberately left unfilled so the coverage gap is visible.
  const siteKeys = Object.keys(SITE_STAFFING);
  type PastShift = {
    shiftId: string;
    siteKey: string;
    guardKey: string;
    start: Date;
    end: Date;
    hours: number;
  };
  const pastShifts: PastShift[] = [];

  // Built in memory and written with createMany, not one create per row.
  // This is the bulk of the seed (hundreds of shifts, assignments and
  // attendance events), and a sequential create per row means a separate
  // round-trip to a remote database for each one -- slow enough on Neon that
  // it overruns Prisma's interactive-transaction deadline. Ids are generated
  // here so relations can be wired up without reading the rows back.
  const shiftRows: Prisma.ShiftCreateManyInput[] = [];
  const assignmentRows: Prisma.AssignmentCreateManyInput[] = [];
  const attendanceRows: Prisma.AttendanceEventCreateManyInput[] = [];

  for (let dayOffset = 56; dayOffset >= 1; dayOffset -= 1) {
    // Thin the history out beyond three weeks so the seed stays a sensible
    // size while still filling the 8-week dashboard trend.
    if (dayOffset > 21 && dayOffset % 2 === 1) continue;

    for (const siteKey of siteKeys) {
      const staffing = SITE_STAFFING[siteKey];
      const start = daysAgo(dayOffset, 7, 0);
      const end = hoursAfter(start, 12);
      const shiftId = randomUUID();

      shiftRows.push({
        id: shiftId,
        tenantId,
        branchId: siteToBranch[siteKey],
        siteId: siteIds[siteKey],
        startTime: start,
        endTime: end,
        requiredGuards: staffing.postsPerDay,
        status: 'completed',
        createdAt: daysAgo(dayOffset + 3),
      });

      // Rotate guards through the site so attendance is spread across staff.
      for (let post = 0; post < staffing.postsPerDay; post += 1) {
        const guardKey =
          staffing.guardKeys[(dayOffset + post) % staffing.guardKeys.length];

        assignmentRows.push({
          shiftId,
          guardId: guardIds[guardKey],
          status: 'confirmed',
          createdAt: daysAgo(dayOffset + 2),
        });

        // A handful of no-shows, so attendance is not uniformly perfect.
        const noShow = dayOffset % 19 === 0 && post === 0;
        if (noShow) continue;

        // Most guards are punctual; some drift by a few minutes.
        const inDrift = ((dayOffset * 7 + post * 13) % 11) - 3;
        const checkIn = new Date(start.getTime() + inDrift * 60 * 1000);
        const outDrift = (dayOffset * 5 + post * 3) % 9;
        const checkOut = new Date(end.getTime() + outDrift * 60 * 1000);

        attendanceRows.push(
          {
            tenantId, guardId: guardIds[guardKey], shiftId,
            type: AttendanceEventType.CHECK_IN, timestamp: checkIn,
            source: 'guard_portal', createdAt: checkIn,
          },
          {
            tenantId, guardId: guardIds[guardKey], shiftId,
            type: AttendanceEventType.CHECK_OUT, timestamp: checkOut,
            source: 'guard_portal', createdAt: checkOut,
          },
        );

        const hours = round2((checkOut.getTime() - checkIn.getTime()) / 3600000);
        pastShifts.push({ shiftId, siteKey, guardKey, start: checkIn, end: checkOut, hours });
      }
    }
  }

  // Future schedule.
  for (let dayAhead = 0; dayAhead <= 10; dayAhead += 1) {
    for (const siteKey of siteKeys) {
      const staffing = SITE_STAFFING[siteKey];
      const start = daysAhead(dayAhead, 7, 0);
      const end = hoursAfter(start, 12);
      const shiftId = randomUUID();

      // Leave the far end of the schedule unstaffed: an "open" shift
      // is the thing a scheduler actually needs to see.
      const fill = dayAhead <= 6;

      shiftRows.push({
        id: shiftId,
        tenantId,
        branchId: siteToBranch[siteKey],
        siteId: siteIds[siteKey],
        startTime: start,
        endTime: end,
        requiredGuards: staffing.postsPerDay,
        status: fill ? 'assigned' : 'open',
        createdAt: daysAgo(4),
      });

      if (!fill) continue;

      for (let post = 0; post < staffing.postsPerDay; post += 1) {
        const guardKey = staffing.guardKeys[(dayAhead + post) % staffing.guardKeys.length];
        assignmentRows.push({
          shiftId,
          guardId: guardIds[guardKey],
          // Today and tomorrow are confirmed; later in the week is pending.
          status: dayAhead <= 1 ? 'confirmed' : 'pending',
          createdAt: daysAgo(3),
        });
      }
    }
  }

  // Order matters: assignments and attendance both reference Shift.
  await prisma.shift.createMany({ data: shiftRows });
  bump('shifts', shiftRows.length);
  await prisma.assignment.createMany({ data: assignmentRows });
  bump('assignments', assignmentRows.length);
  await prisma.attendanceEvent.createMany({ data: attendanceRows });
  bump('attendanceEvents', attendanceRows.length);

  return { counts, pastShifts, checkpointIds, routeIds, siteToClient, siteToBranch };
}

// ---------------------------------------------------------------------------
// Patrol runs, incidents, timesheets, invoices, daily service reports.
// ---------------------------------------------------------------------------

type PastShift = {
  shiftId: string;
  siteKey: string;
  guardKey: string;
  start: Date;
  end: Date;
  hours: number;
};

async function seedPatrolsAndFinance(
  tenantId: string,
  adminUserId: string,
  seeded: Seeded,
  ops: {
    pastShifts: PastShift[];
    checkpointIds: Record<string, string[]>;
    routeIds: Record<string, string>;
    siteToClient: Record<string, string>;
    siteToBranch: Record<string, string>;
  },
) {
  const { siteIds, guardIds, clientIds, rateCardIds } = seeded;
  const { pastShifts, checkpointIds, routeIds, siteToClient, siteToBranch } = ops;
  const counts: Record<string, number> = {};
  const bump = (key: string, n = 1) => {
    counts[key] = (counts[key] ?? 0) + n;
  };

  const clientKeyBySiteKey: Record<string, string> = {};
  for (const client of CLIENTS) {
    for (const site of client.sites) clientKeyBySiteKey[site.key] = client.key;
  }
  const siteSpecByKey: Record<string, SiteSpec> = {};
  for (const client of CLIENTS) {
    for (const site of client.sites) siteSpecByKey[site.key] = site;
  }

  // --- Patrol runs --------------------------------------------------------
  // One run per past shift for the most recent three weeks. Older shifts get
  // no run, which is realistic (patrol routes were rolled out progressively)
  // and keeps the seed from exploding in size.
  const recent = pastShifts.filter((s) => s.start.getTime() > Date.now() - 22 * DAY_MS);

  const patrolRunRows: Prisma.PatrolRunCreateManyInput[] = [];
  const patrolEventRows: Prisma.PatrolEventCreateManyInput[] = [];

  for (const shift of recent) {
    const checkpoints = checkpointIds[shift.siteKey];
    const routeId = routeIds[shift.siteKey];
    if (!checkpoints?.length || !routeId) continue;

    const dayIndex = Math.round((Date.now() - shift.start.getTime()) / DAY_MS);

    // Most runs complete. Every so often one is missed entirely, and one in
    // a while a run is left part-done, so the exception views have content.
    const missed = dayIndex % 17 === 0;
    const partial = !missed && dayIndex % 11 === 0;

    const startedAt = new Date(shift.start.getTime() + 45 * 60 * 1000);
    const scanCount = missed ? 0 : partial ? Math.max(1, checkpoints.length - 2) : checkpoints.length;
    const completed = !missed && !partial;

    const siteSpec = siteSpecByKey[shift.siteKey];
    const runId = randomUUID();

    patrolRunRows.push({
      id: runId,
      tenantId,
      shiftId: shift.shiftId,
      guardId: guardIds[shift.guardKey],
      patrolRouteId: routeId,
      status: missed ? 'missed' : completed ? 'completed' : 'in_progress',
      startedAt: missed ? null : startedAt,
      completedAt: completed ? new Date(startedAt.getTime() + 50 * 60 * 1000) : null,
      // Live tracking is only meaningful on a run still in progress.
      lastLatitude: completed || missed ? null : siteSpec.lat + 0.0002,
      lastLongitude: completed || missed ? null : siteSpec.lng + 0.0002,
      lastAccuracyMeters: completed || missed ? null : 12,
      lastLocationAt: completed || missed ? null : new Date(startedAt.getTime() + 30 * 60 * 1000),
      createdAt: startedAt,
    });

    for (let i = 0; i < scanCount; i += 1) {
      // One scan in a while lands outside the geofence, which is exactly the
      // case the geofence feature exists to surface.
      const outside = dayIndex % 13 === 0 && i === 1;
      const scannedAt = new Date(startedAt.getTime() + i * 12 * 60 * 1000);
      const distance = outside ? 180 + (dayIndex % 40) : 4 + ((i * 3) % 20);

      patrolEventRows.push({
        tenantId,
        patrolRunId: runId,
        checkpointId: checkpoints[i],
        guardId: guardIds[shift.guardKey],
        scannedAt,
        status: 'completed',
        notes: outside
          ? 'Scanned from the far side of the car park - could not approach the checkpoint directly.'
          : null,
        verificationStatus: outside
          ? CheckpointVerificationStatus.OUTSIDE_GEOFENCE
          : CheckpointVerificationStatus.SUCCESS,
        distanceMeters: distance,
        submittedLatitude: siteSpec.lat + (outside ? 0.0016 : 0.00002 * i),
        submittedLongitude: siteSpec.lng + (outside ? 0.0016 : 0.00002 * i),
        createdAt: scannedAt,
      });
    }
  }

  // PatrolEvent references PatrolRun, so runs first.
  await prisma.patrolRun.createMany({ data: patrolRunRows });
  bump('patrolRuns', patrolRunRows.length);
  await prisma.patrolEvent.createMany({ data: patrolEventRows });
  bump('patrolEvents', patrolEventRows.length);

  // --- Incidents ----------------------------------------------------------
  // Every severity and every review state, attached to real shifts so the
  // site / guard / timestamp on each one is internally consistent.
  const incidentSpecs: {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'submitted' | 'under_review' | 'approved' | 'rejected';
    siteKey: string;
    reviewNote?: string;
  }[] = [
    {
      title: 'Unsecured fire door on level 2',
      description:
        'Found the stairwell fire door propped open with a wedge during the 02:15 round. Removed the wedge and confirmed the door latched. Nobody was in the stairwell. Reported to the night facilities contact.',
      severity: 'low', status: 'approved', siteKey: 'meridian-main',
      reviewNote: 'Correct action taken. Passed to facilities to follow up on who propped it.',
    },
    {
      title: 'Verbal altercation in the ED waiting room',
      description:
        'Two visitors argued loudly over waiting times at approximately 19:40. Separated the parties, used de-escalation, and one party left voluntarily. No injuries, no police involvement, nursing staff informed.',
      severity: 'medium', status: 'approved', siteKey: 'meridian-ed',
      reviewNote: 'Textbook de-escalation. Noted for the monthly client review.',
    },
    {
      title: 'Attempted vehicle break-in on P3',
      description:
        'Observed an individual trying door handles along the P3 row at 23:10. Challenged verbally, the individual left the structure on foot via the south stairwell. One vehicle has a scratched door frame. Plate and description recorded, CCTV time-stamped for the client.',
      severity: 'high', status: 'under_review', siteKey: 'lakeshore-garage',
    },
    {
      title: 'Freezer temperature alarm at the cold store',
      description:
        'Freezer panel alarmed at 04:05 showing minus 9 against a minus 18 setpoint. Called the duty engineer immediately and stood by until they arrived at 04:48. Engineer confirmed a failed compressor relay.',
      severity: 'critical', status: 'approved', siteKey: 'granite-warehouse',
      reviewNote: 'Escalated exactly as the post orders require. Client has been invoiced for the standby hours.',
    },
    {
      title: 'Tailgating attempt at the mantrap',
      description:
        'A contractor without a badge attempted to follow an authorised employee through the mantrap at 08:20. Access refused, contractor directed to reception to be signed in by their sponsor. No entry was gained.',
      severity: 'high', status: 'approved', siteKey: 'northpoint-dc1',
      reviewNote: 'Exactly right. Two-person rule held. Client security lead has been notified.',
    },
    {
      title: 'Unattended bag in the food court',
      description:
        'Unattended rucksack beside a table on level 2 for over 20 minutes. Cordoned the immediate area, paged the owner over the mall PA, and the owner returned within 6 minutes. Bag contained personal items only.',
      severity: 'medium', status: 'submitted', siteKey: 'lakeshore-mall',
    },
    {
      title: 'Trailer seal discrepancy on an inbound load',
      description:
        'Inbound trailer arrived with seal number 884102 against 884120 on the paperwork. Refused the offload, held the trailer at the gatehouse and called the transport coordinator. Resolved as a paperwork error at origin.',
      severity: 'medium', status: 'approved', siteKey: 'granite-yard',
      reviewNote: 'Good catch. This is precisely why the seal check exists.',
    },
    {
      title: 'Minor slip in the lobby during heavy rain',
      description:
        'A visitor slipped on wet tile near the revolving door at 17:25. No injury reported and the visitor declined first aid. Deployed wet-floor signage and mopped the area. Logged for the property manager.',
      severity: 'low', status: 'approved', siteKey: 'harborview-lobby',
      reviewNote: 'Logged. Suggest a permanent matting solution at the 30-day review.',
    },
    {
      title: 'Unknown adult at the Schiller gate during dismissal',
      description:
        'An adult not on the authorised pickup list attempted to collect a pupil at 15:35. Held at the gate, office contacted, and the parent confirmed the person was not authorised. Individual left when challenged. School office filed its own report.',
      severity: 'high', status: 'under_review', siteKey: 'beacon-campus',
    },
    {
      title: 'Report filed against the wrong site',
      description:
        'Initial report selected the Main Campus post, but the event described took place at the Emergency Department entrance. Refiled correctly under the ED post.',
      severity: 'low', status: 'rejected', siteKey: 'meridian-main',
      reviewNote: 'Rejected as a duplicate - correctly refiled under the ED post. No action needed.',
    },
  ];

  for (const spec of incidentSpecs) {
    // Anchor each incident to a real past shift at that site, so the shift,
    // guard and timestamp all agree.
    const candidate = pastShifts.find((s) => s.siteKey === spec.siteKey);
    if (!candidate) continue;

    const occurredAt = new Date(candidate.start.getTime() + 6 * 60 * 60 * 1000);
    const reviewed = spec.status === 'approved' || spec.status === 'rejected';

    await prisma.incident.create({
      data: {
        tenantId,
        branchId: siteToBranch[spec.siteKey],
        shiftId: candidate.shiftId,
        siteId: siteIds[spec.siteKey],
        guardId: guardIds[candidate.guardKey],
        title: spec.title,
        description: spec.description,
        severity: spec.severity,
        status: spec.status,
        occurredAt,
        reviewedById: reviewed ? adminUserId : null,
        reviewedAt: reviewed ? new Date(occurredAt.getTime() + 20 * 60 * 60 * 1000) : null,
        reviewNote: reviewed ? spec.reviewNote ?? null : null,
        createdAt: new Date(occurredAt.getTime() + 30 * 60 * 1000),
      },
    });
    bump('incidents');
  }

  // --- Timesheets ---------------------------------------------------------
  // One per worked past shift. Recent ones are left pending so the approval
  // queue has something in it; older ones are approved and therefore
  // billable, which is what the invoices below are built from.
  type ApprovedSheet = {
    id: string;
    siteKey: string;
    guardKey: string;
    shiftId: string;
    hours: number;
    start: Date;
  };
  const approvedSheets: ApprovedSheet[] = [];
  const timesheetRows: Prisma.TimesheetCreateManyInput[] = [];

  for (const shift of pastShifts) {
    const ageDays = Math.round((Date.now() - shift.start.getTime()) / DAY_MS);
    // Last 3 days pending, one rejected for contrast, the rest approved.
    const status = ageDays <= 3 ? 'pending' : ageDays === 9 ? 'rejected' : 'approved';
    const sheetId = randomUUID();

    timesheetRows.push({
      id: sheetId,
      tenantId,
      guardId: guardIds[shift.guardKey],
      shiftId: shift.shiftId,
      siteId: siteIds[shift.siteKey],
      clientId: siteToClient[shift.siteKey],
      checkInTime: shift.start,
      checkOutTime: shift.end,
      totalHours: shift.hours,
      status,
      approvedBy: status === 'approved' ? adminUserId : null,
      approvedAt: status === 'approved' ? new Date(shift.end.getTime() + DAY_MS) : null,
      rejectionReason:
        status === 'rejected'
          ? 'Check-out time does not match the post log - please resubmit with the correct time.'
          : null,
      createdAt: new Date(shift.end.getTime() + 60 * 60 * 1000),
    });

    if (status === 'approved') {
      approvedSheets.push({
        id: sheetId,
        siteKey: shift.siteKey,
        guardKey: shift.guardKey,
        shiftId: shift.shiftId,
        hours: shift.hours,
        start: shift.start,
      });
    }
  }

  await prisma.timesheet.createMany({ data: timesheetRows });
  bump('timesheets', timesheetRows.length);

  // --- Invoices -----------------------------------------------------------
  // Built from the approved timesheets, one invoice per client+site per
  // monthly-ish billing window, so totals reconcile with the hours actually
  // worked rather than being invented. TAX_RATE in invoices.service.ts is 0,
  // so tax is 0 here too and the total equals the subtotal.
  const windows: { label: string; startDaysAgo: number; endDaysAgo: number; status: string }[] = [
    { label: 'W1', startDaysAgo: 56, endDaysAgo: 29, status: 'paid' },
    { label: 'W2', startDaysAgo: 28, endDaysAgo: 8, status: 'issued' },
    { label: 'W3', startDaysAgo: 7, endDaysAgo: 1, status: 'draft' },
  ];

  let invoiceSeq = 1041;
  const issuedInvoices: { id: string; clientKey: string; total: number }[] = [];
  const invoiceRows: Prisma.InvoiceCreateManyInput[] = [];
  const invoiceItemRows: Prisma.InvoiceItemCreateManyInput[] = [];

  for (const window of windows) {
    const windowStart = daysAgo(window.startDaysAgo, 0, 0);
    const windowEnd = daysAgo(window.endDaysAgo, 23, 59);

    // Group the approved hours by site within this window.
    const bySite = new Map<string, ApprovedSheet[]>();
    for (const sheet of approvedSheets) {
      if (sheet.start < windowStart || sheet.start > windowEnd) continue;
      const list = bySite.get(sheet.siteKey) ?? [];
      list.push(sheet);
      bySite.set(sheet.siteKey, list);
    }

    for (const [siteKey, sheets] of bySite) {
      const clientKey = clientKeyBySiteKey[siteKey];
      const clientSpec = CLIENTS.find((c) => c.key === clientKey)!;
      const rate = clientSpec.hourlyRate;

      const issuedAt = window.status === 'draft' ? null : daysAgo(window.endDaysAgo - 1, 10, 0);
      const dueDate = issuedAt ? new Date(issuedAt.getTime() + 30 * DAY_MS) : null;

      const invoiceId = randomUUID();

      // Build the lines FIRST, then derive the header from them.
      //
      // Computing the header independently as round2(totalHours * rate) does
      // not foot: each line rounds to the cent on its own, and the sum of
      // those rounded lines differs from the rounded product of the unrounded
      // totals by a few cents. An invoice whose total does not equal its own
      // line items is the kind of thing a finance-literate viewer spots
      // immediately, so the lines are the source of truth here -- which is
      // also how real invoicing works.
      //
      // One line per shift+guard, which is what the unique constraint on
      // InvoiceItem expects. Duplicate shift+guard pairs are skipped.
      const lines: Prisma.InvoiceItemCreateManyInput[] = [];
      const seen = new Set<string>();
      for (const sheet of sheets) {
        const pairKey = `${sheet.shiftId}:${sheet.guardKey}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        lines.push({
          invoiceId,
          timesheetId: sheet.id,
          rateCardId: rateCardIds[clientKey],
          shiftId: sheet.shiftId,
          guardId: guardIds[sheet.guardKey],
          workedHours: sheet.hours,
          hourlyRate: rate,
          amount: round2(sheet.hours * rate),
        });
      }

      const totalHours = round2(lines.reduce((sum, l) => sum + (l.workedHours as number), 0));
      const subtotal = round2(lines.reduce((sum, l) => sum + (l.amount as number), 0));
      // TAX_RATE in invoices.service.ts is 0, so the total equals the subtotal.
      const tax = 0;
      const totalAmount = round2(subtotal + tax);
      invoiceItemRows.push(...lines);

      invoiceRows.push({
        id: invoiceId,
        tenantId,
        branchId: siteToBranch[siteKey],
        clientId: clientIds[clientKey],
        siteId: siteIds[siteKey],
        invoiceNumber: `INV-${invoiceSeq++}`,
        billingStartDate: windowStart,
        billingEndDate: windowEnd,
        totalHours,
        hourlyRate: rate,
        subtotal,
        tax,
        totalAmount,
        status: window.status,
        issuedAt,
        paidAt: window.status === 'paid' ? daysAgo(window.endDaysAgo - 12, 14, 0) : null,
        dueDate,
        rateCardId: rateCardIds[clientKey],
        rateSource: 'client_rate_card',
        createdAt: issuedAt ?? daysAgo(window.endDaysAgo, 9, 0),
      });

      if (window.status === 'issued') {
        issuedInvoices.push({ id: invoiceId, clientKey, total: totalAmount });
      }
    }
  }

  // InvoiceItem references Invoice, so invoices first.
  await prisma.invoice.createMany({ data: invoiceRows });
  bump('invoices', invoiceRows.length);
  await prisma.invoiceItem.createMany({ data: invoiceItemRows });
  bump('invoiceItems', invoiceItemRows.length);

  // One open dispute and one already resolved, so the dispute workflow has
  // both a live example and a closed one.
  //
  // The invoice status is moved to match, because that is what the app itself
  // does: raising a dispute sets the invoice to "disputed" and resolving one
  // sets it to "resolved" (invoices.service.ts / invoice-disputes.service.ts).
  // Leaving a disputed invoice on "issued" would be a state the product can
  // never actually produce.
  if (issuedInvoices.length) {
    const granite = issuedInvoices.find((i) => i.clientKey === 'granite') ?? issuedInvoices[0];
    await prisma.invoiceDispute.create({
      data: {
        tenantId,
        invoiceId: granite.id,
        clientId: clientIds[granite.clientKey],
        reason: 'Hours queried',
        description:
          'Our gatehouse log shows 8 hours on the night of the 14th, but this invoice bills 12. Please review the attendance record for that shift.',
        status: 'open',
        createdAt: daysAgo(5, 11, 0),
      },
    });
    await prisma.invoice.update({
      where: { id: granite.id },
      data: { status: 'disputed' },
    });
    bump('invoiceDisputes');

    const other = issuedInvoices.find((i) => i.clientKey !== granite.clientKey);
    if (other) {
      await prisma.invoiceDispute.create({
        data: {
          tenantId,
          invoiceId: other.id,
          clientId: clientIds[other.clientKey],
          reason: 'Rate applied',
          description:
            'The overtime line appears to use the standard rate rather than the contracted overtime rate.',
          status: 'resolved',
          adminResponse:
            'Checked against the rate card: the shift did not cross the overtime threshold, so the standard rate is correct. Breakdown sent by email.',
          createdAt: daysAgo(19, 9, 0),
          resolvedAt: daysAgo(17, 16, 0),
        },
      });
      await prisma.invoice.update({
        where: { id: other.id },
        data: { status: 'resolved' },
      });
      bump('invoiceDisputes');
    }
  }

  // --- Daily service reports ----------------------------------------------
  // Published for the past week, plus a couple of drafts awaiting review.
  const reportRows: Prisma.DailyServiceReportCreateManyInput[] = [];
  for (let dayOffset = 8; dayOffset >= 1; dayOffset -= 1) {
    for (const siteKey of Object.keys(SITE_STAFFING)) {
      // Not every site reports daily - only those whose client asked for it.
      const clientKey = clientKeyBySiteKey[siteKey];
      const clientSpec = CLIENTS.find((c) => c.key === clientKey)!;
      if (!clientSpec.reportEmailEnabled) continue;
      // Keep the volume sane: report every other day per site.
      if ((dayOffset + siteKey.length) % 2 === 0) continue;

      const published = dayOffset > 1;
      const reportDate = daysAgo(dayOffset, 0, 0);

      reportRows.push({
        tenantId,
        branchId: siteToBranch[siteKey],
        clientId: clientIds[clientKey],
        siteId: siteIds[siteKey],
        reportDate,
        summary:
          `All contracted posts were covered for the full service period. ` +
          `Patrol rounds completed on schedule with checkpoint scans logged against the standard route. ` +
          (dayOffset % 3 === 0
            ? 'One minor item was noted and resolved on shift; see the incident log for detail. '
            : 'No incidents were reported during the service period. ') +
          `Keys and radios were accounted for at handover.`,
        status: published ? 'published' : 'draft',
        publishedAt: published ? daysAgo(dayOffset - 1, 7, 30) : null,
        emailSentAt:
          published && clientSpec.reportEmailMode === ReportEmailMode.AUTOMATIC
            ? daysAgo(dayOffset - 1, 7, 35)
            : null,
        createdAt: daysAgo(dayOffset, 20, 0),
      });
    }
  }

  await prisma.dailyServiceReport.createMany({ data: reportRows });
  bump('dailyServiceReports', reportRows.length);

  return counts;
}

// ---------------------------------------------------------------------------
// Sales pipeline, prospect search history, credit ledger.
// ---------------------------------------------------------------------------

async function seedPipeline(
  tenantId: string,
  adminUserId: string,
  clientIds: Record<string, string>,
) {
  const counts: Record<string, number> = {};
  const bump = (key: string, n = 1) => {
    counts[key] = (counts[key] ?? 0) + n;
  };

  for (const spec of LEADS) {
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: spec.name,
        company: spec.company,
        email: spec.email,
        phone: spec.phone,
        status: spec.status,
        createdAt: daysAgo(spec.ageDays, 10, 30),
      },
    });
    bump('leads');

    for (const [index, content] of spec.notes.entries()) {
      await prisma.note.create({
        data: {
          tenantId,
          leadId: lead.id,
          content,
          createdAt: daysAgo(Math.max(spec.ageDays - index * 4, 1), 11, 0),
        },
      });
      bump('notes');
    }

    if (!spec.deal) continue;

    const deal = await prisma.deal.create({
      data: {
        tenantId,
        leadId: lead.id,
        name: spec.deal.name,
        stage: spec.deal.stage,
        clientId: spec.deal.clientKey ? clientIds[spec.deal.clientKey] : null,
        createdAt: daysAgo(Math.max(spec.ageDays - 2, 1), 12, 0),
      },
    });
    bump('deals');

    for (const activity of spec.deal.activities ?? []) {
      await prisma.activity.create({
        data: {
          tenantId,
          dealId: deal.id,
          type: activity.type,
          subject: activity.subject,
          description: activity.description,
          status: activity.status,
          dueDate:
            activity.dueInDays >= 0
              ? daysAhead(activity.dueInDays, 14, 0)
              : daysAgo(-activity.dueInDays, 14, 0),
          createdAt: daysAgo(Math.max(spec.ageDays - 3, 1), 13, 0),
        },
      });
      bump('activities');
    }

    if (spec.deal.proposal) {
      const proposal = await prisma.proposal.create({
        data: {
          tenantId,
          leadId: lead.id,
          dealId: deal.id,
          clientId: spec.deal.clientKey ? clientIds[spec.deal.clientKey] : null,
          title: spec.deal.proposal.title,
          content: spec.deal.proposal.content,
          status: spec.deal.proposal.status,
          createdAt: daysAgo(Math.max(spec.ageDays - 6, 1), 15, 0),
        },
      });
      bump('proposals');

      // A first version, so the version history panel is not empty.
      await prisma.proposalVersion.create({
        data: {
          proposalId: proposal.id,
          content: spec.deal.proposal.content,
          versionNumber: 1,
          createdAt: daysAgo(Math.max(spec.ageDays - 6, 1), 15, 0),
        },
      });
      bump('proposalVersions');
    }
  }

  // --- Prospect Search: saved searches + history --------------------------
  const savedSearches: { name: string; prompt: string; filters: Prisma.InputJsonValue }[] = [
    {
      name: 'Chicago hospitals and clinics',
      prompt:
        'Facilities and security decision makers at hospitals and large clinics in the Chicago metro area',
      filters: { location: 'Chicago, IL', industry: 'Healthcare', employeeCount: '500+', seniority: ['Director', 'VP'] },
    },
    {
      name: 'Logistics and warehousing - Midwest',
      prompt:
        'Operations and facilities leads at distribution centres and logistics parks across the Midwest',
      filters: { location: 'Midwest, US', industry: 'Logistics & Warehousing', employeeCount: '200-1000', seniority: ['Manager', 'Director'] },
    },
    {
      name: 'Commercial property managers',
      prompt: 'Property managers responsible for Class A office towers in Chicago',
      filters: { location: 'Chicago, IL', industry: 'Commercial Real Estate', title: ['Property Manager', 'General Manager'] },
    },
    {
      name: 'Data centres and colocation',
      prompt: 'Site security and facilities managers at colocation and data centre operators',
      filters: { industry: 'Data Centres', location: 'IL, WI, IN', seniority: ['Manager', 'Director'] },
    },
  ];

  for (const [index, search] of savedSearches.entries()) {
    await prisma.savedProspectSearch.create({
      data: {
        tenantId,
        userId: adminUserId,
        name: search.name,
        prompt: search.prompt,
        filters: search.filters,
        createdAt: daysAgo(40 - index * 7, 10, 0),
      },
    });
    bump('savedProspectSearches');
  }

  // History rows, each paired with the credit usage recorded below so the
  // two tell the same story.
  const historySpecs: { prompt: string; results: number; daysAgo: number; filters: Prisma.InputJsonValue }[] = [
    { prompt: 'Facilities directors at Chicago hospitals', results: 42, daysAgo: 38, filters: { location: 'Chicago, IL', industry: 'Healthcare' } },
    { prompt: 'Operations managers at Midwest distribution centres', results: 65, daysAgo: 31, filters: { location: 'Midwest, US', industry: 'Logistics & Warehousing' } },
    { prompt: 'Property managers for Class A office towers in the Loop', results: 28, daysAgo: 24, filters: { location: 'Chicago, IL', industry: 'Commercial Real Estate' } },
    { prompt: 'Security leads at colocation providers in Illinois', results: 19, daysAgo: 17, filters: { location: 'IL', industry: 'Data Centres' } },
    { prompt: 'School business managers at private K-12 schools in Chicago', results: 33, daysAgo: 11, filters: { location: 'Chicago, IL', industry: 'Education' } },
    { prompt: 'Retail operations leads at shopping centre groups', results: 47, daysAgo: 6, filters: { industry: 'Retail', location: 'IL' } },
    { prompt: 'Facilities managers at senior living operators', results: 24, daysAgo: 2, filters: { industry: 'Senior Living', location: 'Chicago, IL' } },
  ];

  for (const spec of historySpecs) {
    await prisma.prospectSearchHistory.create({
      data: {
        tenantId,
        userId: adminUserId,
        prompt: spec.prompt,
        filters: spec.filters,
        provider: 'blackpearl',
        resultCount: spec.results,
        searchedAt: daysAgo(spec.daysAgo, 11, 15),
      },
    });
    bump('prospectSearchHistory');
  }

  return { counts, historySpecs };
}

/**
 * Rewrites the credit ledger so it shows real usage instead of a single
 * provisioning row.
 *
 * The invariant the credits code depends on is that TenantCreditBalance.balance
 * equals the sum of the ledger's `amount` column, and every row records the
 * running balance in `balanceAfter`. This builds the rows in order and lets the
 * final running total drive both, rather than asserting a balance and hoping
 * the rows agree.
 *
 * Shape of the story: the account was provisioned with credits, spent some on
 * the searches seeded above (each a RESERVATION that SETTLED, with a RELEASE
 * for the unused remainder), and topped up once in the middle.
 */
async function seedCreditLedger(
  tenantId: string,
  adminUserId: string,
  historySpecs: { prompt: string; results: number; daysAgo: number }[],
) {
  const existing = await prisma.tenantCreditBalance.findUnique({
    where: { tenantId },
    select: { balance: true },
  });
  const provisioned = existing?.balance ?? 500;

  await prisma.creditLedgerEntry.deleteMany({ where: { tenantId } });

  let running = 0;
  let purchased = 0;
  let consumed = 0;
  let rows = 0;

  const add = async (data: {
    type: CreditEntryType;
    amount: number;
    description: string;
    createdAt: Date;
    jobId?: string;
    reservationStatus?: CreditReservationStatus;
    settledAmount?: number;
    settledAt?: Date;
    reservationId?: string;
    upstreamCostUsd?: number;
  }) => {
    running += data.amount;
    if (data.amount > 0 && data.type === CreditEntryType.PURCHASE) purchased += data.amount;
    const row = await prisma.creditLedgerEntry.create({
      data: {
        tenantId,
        type: data.type,
        amount: data.amount,
        balanceAfter: running,
        description: data.description,
        userId: adminUserId,
        jobId: data.jobId ?? null,
        reservationStatus: data.reservationStatus ?? null,
        settledAmount: data.settledAmount ?? null,
        settledAt: data.settledAt ?? null,
        reservationId: data.reservationId ?? null,
        upstreamCostUsd:
          data.upstreamCostUsd === undefined
            ? null
            : new Prisma.Decimal(data.upstreamCostUsd.toFixed(6)),
        createdAt: data.createdAt,
      },
    });
    rows += 1;
    return row;
  };

  // Opening grant.
  await add({
    type: CreditEntryType.PURCHASE,
    amount: provisioned,
    description: `Account provisioned with ${provisioned} Prospect Search credits.`,
    createdAt: daysAgo(44, 9, 0),
  });

  // Each seeded search: reserve a ceiling, settle what the results cost,
  // release the rest. This mirrors the reserve-then-settle flow the credits
  // service actually performs for a BlackPearl job.
  for (const [index, spec] of historySpecs.entries()) {
    const jobId = `demo-job-${String(index + 1).padStart(4, '0')}`;
    const reserveAmount = 50;
    // One credit per prospect returned, which is the unit the UI explains.
    const settle = Math.min(spec.results, reserveAmount);
    const release = reserveAmount - settle;
    const searchedAt = daysAgo(spec.daysAgo, 11, 15);
    const settledAt = new Date(searchedAt.getTime() + 4 * 60 * 1000);

    const reservation = await add({
      type: CreditEntryType.RESERVATION,
      amount: -reserveAmount,
      description: `Reserved ${reserveAmount} credits for Prospect Search: ${spec.prompt}`,
      createdAt: searchedAt,
      jobId,
      reservationStatus: CreditReservationStatus.SETTLED,
      settledAmount: settle,
      settledAt,
      // What the upstream run cost us, roughly 0.11 per prospect.
      upstreamCostUsd: round2(spec.results * 0.11),
    });

    if (release > 0) {
      await add({
        type: CreditEntryType.RELEASE,
        amount: release,
        description: `Released ${release} unused credits from job ${jobId}.`,
        createdAt: settledAt,
        jobId,
        reservationId: reservation.id,
      });
    }

    // Amount 0 by design: the credits left the balance at reservation time.
    await add({
      type: CreditEntryType.CONSUMPTION,
      amount: 0,
      description: `Consumed ${settle} credits for ${spec.results} prospects on job ${jobId}.`,
      createdAt: settledAt,
      jobId,
      reservationId: reservation.id,
    });
    consumed += settle;
  }

  // A mid-period top-up, so the billing screen shows more than the opening grant.
  await add({
    type: CreditEntryType.PURCHASE,
    amount: 250,
    description: 'Credit pack purchased (250 credits).',
    createdAt: daysAgo(14, 15, 20),
  });

  await prisma.tenantCreditBalance.update({
    where: { tenantId },
    data: {
      balance: running,
      lifetimePurchased: purchased,
      lifetimeConsumed: consumed,
    },
  });

  return { rows, balance: running, purchased, consumed };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Thrown to abort the rehearsal transaction once every write has run. */
class RehearsalRollback extends Error {}

/**
 * Runs every seed stage in dependency order and returns the row counts.
 * Shared by --apply and --rehearse so the rehearsal exercises exactly the
 * code the real run will take, not an approximation of it.
 */
async function runSeed(
  tenantId: string,
  adminUserId: string,
): Promise<Record<string, number>> {
  const seeded = await seed(tenantId, adminUserId);
  console.log('  branches, clients, sites, rate cards, portal logins, guards, compliance');

  const ops = await seedOperations(tenantId, adminUserId, seeded);
  console.log('  checkpoints, patrol routes, shifts, assignments, attendance');

  const finance = await seedPatrolsAndFinance(tenantId, adminUserId, seeded, ops);
  console.log('  patrol runs, incidents, timesheets, invoices, service reports');

  const pipeline = await seedPipeline(tenantId, adminUserId, seeded.clientIds);
  console.log('  leads, deals, notes, activities, proposals, prospect searches');

  const ledger = await seedCreditLedger(tenantId, adminUserId, pipeline.historySpecs);
  console.log('  credit ledger');

  return {
    ...seeded.counts,
    ...ops.counts,
    ...finance,
    ...pipeline.counts,
    creditLedgerEntries: ledger.rows,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const reset = process.argv.includes('--reset');
  const rehearse = process.argv.includes('--rehearse');
  const email = (arg('email') ?? 'demo@aegislead.co').trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, tenantId: true, isSuperAdmin: true },
  });

  if (!user) {
    console.error(
      `No user found with email ${email}. This script fills an account that ` +
        'already exists -- create it first with scripts/create-complete-account.ts.',
    );
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      modules: { select: { module: true, isActive: true } },
      creditBalance: { select: { balance: true } },
    },
  });
  if (!tenant) {
    console.error(`User ${email} has no tenant. Cannot seed.`);
    process.exit(1);
  }

  const activeModules = tenant.modules.filter((m) => m.isActive).map((m) => m.module);

  console.log('Target account');
  console.log(`  email    ${user.email}`);
  console.log(`  tenant   ${tenant.name} (${tenant.slug})`);
  console.log(`  id       ${tenant.id}`);
  console.log(`  modules  ${activeModules.join(', ') || '(none active)'}`);
  console.log(`  credits  ${tenant.creditBalance?.balance ?? 0}`);
  console.log('');

  const before = await countBusinessData(tenant.id);

  if (before.total > 0 && !reset && !rehearse) {
    console.error('This tenant already holds business data:');
    for (const [key, value] of Object.entries(before.counts)) {
      if (value > 0) console.error(`  ${key}: ${value}`);
    }
    console.error(
      '\nRefusing to seed on top of it -- re-running would create duplicate ' +
        'clients, guards and invoices. Pass --reset to clear this tenant\'s ' +
        'demo data first (the tenant, its users, roles, modules, subscription ' +
        'and credit balance are left alone).',
    );
    process.exit(1);
  }

  if (!apply && !rehearse) {
    console.log('DRY RUN -- nothing will be written.');
    if (reset && before.total > 0) {
      console.log(`Would first delete ${before.total} existing business rows in this tenant.`);
    }
    console.log('');
    console.log('Would seed, scoped entirely to the tenant above:');
    console.log(`  2 branches (Downtown Operations, North Side Operations)`);
    console.log(`  ${CLIENTS.length} clients, each with a rate card and a verified portal login`);
    console.log(`  ${CLIENTS.reduce((n, c) => n + c.sites.length, 0)} sites`);
    console.log(`  ${GUARDS.length} guards with guard-portal passwords, availability and compliance docs`);
    console.log(`  checkpoints and one patrol route per site`);
    console.log(`  shifts across the last 8 weeks and the next 10 days, with attendance`);
    console.log(`  patrol runs with checkpoint scans, including geofence failures and a missed run`);
    console.log(`  10 incidents spanning every severity and review state`);
    console.log(`  timesheets, invoices (draft/issued/paid/disputed/resolved) and invoice items`);
    console.log(`  daily service reports, published and draft`);
    console.log(`  ${LEADS.length} leads, deals across every Kanban stage, notes, activities, proposals`);
    console.log(`  prospect search history, saved searches and a credit ledger with real usage`);
    console.log('');
    console.log('Re-run with --rehearse to exercise every write and roll it back,');
    console.log('or with --apply to write it for real.');
    return;
  }

  if (rehearse) {
    // Everything below runs against a transaction that is always rolled
    // back, so the writes are fully exercised and then discarded.
    console.log('REHEARSAL -- all writes run inside a transaction that is rolled back.');
    console.log('');
    const previous = prisma;
    let rehearsedCounts: Record<string, number> = {};
    try {
      await client.$transaction(
        async (tx) => {
          prisma = tx;
          if (before.total > 0) await resetTenantWith(tx, tenant.id);
          rehearsedCounts = await runSeed(tenant.id, user.id);
          throw new RehearsalRollback();
        },
        { timeout: 600000, maxWait: 30000 },
      );
    } catch (error) {
      if (!(error instanceof RehearsalRollback)) throw error;
    } finally {
      prisma = previous;
    }

    console.log('');
    console.log('Rows that WOULD be written:');
    for (const [key, value] of Object.entries(rehearsedCounts).sort()) {
      console.log(`  ${key.padEnd(24)} ${value}`);
    }
    console.log('');

    const after = await countBusinessData(tenant.id);
    console.log(
      `Rolled back. Tenant still holds ${after.total} business rows ` +
        `(was ${before.total} before the rehearsal).`,
    );
    if (after.total !== before.total) {
      console.error('ROLLBACK DID NOT HOLD -- investigate before running --apply.');
      process.exit(1);
    }
    console.log('Every write succeeded against the real schema, then was discarded.');
    return;
  }

  if (reset && before.total > 0) {
    console.log(`Clearing ${before.total} existing business rows...`);
    await resetTenant(tenant.id);
    console.log('Cleared.');
  }

  console.log('Seeding...');

  const allCounts = await runSeed(tenant.id, user.id);
  console.log('');

  console.log('Rows written:');
  for (const [key, value] of Object.entries(allCounts).sort()) {
    console.log(`  ${key.padEnd(24)} ${value}`);
  }
  console.log('');

  // Read the ledger back and prove the invariant rather than assuming it.
  const check = await prisma.creditLedgerEntry.aggregate({
    where: { tenantId: tenant.id },
    _sum: { amount: true },
  });
  const balanceRow = await prisma.tenantCreditBalance.findUnique({
    where: { tenantId: tenant.id },
    select: { balance: true, lifetimePurchased: true, lifetimeConsumed: true },
  });
  const ledgerSum = check._sum.amount ?? 0;
  const balance = balanceRow?.balance ?? 0;

  console.log('Credits');
  console.log(`  ledger sum        ${ledgerSum}`);
  console.log(`  balance           ${balance}`);
  console.log(`  lifetimePurchased ${balanceRow?.lifetimePurchased ?? 0}`);
  console.log(`  lifetimeConsumed  ${balanceRow?.lifetimeConsumed ?? 0}`);
  if (ledgerSum !== balance) {
    console.error(
      `\nINVARIANT BROKEN: ledger sums to ${ledgerSum} but balance is ${balance}. ` +
        'Investigate before demoing -- the credits code assumes these match.',
    );
    process.exit(1);
  }
  console.log('  invariant         OK (balance equals the sum of the ledger)');
  console.log('');

  console.log('Demo logins (all use the same password):');
  console.log(`  password  ${DEMO_PASSWORD}`);
  console.log('');
  console.log(`  admin portal   ${user.email}`);
  console.log('  client portal  ' + CLIENTS.map((c) => c.contactEmail).join('\n                 '));
  console.log('  guard portal   ' + GUARDS.slice(0, 3).map((g) => g.email).join('\n                 '));
  console.log(`                 (and ${GUARDS.length - 3} more guards, same password)`);
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
