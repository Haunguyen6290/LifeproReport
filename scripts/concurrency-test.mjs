// scripts/concurrency-test.mjs
// Mô phỏng 2 người cùng bấm Lưu trên 1 khách hàng cùng lúc.
// Mục tiêu: xem ai ghi đè ai, và mất dữ liệu hay không.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

// Đăng nhập 2 phiên ADMIN (cùng tài khoản nhưng 2 phiên riêng)
async function clientAs(email, pw) {
  const { data, error } = await createClient(URL, PUB, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password: pw });
  if (error || !data.session) throw new Error('login fail ' + error?.message);
  return createClient(URL, PUB, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}
const A = await clientAs('admin@congty.local', '123456');
const B = await clientAs('admin@congty.local', '123456');
const { data: me } = await A.auth.getUser();
const userId = me.user.id;

// Tạo 1 khách chung để test
const code = 'CONC_' + Date.now().toString().slice(-6);
const { data: kh0 } = await admin.from('customers').insert({
  ma_kh: code, ten_kh: 'Gốc', assigned_to: userId, sdt: '0900 000 000', ghi_chu: 'ghi chú gốc', created_by: userId, updated_by: userId
}).select('id,ten_kh,sdt,ghi_chu,updated_at').single();
console.log('Khách gốc:', JSON.stringify({ ten_kh: kh0.ten_kh, sdt: kh0.sdt, ghi_chu: kh0.ghi_chu }));

// === Mô phỏng: A sửa SĐT, B sửa Ghi chú, CÙNG LÚC ===
// Đọc giá trị hiện tại (cả 2 đọc trước khi ai lưu)
const [rA, rB] = await Promise.all([A.from('customers').select('*').eq('id', kh0.id).single(), B.from('customers').select('*').eq('id', kh0.id).single()]);
const baseA = rA.data, baseB = rB.data;

// Cả 2 cùng bấm Lưu trong khoảng vài ms
console.log('\nBấm Lưu cùng lúc (A đổi SĐT, B đổi Ghi chú)...');
const [sA, sB] = await Promise.all([
  A.from('customers').update({ sdt: '0900 111 111', updated_by: userId }).eq('id', kh0.id),
  B.from('customers').update({ ghi_chu: 'ghi chú B', updated_by: userId }).eq('id', kh0.id),
]);
console.log('A lưu:', sA.error ? 'LỖI ' + sA.error.message : 'OK');
console.log('B lưu:', sB.error ? 'LỖI ' + sB.error.message : 'OK');

// Đọc lại trạng thái cuối
const { data: final } = await admin.from('customers').select('ten_kh,sdt,ghi_chu').eq('id', kh0.id).single();
console.log('\nTrạng thái cuối:', JSON.stringify(final));

if (final.sdt === '0900 111 111' && final.ghi_chu === 'ghi chú B') {
  console.log('✅ Cả hai thay đổi đều còn → KHÔNG mất dữ liệu (Postgres xử lý update độc lập trên cột)');
} else if (final.sdt === '0900 111 111' && final.ghi_chu !== 'ghi chú B') {
  console.log('❌ LỖI LOST UPDATE: thay đổi của B (ghi chú) bị mất!');
} else if (final.ghi_chu === 'ghi chú B' && final.sdt !== '0900 111 111') {
  console.log('❌ LỖI LOST UPDATE: thay đổi của A (SĐT) bị mất!');
} else {
  console.log('⚠ Kết quả bất ngờ');
}

// Dọn
await admin.from('customers').delete().eq('id', kh0.id);
