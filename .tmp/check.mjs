import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const norm = (t)=>String(t).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

console.log('=== DANH MỤC KHÁCH HÀNG ===');
const {data: cust} = await db.from('customers').select('id,ma_kh,ten_kh').ilike('ten_kh','%đông tín%');
for (const c of cust||[]) console.log(`${c.ma_kh} | ${c.ten_kh} | norm: ${norm(c.ma_kh)}`);

console.log('\n=== SỔ 131 (receivable_rows) ===');
const {data: rcv} = await db.from('receivable_rows').select('ma_kh,ngay,so_no,so_co').ilike('ma_kh','%đông tín%').order('ngay',{ascending:false}).limit(50);
const uniq = [...new Set((rcv||[]).map(r=>r.ma_kh))];
for (const m of uniq) {
  const rows = rcv.filter(r=>r.ma_kh===m);
  const sum = rows.reduce((s,r)=>s+Number(r.so_no)-Number(r.so_co),0);
  console.log(`${m} | norm: ${norm(m)} | ${rows.length} dòng | Σ(Nợ-Có): ${sum.toLocaleString()}`);
}

console.log('\n=== DOANH SỐ BÁN HÀNG (sales_rows) ===');
const {data: sales} = await db.from('sales_rows').select('ma_kh,ten_kh,tong').ilike('ten_kh','%đông tín%').order('ngay',{ascending:false}).limit(50);
const uniqS = [...new Set((sales||[]).map(r=>`${r.ma_kh}|${r.ten_kh}`))];
for (const mk of uniqS) {
  const [ma,ten]=mk.split('|');
  const rows = sales.filter(r=>r.ma_kh===ma && r.ten_kh===ten);
  const sum = rows.reduce((s,r)=>s+Number(r.tong),0);
  console.log(`${ma} | ${ten} | norm: ${norm(ma)} | ${rows.length} dòng | Σ: ${sum.toLocaleString()}`);
}

console.log('\n=== CUSTOMER_BASE_BALANCE (số dư đầu kỳ) ===');
const {data: cb} = await db.from('customer_base_balance').select('ma_kh,du_no,ngay_moc').ilike('ma_kh','%đông tín%');
for (const c of cb||[]) console.log(`${c.ma_kh} | dư nợ: ${Number(c.du_no).toLocaleString()} | mốc: ${c.ngay_moc} | norm: ${norm(c.ma_kh)}`);

console.log('\n=== CÔNG NỢ TÍNH THEO TỪNG MÃ ===');
for (const c of cust||[]) {
  const d = await db.rpc('fn_customer_debt', { p_ma_norm: norm(c.ma_kh) });
  console.log(`${c.ma_kh} (danh mục) → ${d.data?.con_thieu?.toLocaleString() ?? 'null'}`);
}
for (const m of uniq) {
  const d = await db.rpc('fn_customer_debt', { p_ma_norm: norm(m) });
  console.log(`${m} (sổ 131) → ${d.data?.con_thieu?.toLocaleString() ?? 'null'}`);
}

console.log('\n=== TÌM CÁC MÃ TƯƠNG TỰ (tên có "đông", "tin") ===');
const {data: allRcv} = await db.from('receivable_rows').select('ma_kh').or('ma_kh.ilike.%đông%,ma_kh.ilike.%tin%');
const uniqAll = [...new Set((allRcv||[]).map(r=>r.ma_kh))];
console.log('Các mã trong sổ 131:', uniqAll.join(', '));
