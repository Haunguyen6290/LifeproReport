import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.split('=')[0].trim(), l.slice(l.indexOf('=')+1).trim()]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log('Tìm tất cả số dư đầu kỳ có tên Đông Tín:');
const {data} = await db.from('customer_base_balance').select('*').or('ma_kh.ilike.%dongtin%,ma_kh.ilike.%đông%tín%');
console.log(data);

console.log('\nTìm trong receivable_rows mã gốc trước khi sửa:');
const {data:log} = await db.rpc('fn_norm_ma',{t:'LP_-_ĐÔNGTÍN'}).single();
console.log('fn_norm_ma("LP_-_ĐÔNGTÍN") =', log);
const {data:log2} = await db.rpc('fn_norm_ma',{t:'LP - DONGTIN'}).single();
console.log('fn_norm_ma("LP - DONGTIN") =', log2);
