// scripts/e2e-test.mjs
// Test end-to-end thật: đăng nhập ADMIN + SALES, chạy luồng thêm/sửa/xóa qua REST,
// kiểm tra RLS. Chạy: node scripts/e2e-test.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const pass = 0, fail = 0;
const results = [];
function ok(name) { results.push(`✅ ${name}`); }
function bad(name, err) { results.push(`❌ ${name} — ${err}`); }

// Helper đăng nhập bằng email
async function signInAs(email, password) {
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('login fail: ' + (error?.message ?? ''));
  const c2 = createClient(URL, PUB, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  return { client: c2, userId: data.user.id };
}

// Lấy id vai trò
async function roleId(name) {
  const { data } = await admin.from('roles').select('id').eq('name', name).single();
  return data.id;
}
// Lấy id category item theo slug
async function catItem(slug, name) {
  const { data } = await admin.from('categories').select('id, category_items(id,name)').eq('slug', slug).single();
  const cat = data;
  const it = (cat.category_items ?? []).find((i) => i.name === name || i.code === name);
  return it?.id ?? null;
}

let createdCustomer = null;
let createdNews = null;
let createdCampaign = null;
let salesUser = null;

// ---------- 1. ADMIN: KHÁCH HÀNG ----------
async function testCustomerCrud() {
  const { client: a, userId } = await signInAs('admin@congty.local', '123456');
  const tierId = await catItem('phan_hang_kh', 'C');
  const statusId = await catItem('trang_thai_kh', 'Đang theo dõi');
  // Tạo
  const code = 'E2E_' + Date.now().toString().slice(-6);
  const { data: ins, error: ie } = await a.from('customers').insert({ ma_kh: code, ten_kh: 'E2E Test KH', assigned_to: userId, sdt: '0905 123 456', tier_id: tierId, status_id: statusId, created_by: userId, updated_by: userId }).select('id,ten_kh,tier_id').single();
  if (ie) return bad('KH tạo', ie.message);
  createdCustomer = ins;
  ok('KH tạo: ' + ins.id);

  // Sửa
  const { error: ue } = await a.from('customers').update({ ten_kh: 'E2E Test KH (đã sửa)', updated_by: userId }).eq('id', ins.id);
  if (ue) return bad('KH sửa', ue.message);
  ok('KH sửa');

  // Audit có ghi? (app ghi audit khi sửa; ở đây ta insert 1 dòng giả lập app rồi kiểm tra đọc được)
  await a.from('audit_logs').insert({ actor_id: userId, action: 'Sửa hồ sơ', entity_type: 'customer', entity_id: ins.id, details: { test: 1 } });
  const { data: logs } = await a.from('audit_logs').select('id').eq('entity_type', 'customer').eq('entity_id', ins.id);
  if (!logs || logs.length === 0) return bad('KH history', 'không có audit_logs');
  ok('KH history: ' + logs.length + ' bản ghi');

  // Xóa
  const { error: de } = await a.from('customers').delete().eq('id', ins.id);
  if (de) return bad('KH xóa', de.message);
  // Ngược: kiểm tra biến mất
  const { data: gone } = await a.from('customers').select('id').eq('id', ins.id);
  if (gone && gone.length > 0) return bad('KH xóa ngược', 'vẫn còn');
  ok('KH xóa + biến mất khỏi danh sách');
  createdCustomer = null;
}

// ---------- 2. ADMIN: THỊ TRƯỜNG ----------
async function testNewsFlow() {
  const { client: a, userId } = await signInAs('admin@congty.local', '123456');
  const typeId = await catItem('loai_tin_tt', '🔎 Khách hàng tiềm năng');
  const levelId = await catItem('muc_do', '🔴 Rất quan trọng — báo ngay');
  // Tạo tin
  const { data: ins, error: ie } = await a.from('market_news').insert({ reporter_id: userId, type_id: typeId, importance_id: levelId, content: 'E2E tin test', source: 'test' }).select('id').single();
  if (ie) return bad('TT tạo', ie.message);
  createdNews = ins;
  ok('TT tạo tin: ' + ins.id);

  // Gắn KH (object_link)
  const { error: le } = await a.from('object_links').insert({ owner_type: 'news', owner_id: ins.id, target_type: 'product', target_id: (await catItem('san_pham', 'TPMS')) });
  if (le) return bad('TT gắn', le.message);
  ok('TT gắn SP');

  // Bình luận
  const { error: ce } = await a.from('comments').insert({ target_type: 'news', target_id: ins.id, author_id: userId, content: 'E2E comment' });
  if (ce) return bad('TT comment', ce.message);
  ok('TT comment');

  // Kết luận "chưa xử lý" → trạng thái KETLUAN, resolved=false
  const { error: ke } = await a.from('market_news').update({ status: 'KETLUAN', conclusion_content: 'chưa xử lý', conclusion_resolved: false, conclusion_by: userId }).eq('id', ins.id);
  if (ke) return bad('TT kết luận', ke.message);
  // Ngược: vẫn comment được (RLS insert comment không cấm khi đã KETLUAN)
  const { error: ce2 } = await a.from('comments').insert({ target_type: 'news', target_id: ins.id, author_id: userId, content: 'comment sau kết luận' });
  if (ce2) return bad('TT comment-sau-kết-luận', ce2.message);
  ok('TT kết luận "chưa xử lý" → vẫn mở thảo luận');

  // Dọn
  await admin.from('comments').delete().eq('target_id', ins.id);
  await admin.from('object_links').delete().eq('owner_id', ins.id);
  await admin.from('market_news').delete().eq('id', ins.id);
  createdNews = null;
  ok('TT dọn dẹp');
}

// ---------- 3. ADMIN: CHIẾN DỊCH + OKR ----------
async function testCampaignFlow() {
  const { client: a, userId } = await signInAs('admin@congty.local', '123456');
  const typeId = await catItem('loai_chien_dich', 'Sản phẩm mới');
  const statusId = await catItem('trang_thai_chien_dich', 'Chuẩn bị');
  const updTypeId = await catItem('loai_cap_nhat', 'Phản hồi khách hàng');

  // Tạo chiến dịch
  const { data: ins, error: ie } = await a.from('campaigns').insert({ name: 'E2E Chiến dịch', type_id: typeId, status_id: statusId, objective: 'Test OKR', owner_id: userId, created_by: userId }).select('id').single();
  if (ie) return bad('CD tạo', ie.message);
  createdCampaign = ins;
  ok('CD tạo: ' + ins.id);

  // Thêm 3 KR
  for (let i = 0; i < 3; i++) {
    const { error: ke } = await a.from('key_results').insert({ campaign_id: ins.id, title: `KR ${i + 1}`, sort_order: i });
    if (ke) return bad('CD KR', ke.message);
  }
  ok('CD thêm 3 KR');

  // Thêm bản cập nhật
  const { data: up, error: ue } = await a.from('campaign_updates').insert({ campaign_id: ins.id, reporter_id: userId, type_id: updTypeId, content: 'E2E cập nhật', rating: 'TOT' }).select('id').single();
  if (ue) return bad('CD cập nhật', ue.message);
  ok('CD thêm bản cập nhật');

  // Kết luận bản cập nhật
  const { error: ce } = await a.from('campaign_updates').update({ conclusion_content: 'xong', conclusion_resolved: true, conclusion_by: userId }).eq('id', up.id);
  if (ce) return bad('CD kết luận', ce.message);
  ok('CD kết luận bản cập nhật');

  // Dọn
  await admin.from('campaign_updates').delete().eq('campaign_id', ins.id);
  await admin.from('key_results').delete().eq('campaign_id', ins.id);
  await admin.from('campaigns').delete().eq('id', ins.id);
  createdCampaign = null;
  ok('CD dọn dẹp');
}

// ---------- 4. QUẢN TRỊ: tạo SALES + test RLS ----------
async function testSalesRls() {
  const { client: a, userId: adminId } = await signInAs('admin@congty.local', '123456');
  const salesRoleId = await roleId('SALES');
  const email = `e2e_sales_${Date.now().toString().slice(-6)}@congty.local`;
  const username = 'e2esales';
  // Tạo user qua admin
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: '123456', email_confirm: true });
  if (ue) return bad('QT tạo sales', ue.message);
  const { error: pe } = await admin.from('profiles').insert({ id: u.user.id, username, full_name: 'E2E Sales', role_id: salesRoleId });
  if (pe) return bad('QT profile sales', pe.message);
  salesUser = { id: u.user.id, email, username };
  ok('QT tạo SALES: ' + username);

  // Tạo 1 khách của admin
  const tierId = await catItem('phan_hang_kh', 'C');
  const statusId = await catItem('trang_thai_kh', 'Đang theo dõi');
  const code = 'E2E_OWN_' + Date.now().toString().slice(-6);
  const { data: kh } = await a.from('customers').insert({ ma_kh: code, ten_kh: 'KH của admin', assigned_to: adminId, sdt: '0905 000 001', tier_id: tierId, status_id: statusId, created_by: adminId, updated_by: adminId }).select('id').single();

  // Đăng nhập SALES
  const { client: s } = await signInAs(email, '123456');

  // SALES xem được khách của admin? → CÓ (minh bạch)
  const { data: visible } = await s.from('customers').select('id,ten_kh').eq('id', kh.id);
  if (visible && visible.length === 1) ok('RLS: SALES xem được khách người khác'); else bad('RLS: SALES xem', 'không thấy');

  // SALES sửa khách của admin? → KHÔNG (RLS chặn — 0 dòng đổi, không ném lỗi)
  await s.from('customers').update({ ten_kh: 'SALES sửa' }).eq('id', kh.id);
  const { data: afterUpd } = await a.from('customers').select('ten_kh').eq('id', kh.id).single();
  if (afterUpd.ten_kh === 'SALES sửa') bad('RLS: SALES sửa', 'giá trị đổi → RLS không chặn!'); else ok('RLS: SALES bị chặn sửa khách người khác ✓');

  // SALES tạo chiến dịch? → KHÔNG
  const { error: sce } = await s.from('campaigns').insert({ name: 'SALES tạo', owner_id: salesUser.id });
  if (sce) ok('RLS: SALES bị chặn tạo chiến dịch ✓'); else bad('RLS: SALES tạo CD', 'không bị chặn!');

  // SALES kết luận tin? → KHÔNG (RLS chặn — status không đổi)
  const typeId = await catItem('loai_tin_tt', '🛒 Khách hỏi mua');
  const { data: tin } = await a.from('market_news').insert({ reporter_id: adminId, type_id: typeId, content: 'tin để test RLS' }).select('id').single();
  await s.from('market_news').update({ status: 'KETLUAN' }).eq('id', tin.id);
  const { data: afterTin } = await a.from('market_news').select('status').eq('id', tin.id).single();
  if (afterTin.status === 'KETLUAN') bad('RLS: SALES kết luận', 'status đổi → RLS không chặn!'); else ok('RLS: SALES bị chặn kết luận tin ✓');

  // SALES ghi tin được? → CÓ
  const { data: stin, error: ste } = await s.from('market_news').insert({ reporter_id: salesUser.id, type_id: typeId, content: 'tin của sales' }).select('id').single();
  if (ste) bad('RLS: SALES ghi tin', ste.message); else ok('RLS: SALES ghi tin được ✓');

  // Dọn
  await admin.from('market_news').delete().in('id', [tin.id, stin?.id].filter(Boolean));
  await admin.from('customers').delete().eq('id', kh.id);
  await admin.from('profiles').delete().eq('id', u.user.id);
  await admin.auth.admin.deleteUser(u.user.id);
  salesUser = null;
  ok('QT dọn dẹp SALES');
}

// ---------- CHẠY ----------
try {
  console.log('=== E2E tests ===\n');
  await testCustomerCrud();
  await testNewsFlow();
  await testCampaignFlow();
  await testSalesRls();
  const okCount = results.filter((r) => r.startsWith('✅')).length;
  const failCount = results.filter((r) => r.startsWith('❌')).length;
  console.log(results.join('\n'));
  console.log(`\n=== KẾT QUẢ: ${okCount} pass, ${failCount} fail ===`);
  process.exit(failCount > 0 ? 1 : 0);
} catch (e) {
  console.error('LỖI NGOÀI: ' + e.message);
  process.exit(1);
}
