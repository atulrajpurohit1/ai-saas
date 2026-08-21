// Read-only audit: scans common text fields across tenants for likely
// test/garbage data (keyboard-mash gibberish, "John Doe"/"Jane Smith",
// "Test"/"Mock"/"XYZ" literals). Prints findings only — makes NO database
// changes. This is the required inspection step before any deletion.
// Run with: npx ts-node scripts/find-garbage-data.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KNOWN_GARBAGE_PATTERN =
  /\b(test|mock|xyz|john\s+doe|jane\s+smith|lorem\s+ipsum|asdf|qwerty|foo\s*bar|sample\s+data|ghost)\b/i;

function vowelRatio(cleaned: string): number {
  if (cleaned.length === 0) return 1;
  const vowels = (cleaned.match(/[aeiouAEIOU]/g) || []).length;
  return vowels / cleaned.length;
}

// Flags single "words" that read as keyboard-mash gibberish (e.g. "hkjml",
// "fghjbknlm", "bnnm,") — very low vowel ratio, letters-only token, no
// legitimate word structure. Deliberately conservative to avoid false
// positives on real (if unusual) business names.
function looksLikeGibberish(value: string): boolean {
  const words = value.trim().split(/\s+/);
  return words.some((word) => {
    const cleaned = word.replace(/[^a-zA-Z]/g, '');
    if (cleaned.length < 4 || cleaned.length > 14) return false;
    return vowelRatio(cleaned) < 0.15;
  });
}

function checkValue(value?: string | null): string | null {
  if (!value || !value.trim()) return null;
  if (KNOWN_GARBAGE_PATTERN.test(value)) return 'known-garbage-term';
  if (looksLikeGibberish(value)) return 'gibberish';
  return null;
}

type Finding = {
  table: string;
  id: string;
  tenantId: string;
  field: string;
  value: string;
  reason: string;
};

async function main() {
  const findings: Finding[] = [];

  const record = (
    table: string,
    id: string,
    tenantId: string,
    fields: Record<string, string | null | undefined>,
  ) => {
    for (const [field, value] of Object.entries(fields)) {
      const reason = checkValue(value);
      if (reason) findings.push({ table, id, tenantId, field, value: value!, reason });
    }
  };

  const [leads, deals, sites, branches, guards, incidents, checkpoints, clients, tenants] =
    await Promise.all([
      prisma.lead.findMany({ select: { id: true, tenantId: true, name: true, company: true } }),
      prisma.deal.findMany({ select: { id: true, tenantId: true, name: true } }),
      prisma.site.findMany({ select: { id: true, tenantId: true, name: true, address: true } }),
      prisma.branch.findMany({ select: { id: true, tenantId: true, name: true, location: true } }),
      prisma.guard.findMany({ select: { id: true, tenantId: true, name: true } }),
      prisma.incident.findMany({ select: { id: true, tenantId: true, title: true, description: true } }),
      prisma.checkpoint.findMany({ select: { id: true, tenantId: true, name: true, locationNote: true } }),
      prisma.client.findMany({ select: { id: true, tenantId: true, name: true, companyName: true } }),
      prisma.tenant.findMany({ select: { id: true, name: true } }),
    ]);

  leads.forEach((r) => record('Lead', r.id, r.tenantId, { name: r.name, company: r.company }));
  deals.forEach((r) => record('Deal', r.id, r.tenantId, { name: r.name }));
  sites.forEach((r) => record('Site', r.id, r.tenantId, { name: r.name, address: r.address }));
  branches.forEach((r) => record('Branch', r.id, r.tenantId, { name: r.name, location: r.location }));
  guards.forEach((r) => record('Guard', r.id, r.tenantId, { name: r.name }));
  incidents.forEach((r) =>
    record('Incident', r.id, r.tenantId, { title: r.title, description: r.description }),
  );
  checkpoints.forEach((r) =>
    record('Checkpoint', r.id, r.tenantId, { name: r.name, locationNote: r.locationNote }),
  );
  clients.forEach((r) =>
    record('Client', r.id, r.tenantId, { name: r.name, companyName: r.companyName }),
  );

  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]));

  console.log(`Scanned ${leads.length + deals.length + sites.length + branches.length + guards.length + incidents.length + checkpoints.length + clients.length} records across ${tenants.length} tenant(s).\n`);
  console.log('Tenants in this database:');
  tenants.forEach((t) => console.log(`  - "${t.name}" (${t.id})`));

  console.log(`\nFound ${findings.length} suspicious field(s):\n`);
  const byTenant = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byTenant.get(f.tenantId) || [];
    list.push(f);
    byTenant.set(f.tenantId, list);
  }

  for (const [tenantId, list] of byTenant) {
    console.log(`Tenant "${tenantNameById.get(tenantId) || tenantId}" (${tenantId}):`);
    for (const f of list) {
      console.log(`  [${f.table}:${f.id}] ${f.field} = "${f.value}" (${f.reason})`);
    }
  }

  if (findings.length === 0) {
    console.log('(none)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
