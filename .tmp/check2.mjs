import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const norm = (t)=>String(t).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

console.log('=== CHI TIẾT SỔ 131 CÁC MÃ LIÊN QUAN ĐÔNG TÍN ===\n');
for (const ma of ['LP - DONGTIN', 'LP_-_ĐÔNGTÍN']) {
  console.log(`Mã: ${ma} | norm: ${norm(ma)}`);
  let all=[], f=0;
  while(true) {
    const {data} = await db.from('receivable_rows').select('ngay,so_no,so_co,dien_giai').eq('ma_kh',ma).order('ngay').range(f,f+999);
    if(!data?.length)break;
    all.push(...data); f+=1000; if(data.length<1000)break;
  }
  console.log(`  Tổng ${all.length} dòng`);
  const sum = all.reduce((s,r)=>s+Number(r.so_no)-Number(r.so_co),0);
  console.log(`  Σ(Nợ-Có): ${sum.toLocaleString()}`);
  if(all.length<=10) for(const r of all) console.log(`    ${r.ngay} | Nợ ${Number(r.so_no).toLocaleString()} | Có ${Number(r.so_co).toLocaleString()} | ${r.dien_giai||''}`);
  else { console.log('  5 dòng đầu:'); for(const r of all.slice(0,5)) console.log(`    ${r.ngay} | Nợ ${Number(r.so_no).toLocaleString()} | Có ${Number(r.so_co).toLocaleString()}`); console.log('  5 dòng cuối:'); for(const r of all.slice(-5)) console.log(`    ${r.ngay} | Nợ ${Number(r.so_no).toLocaleString()} | Có ${Number(r.so_co).toLocaleString()}`); }
  console.log('');
}

console.log('=== DOANH SỐ (sales_rows) CÁC MÃ ===');
for (const ma of ['LP - DONGTIN', 'LP_-_ĐÔNGTÍN', 'LP - ĐÔNG TÍN', 'LP-DONGTIN']) {
  const {data} = await db.from('sales_rows').select('ngay,tong').eq('ma_kh',ma).order('ngay',{ascending:false}).limit(10);
  if(data?.length) console.log(`${ma}: ${data.length} dòng, tổng ${data.reduce((s,r)=>s+Number(r.tong),0).toLocaleString()}`);
}
