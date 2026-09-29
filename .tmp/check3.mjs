import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const norm = (t)=>String(t).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

console.log('=== KIỂM TRA SAU KHI MIGRATION ===\n');

console.log('1. Danh mục khách hàng:');
const {data: cust} = await db.from('customers').select('id,ma_kh,ten_kh').ilike('ten_kh','%đông tín%');
for (const c of cust||[]) console.log(`  ${c.ma_kh} | ${c.ten_kh}`);

console.log('\n2. Sổ 131 (receivable_rows):');
for (const ma of ['LP - DONGTIN', 'LP_-_ĐÔNGTÍN']) {
  const {data,count} = await db.from('receivable_rows').select('ngay,so_no,so_co',{count:'exact'}).eq('ma_kh',ma);
  if((count??0)>0) {
    const sum = (data||[]).reduce((s,r)=>s+Number(r.so_no)-Number(r.so_co),0);
    console.log(`  ${ma}: ${count} dòng, Σ(Nợ-Có) = ${sum.toLocaleString()}`);
  } else {
    console.log(`  ${ma}: không có dòng nào`);
  }
}

console.log('\n3. customer_base_balance:');
for (const ma of ['LP - DONGTIN', 'LP_-_ĐÔNGTÍN']) {
  const {data} = await db.from('customer_base_balance').select('ma_kh,du_no,ngay_moc').eq('ma_kh',ma);
  if((data||[]).length>0) {
    for(const r of data) console.log(`  ${r.ma_kh}: dư nợ ${Number(r.du_no).toLocaleString()}, mốc ${r.ngay_moc}`);
  } else {
    console.log(`  ${ma}: không có`);
  }
}

console.log('\n4. Công nợ tính theo API:');
const d1 = await db.rpc('fn_customer_debt', { p_ma_norm: norm('LP - DONGTIN') });
console.log(`  LP - DONGTIN (norm: ${norm('LP - DONGTIN')}): ${d1.data?.con_thieu?.toLocaleString() ?? 'null'}`);
const d2 = await db.rpc('fn_customer_debt', { p_ma_norm: norm('LP_-_ĐÔNGTÍN') });
console.log(`  LP_-_ĐÔNGTÍN (norm: ${norm('LP_-_ĐÔNGTÍN')}): ${d2.data?.con_thieu?.toLocaleString() ?? 'null'}`);

console.log('\n5. Tìm mọi biến thể của Đông Tín trong sổ 131:');
const {data:all} = await db.from('receivable_rows').select('ma_kh').or('ma_kh.ilike.%dongtin%,ma_kh.ilike.%đông%tín%');
const uniq = [...new Set((all||[]).map(r=>r.ma_kh))];
console.log('  Các mã:', uniq.join(', '));
