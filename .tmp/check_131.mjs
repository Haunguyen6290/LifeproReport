import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log('=== CẤU TRÚC BẢNG receivable_rows ===');
const {data:cols} = await db.from('receivable_rows').select('*').limit(1);
if(cols?.length) console.log('Các cột:', Object.keys(cols[0]).join(', '));

console.log('\n=== MẪU 5 DÒNG SỔ 131 (TK 511 - Bán hàng) ===');
const {data:r511} = await db.from('receivable_rows').select('*').ilike('tk_doi_ung','511%').order('ngay',{ascending:false}).limit(5);
for(const r of r511||[]) {
  console.log(`\nNgày: ${r.ngay} | Mã KH: ${r.ma_kh} | TK: ${r.tk_doi_ung}`);
  console.log(`Nợ: ${Number(r.so_no).toLocaleString()} | Có: ${Number(r.so_co).toLocaleString()}`);
  console.log(`Diễn giải: ${r.dien_giai || '(trống)'}`);
  console.log(`Các field khác:`, JSON.stringify(r, null, 2).split('\n').slice(0,15).join('\n'));
}

console.log('\n=== MẪU 3 DÒNG TK 512 (Trả hàng) ===');
const {data:r512} = await db.from('receivable_rows').select('*').ilike('tk_doi_ung','512%').order('ngay',{ascending:false}).limit(3);
for(const r of r512||[]) {
  console.log(`\nNgày: ${r.ngay} | Mã KH: ${r.ma_kh} | Diễn giải: ${r.dien_giai || '(trống)'}`);
}
