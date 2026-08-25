// scripts/concurrency-test2.mjs
// (a) 2 người cùng sửa CÙNG 1 trường → ai thắng? có hỏng không?
// (b) 2 người thêm khách CÙNG mã cùng lúc → UNIQUE có chặn?
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
async function clientAs(email, pw) {
  const { data, error } = await createClient(URL, PUB, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password: pw });
  if (error || !data.session) throw new Error('login fail ' + error?.message);
  return createClient(URL, PUB, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}
const A = await clientAs('admin@congty.local', '123456');
const B = await clientAs('admin@congty.local', '123456');
const { data: me } = await A.auth.getUser();
const userId = me.user.id;

// (a) cùng sửa 1 trường
const code = 'CONC2_' + Date.now().toString().slice(-6);
const { data: kh } = await admin.from('customers').insert({ ma_kh: code, ten_kh: 'Gốc', assigned_to: userId, sdt: '0900 000 000', created_by: userId, updated_by: userId }).select('id,ten_kh').single();
const [a1, b1] = await Promise.all([
  A.from('customers').update({ ten_kh: 'Tên của A' }).eq('id', kh.id),
  B.from('customers').update({ ten_kh: 'Tên của B' }).eq('id', kh.id),
]);
const { data: f1 } = await admin.from('customers').select('ten_kh').eq('id', kh.id).single();
console.log('(a) cùng sửa 1 trường → cuối:', JSON.stringify(f1.ten_kh), '| A:', a1.error ? 'lỗi' : 'ok', 'B:', b1.error ? 'lỗi' : 'ok');
console.log(f1.ten_kh === 'Tên của A' || f1.ten_kh === 'Tên của B' ? '✅ last-writer-wins, không hỏng (1 trong 2 giá trị hợp lệ)' : '❌ giá trị hỏng');

// (b) thêm cùng mã cùng lúc
const dupCode = 'DUP_' + Date.now().toString().slice(-6);
const [ia, ib] = await Promise.all([
  A.from('customers').insert({ ma_kh: dupCode, ten_kh: 'A', assigned_to: userId, sdt: '0900 000 001', created_by: userId, updated_by: userId }),
  B.from('customers').insert({ ma_kh: dupCode, ten_kh: 'B', assigned_to: userId, sdt: '0900 000 002', created_by: userId, updated_by: userId }),
]);
const okA = !ia.error, okB = !ib.error;
console.log('(b) thêm cùng mã → A:', okA ? 'thành công' : 'bị chặn', '| B:', okB ? 'thành công' : 'bị chặn');
console.log((okA !== okB) ? '✅ UNIQUE chặn đúng 1 trong 2 (không tạo 2 bản trùng)' : '❌ cả 2 cùng thành công → trùng mã!');

// Dọn
await admin.from('customers').delete().in('ma_kh', [code, dupCode]);
