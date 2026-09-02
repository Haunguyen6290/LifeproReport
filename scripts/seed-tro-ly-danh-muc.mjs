import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Route gợi ý theo phân hệ (khớp giao diện hiện tại; ông sửa lại trong Danh mục sau)
const ROUTES = {
  'Bộ não chung công ty': { routes: [], mac_dinh: true },
  'Trợ lý OKRs': { routes: ['/okr'], mac_dinh: false },
  'Trợ lý Kế hoạch': { routes: ['/bao-cao-tuan'], mac_dinh: false },
  'Trợ lý Báo cáo tuần': { routes: ['/bao-cao-tuan'], mac_dinh: false },
  'Trợ lý Check-in hàng tuần': { routes: [], mac_dinh: false },
  'Trợ lý Báo cáo vấn đề': { routes: ['/bao-cao-kho'], mac_dinh: false },
  'Trợ lý Khách hàng': { routes: ['/khach-hang'], mac_dinh: false },
  'Trợ lý Kinh doanh': { routes: ['/bao-cao-ban-hang'], mac_dinh: false },
  'Trợ lý Kho': { routes: ['/bao-cao-kho'], mac_dinh: false },
  'Trợ lý Tổng hợp kho': { routes: [], mac_dinh: false },
  'Trợ lý Bảo hành': { routes: [], mac_dinh: false },
  'Trợ lý Kế toán': { routes: [], mac_dinh: false },
  'Trợ lý Mua hàng': { routes: [], mac_dinh: false },
  'Trợ lý Marketing & Thiết kế': { routes: [], mac_dinh: false },
  'Trợ lý Phát triển sản phẩm': { routes: [], mac_dinh: false },
  'Trợ lý Lái xe': { routes: [], mac_dinh: false },
  'Trợ lý Chiến dịch': { routes: ['/chien-dich'], mac_dinh: false },
  'Trợ lý Thị trường kinh doanh': { routes: ['/thi-truong'], mac_dinh: false },
  'Trợ lý Bảng tin': { routes: [], mac_dinh: false },
};

async function ensureCategory(slug, name, description) {
  const { data: existing } = await supabase.from('categories').select('id, slug').eq('slug', slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from('categories').insert({ slug, name, description }).select('id').single();
  if (error) throw new Error(`Tạo danh mục ${slug} thất bại: ${error.message}`);
  return data.id;
}

// Đọc dữ liệu thật từ bảng chatbot_qa (nguồn ở module Trợ lý)
const { data: qaRows, error: qaErr } = await supabase.from('chatbot_qa').select('phan_he, nhom_chu_de');
if (qaErr) throw new Error(`Đọc chatbot_qa thất bại: ${qaErr.message}`);
const phanHeFromData = [...new Set((qaRows ?? []).map((r) => r.phan_he).filter(Boolean))];
const nhomMap = new Map(); // nhom -> Set(phan_he)
for (const r of qaRows ?? []) {
  if (!r.nhom_chu_de) continue;
  if (!nhomMap.has(r.nhom_chu_de)) nhomMap.set(r.nhom_chu_de, new Set());
  if (r.phan_he) nhomMap.get(r.nhom_chu_de).add(r.phan_he);
}

const catPhanHe = await ensureCategory('tro_ly_phan_he', 'Phân hệ trợ lý', 'Mỗi mục là một phân hệ của bot. Sửa trường "Đường dẫn trang" để chọn phân hệ hiện ở trang nào.');
const catNhom = await ensureCategory('tro_ly_nhom', 'Nhóm trợ lý', 'Mỗi mục là một nhóm câu hỏi của bot. Sửa trường "Thuộc phân hệ" để gắn nhóm vào một hoặc nhiều phân hệ.');

// Xóa mục cũ để seed lại sạch (idempotent)
await supabase.from('category_items').delete().in('category_id', [catPhanHe, catNhom]);

// 1) Phân hệ: ưu tiên thứ tự trong ROUTES, phân hệ ngoài danh sách thì nối tiếp
let sort = 0;
let phCount = 0;
for (const name of Object.keys(ROUTES)) {
  sort++;
  const cfg = ROUTES[name];
  const { error } = await supabase.from('category_items').insert({
    category_id: catPhanHe, code: '', name, description: cfg.mac_dinh ? 'Hiện ở mọi trang chưa cấu hình phân hệ riêng' : '',
    sort_order: sort, active: true, extra: { routes: cfg.routes, mac_dinh: cfg.mac_dinh },
  });
  if (error) console.error('Lỗi thêm phân hệ:', name, error.message); else phCount++;
}
for (const name of phanHeFromData) {
  if (ROUTES[name]) continue;
  sort++;
  const { error } = await supabase.from('category_items').insert({
    category_id: catPhanHe, code: '', name, description: '', sort_order: sort, active: true, extra: { routes: [], mac_dinh: false },
  });
  if (error) console.error('Lỗi thêm phân hệ:', name, error.message); else phCount++;
}

// 2) Nhóm: mỗi nhóm 1 mục. name = tên hiển thị trong bot (đổi ở đây là bot đổi theo).
//    extra.key = TÊN GỐC khớp với chatbot_qa.nhom_chu_de để nối câu hỏi — KHÔNG đổi khóa khi đổi tên.
//    Ghi phân hệ gốc vào Mô tả để ông nhìn nguồn gốc.
let nhCount = 0;
let n = 0;
for (const [nhom, phanHes] of nhomMap.entries()) {
  n++;
  const owners = [...phanHes];
  const { error } = await supabase.from('category_items').insert({
    category_id: catNhom, code: '', name: nhom,
    description: owners.length ? `Phân hệ gốc: ${owners.join(', ')}` : '', sort_order: n, active: true,
    extra: { key: nhom },
  });
  if (error) console.error('Lỗi thêm nhóm:', nhom, error.message); else nhCount++;
}

console.log(`Xong: phân hệ=${phCount}, nhóm=${nhCount} (từ ${qaRows?.length ?? 0} câu hỏi trong chatbot_qa)`);
