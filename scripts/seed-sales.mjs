import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const settings = [
  ['SALES_ALLOWED_NAMES', '["Mai Đình Chiến","Nguyễn Xuân Vũ","Nguyễn Trung Chính SG","Đỗ Thành Công","Nguyễn Trung Chính","Mai Dinh Chien","Nguyen Xuan Vu","Nguyen Trung Chinh SG","Do Thanh Cong"]'],
  ['SALES_NAME_MAP', '{"Nguyễn Trung Chính SG":"Nguyễn Trung Chính","Đỗ Thành Công":"Nguyễn Trung Chính","Do Thanh Cong":"Nguyen Trung Chinh","Nguyen Trung Chinh SG":"Nguyen Trung Chinh"}'],
];

// Use plain ASCII fallback to avoid encoding issues - will fix via SQL Editor if needed
const settings2 = [
  ['SALES_ALLOWED_NAMES', JSON.stringify(["Mai Đình Chiến","Đinh Anh Chi","Nguyễn Xuân Vũ","Nguyễn Trung Chính SG","Đỗ Thành Công"])],
  ['SALES_NAME_MAP', JSON.stringify({"Nguyễn Trung Chính SG":"Nguyễn Trung Chính","Đỗ Thành Công":"Nguyễn Trung Chính"})],
];

for (const [k, v] of settings2) {
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/settings', {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: k, value: v }),
  });
  console.log(`seed ${k}:`, r.status, (await r.text()).slice(0, 200));
}

const r2 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/sales_rows?select=id&limit=1', {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY },
});
console.log('sales_rows check:', r2.status, (await r2.text()).slice(0, 300));
if (r2.status === 404 || (await r2.clone?.()?.text?.() ?? '').includes('not find')) {
  console.log('-> Table not exists, need to run migration in SQL Editor');
}
