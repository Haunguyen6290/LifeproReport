import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2];
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
for (const sql of [
  `create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars')`,
  `create policy "avatars authenticated insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars')`,
  `create policy "avatars authenticated update" on storage.objects for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars')`,
  `create policy "avatars authenticated delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars')`,
]) {
  const { error } = await supabase.rpc('exec_sql' as any, { sql } as any);
  console.log(sql.slice(0, 40), error ? 'ERR ' + error.message : 'maybe ok (rpc exec_sql not available is normal)');
}
// fallback: try raw SQL via supabase SQL editor not available via JS — just check bucket exists
const { data, error } = await supabase.storage.from('avatars').list('branding', { limit: 1 });
console.log('list branding:', error ? error.message : JSON.stringify(data));
