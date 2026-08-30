import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const rel = process.argv[2] ?? 'supabase/migrations/0019_sales_rows.sql';
const sql = readFileSync(join(root, rel), 'utf8');

// Try pooler with service_role key as password (Supabase pooler sometimes uses JWT as password)
const candidates = [
  `postgresql://postgres.kibxnlhgdprkevqnbtfy:${encodeURIComponent(env.SUPABASE_SERVICE_ROLE_KEY)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`,
];

for (const conn of candidates) {
  console.log('Trying:', conn.slice(0, 80) + '...');
  const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected!');
    await client.query(sql);
    console.log('Migration executed OK');
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log('Failed:', e.message.slice(0, 400));
    try { await client.end(); } catch {}
  }
}
console.log('All pooler attempts failed — need manual SQL Editor execution');
process.exit(1);
