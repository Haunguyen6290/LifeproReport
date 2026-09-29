import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log('=== CẤU TRÚC BẢNG sales_rows ===');
const {data:cols} = await db.from('sales_rows').select('*').limit(1);
if(cols?.length) {
  console.log('Các cột:', Object.keys(cols[0]).join(', '));
  console.log('\nMẫu 1 dòng:');
  console.log(JSON.stringify(cols[0], null, 2));
}

console.log('\n=== TÌM DÒNG CÓ SỐ HÓA ĐƠN HD280926-00037 ===');
const {data:match} = await db.from('sales_rows').select('*').or('ma_phieu.eq.HD280926-00037,so_hoa_don.eq.HD280926-00037,so_ct.eq.HD280926-00037').limit(5);
if(match?.length) {
  console.log(`Tìm thấy ${match.length} dòng`);
  for(const r of match) console.log(JSON.stringify(r, null, 2));
} else {
  console.log('Không tìm thấy - sales_rows có thể không có cột số hóa đơn, hoặc không match');
}
