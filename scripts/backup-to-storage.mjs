import { createClient } from '@supabase/supabase-js';

const SRC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SRC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? '';
const DST_BUCKET = process.env.BACKUP_BUCKET ?? 'db-backups';
const KEEP = parseInt(process.env.BACKUP_KEEP ?? '7', 10);

if (!SRC_URL || !SRC_KEY) { console.error('Thieu SUPABASE_URL / SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });

const TABLES = [
  'categories','category_items','roles','profiles','customers','market_news','campaigns','key_results','campaign_updates',
  'comments','object_links','attachments','settings','import_batches','audit_logs','company_profile','okrs','okr_key_results',
  'weekly_plans','weekly_reports','weekly_plan_items','weekly_report_items','okr_check_ins','warehouse_reports',
  'warehouse_report_updates','sales_rows','bulletin_posts','bulletin_comments','bulletin_reactions','badge_views',
  'chatbot_qa','chatbot_queries','receivable_rows','customer_base_balance',
];

async function dumpTable(table) {
  let rows = []; let from = 0; const STEP = 1000;
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(from, from + STEP - 1);
    if (error) {
      if (/does not exist|relation/i.test(error.message)) return [];
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < STEP) break;
    from += STEP;
  }
  return rows;
}

async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some(b => b.name === DST_BUCKET)) return;
  const { error } = await sb.storage.createBucket(DST_BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) console.warn('Tao bucket:', error.message);
  else console.log('Da tao bucket', DST_BUCKET);
}

async function run() {
  await ensureBucket();
  const ts = new Date().toISOString();
  const stamp = ts.slice(0, 10) + '_' + ts.slice(11, 13) + ts.slice(14, 16); // YYYY-MM-DD_HHmm UTC
  console.log('Backup luc', ts, '-> bucket', DST_BUCKET, 'stamp', stamp);

  const payload = {};
  let total = 0;
  for (const t of TABLES) {
    const rows = await dumpTable(t);
    payload[t] = rows;
    total += rows.length;
    console.log(`  ${t}: ${rows.length}`);
  }

  const json = Buffer.from(JSON.stringify(payload));
  const path = `${stamp}/backup.json`;
  const manifestPath = `${stamp}/manifest.json`;
  const manifest = { created_at: ts, stamp, tables: TABLES, total_rows: total, size_bytes: json.length };

  const { error: e1 } = await sb.storage.from(DST_BUCKET).upload(path, json, { contentType: 'application/json', upsert: false });
  if (e1) throw new Error('Upload backup.json: ' + e1.message);
  const { error: e2 } = await sb.storage.from(DST_BUCKET).upload(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)), { contentType: 'application/json', upsert: false });
  if (e2) console.warn('manifest upload', e2.message);
  console.log(`Da upload ${path} (${(json.length/1024/1024).toFixed(1)} MB)`);

  // xoay vong: giu KEEP ban gan nhat
  const { data: allFiles } = await sb.storage.from(DST_BUCKET).list('', { limit: 1000 });
  const stamps = [...new Set((allFiles ?? []).map(f => f.name.split('/')[0]).filter(Boolean))].sort();
  if (stamps.length > KEEP) {
    const toDelete = stamps.slice(0, stamps.length - KEEP);
    for (const s of toDelete) {
      const { data: files } = await sb.storage.from(DST_BUCKET).list(s, { limit: 1000 });
      const paths = (files ?? []).map(f => `${s}/${f.name}`);
      if (paths.length) {
        const { error } = await sb.storage.from(DST_BUCKET).remove(paths);
        if (error) console.warn('xoa', s, error.message); else console.log('Da xoa ban cu', s);
      }
    }
  }
  console.log('Xong. Tong', total, 'dong.');
}

run().catch(e => { console.error('LOI:', e.stack ?? e.message); process.exit(1); });
