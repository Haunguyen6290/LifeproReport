import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC_URL=process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'https://kibxnlhgdprkevqnbtfy.supabase.co';
const SRC_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SRC_KEY ?? '';
if (!SRC_KEY) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY (hoặc SRC_KEY) — không chạy backup.'); process.exit(1); }
const OUT_DIR=process.env.OUT_DIR ?? `H:/Lifepro_BaoCao/backups/backup_${new Date().toISOString().slice(0,10)}_${String(new Date().getHours()).padStart(2,'0')}${String(new Date().getMinutes()).padStart(2,'0')}`;

const TABLES=[
  'categories','category_items','roles','profiles',
  'customers','market_news','campaigns','key_results','campaign_updates',
  'comments','object_links','attachments','settings','import_batches','audit_logs',
  'company_profile','okrs','okr_key_results','weekly_plans','weekly_reports',
  'warehouse_reports','weekly_plan_items','weekly_report_items','okr_check_ins',
  'warehouse_report_updates','sales_rows','bulletin_posts','bulletin_comments',
  'bulletin_reactions','badge_views','chatbot_qa','chatbot_queries',
  'receivable_rows','customer_base_balance',
  'warehouse_reports','warehouse_report_updates',
];

const sb=createClient(SRC_URL,SRC_KEY,{auth:{persistSession:false}});
mkdirSync(OUT_DIR,{recursive:true});

console.log('OUT:',OUT_DIR);

async function dumpTable(table){
  let rows=[];
  let from=0; const STEP=1000;
  while(true){
    const {data,error}=await sb.from(table).select('*').range(from,from+STEP-1);
    if(error){
      // bang khong ton tai / chua co dong
      if(/does not exist|relation/i.test(error.message)) { console.log(`  ${table}: khong ton tai -> bo qua`); return null; }
      console.log(`  ${table}: LOI ${error.message}`);
      return null;
    }
    if(!data || data.length===0) break;
    rows=rows.concat(data);
    if(data.length<STEP) break;
    from+=STEP;
  }
  if(rows.length>0){
    const file=join(OUT_DIR,`${table}.json`);
    writeFileSync(file, JSON.stringify(rows,null,2),'utf8');
  } else {
    const file=join(OUT_DIR,`${table}.json`);
    writeFileSync(file, '[]','utf8');
  }
  return rows.length;
}

const uniq=[...new Set(TABLES)];
let totalRows=0;
for(const t of uniq){
  const n=await dumpTable(t);
  if(n!==null){ console.log(`  ${t}: ${n} dong`); totalRows+=n; }
}
// Manifest
writeFileSync(join(OUT_DIR,'_manifest.json'), JSON.stringify({
  created_at: new Date().toISOString(),
  source_url: SRC_URL,
  tables: uniq,
  total_rows: totalRows,
}, null, 2), 'utf8');
console.log(`\nXong: ${totalRows} dong qua ${uniq.length} bang -> ${OUT_DIR}`);
