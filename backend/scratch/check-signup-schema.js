const fs = require('fs');
const { Client } = require('pg');

function loadEnv() {
  for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index);
    const value = line.slice(index + 1).replace(/^['"]|['"]$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

async function main() {
  loadEnv();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  const result = await client.query(`
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('Tenant', 'Client', 'ClientUser')
    order by table_name, ordinal_position
  `);

  for (const row of result.rows) {
    console.log(`${row.table_name}.${row.column_name} nullable=${row.is_nullable}`);
  }

  const recent = await client.query(`
    select
      t.slug,
      t.name as tenant_name,
      count(distinct c.id)::int as clients,
      count(distinct cu.id)::int as client_users,
      max(greatest(c."createdAt", cu."createdAt")) as latest_signup_row
    from "Tenant" t
    left join "Client" c on c."tenantId" = t.id
    left join "ClientUser" cu on cu."tenantId" = t.id
    where t.slug in ('acme-security')
       or cu.email in ('admin.neon@ai-saas.local')
    group by t.slug, t.name
    order by latest_signup_row desc nulls last
  `);

  console.log('--- signup probe ---');
  if (recent.rows.length === 0) {
    console.log('No acme-security/admin.neon client signup rows found.');
  } else {
    for (const row of recent.rows) {
      console.log(
        `tenant=${row.slug} name=${row.tenant_name} clients=${row.clients} clientUsers=${row.client_users} latest=${row.latest_signup_row}`,
      );
    }
  }

  await client.end();
}

main().catch((error) => {
  console.error(error.code || error.name, error.message);
  process.exit(1);
});
