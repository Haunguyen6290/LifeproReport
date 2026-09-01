// Đối chuẩn 2 báo cáo Tài chính (sau RPC) với giá trị đã tính sẵn trong file Excel gốc.
// Chạy: node scripts/verify-tai-chinh.mjs
// Điều kiện: đã chạy migration 0030 + 0031 và import Bao_cao_cong_no_qua_han.xlsx qua trang Tài chính.
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// nạp .env.local
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SRV) { console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env.local'); process.exit(1); }
if (!existsSync(resolve(root, 'Bao_cao_cong_no_qua_han.xlsx'))) { console.error('Không thấy file Excel gốc ở thư mục dự án'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const db = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

function sheet(name, sheetPick) {
  const wb = XLSX.read(readFileSync(resolve(root, name)), { cellDates: true });
  const sn = typeof sheetPick === 'string' ? sheetPick : wb.SheetNames.find(sheetPick);
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
}
const r0 = (n) => Math.round(Number(n) || 0);

// ---------- 1) Công nợ quá hạn ----------
// File Excel: B5=31/05 (dư đầu kỳ tính đến TRƯỚC 31/05 + phát sinh 31/05 thuộc KỲ), chốt E=30/07.
// Phần mềm: p_thang=2026-08 + han=90 → D=01/06; để khớp file, dùng p_thang=2026-07 (D=01/05)
// rồi đối chiếu có chủ ý lệch biên 30-31/05; cách nhanh nhất: gọi p_thang='2026-08', p_han=90, p_den='2026-07-30'
// Excel kỳ 01/06–31/07 đúng là D=01/06 → dùng p_thang=2026-08 cho ra D=01/06, E chốt 30/07.
const { count } = await db.from('receivable_rows').select('id', { count: 'exact', head: true });
if (!count) { console.error('receivable_rows RỖNG — hãy import Bao_cao_cong_no_qua_han.xlsx qua trang Tài chính trước.'); process.exit(1); }
const { data: baseCnt } = await db.from('customer_base_balance').select('ma_kh', { count: 'exact', head: true });
console.log(`DB: ${count.toLocaleString('vi-VN')} chứng từ · ${baseCnt} khách có số dư gốc\n`);

const excel = sheet('Bao_cao_cong_no_qua_han.xlsx', 'BaoCaoQuaHan');
const excelMap = new Map();
for (let i = 4; i < excel.length; i++) {
  const r = excel[i];
  if (!r || !r[1]) continue;
  excelMap.set(String(r[1]).trim(), { ma: String(r[1]).trim(), cndk: r0(r[4]), dt: r0(r[5]), tl: r0(r[6]), tt: r0(r[7]), giam: r0(r[8]), thieu: r0(r[9]), quaHan: String(r[10] ?? '').includes('QUÁ') });
}
const { data: rpc, error } = await db.rpc('finance_debt_report', { p_thang: '2026-08', p_han: 90, p_den: '2026-07-30' });
if (error) { console.error('RPC lỗi:', error.message); process.exit(1); }
console.log(`RPC: D=${rpc.D} E=${rpc.E} · ${rpc.rows.length} khách\n`);

const mine = new Map(rpc.rows.map((r) => [r.ma_kh, r]));
const cols = [['cong_no_dau_ky', 'cndk'], ['doanh_thu', 'dt'], ['tra_lai', 'tl'], ['thu_tien', 'tt'], ['tong_giam_tru', 'giam'], ['con_thieu', 'thieu']];
let mismatch = 0, shown = 0;
for (const [ma, e] of excelMap) {
  const m = mine.get(ma);
  if (!m) { console.log(`KHÁC: ${ma} — không có trong RPC`); mismatch++; continue; }
  const diffs = cols.filter(([k, ek]) => r0(m[k]) !== e[ek]);
  const qhKhac = !!m.qua_han !== e.quaHan;
  if (diffs.length || qhKhac) {
    mismatch++;
    if (shown++ < 15) console.log(`KHÁC ${ma} (${e.ma}):` + diffs.map(([k, ek]) => ` ${k}: phần_mềm=${r0(m[k])} excel=${e[ek]}`).join(',') + (qhKhac ? ` | cảnh_báo: pm=${m.qua_han} excel=${e.quaHan}` : ''));
  }
}
const qhExcel = [...excelMap.values()].filter((e) => e.quaHan).length;
const qhMine = rpc.rows.filter((r) => r.qua_han).length;
console.log(`\nKẾT LUẬN NỢ QUÁ HẠN: ${mismatch ? mismatch + ' khách lệch (xem ở trên)' : 'KHỚP 100% ' + excelMap.size + ' khách'} · QUÁ HẠN: phần mềm ${qhMine} / excel ${qhExcel}`);

// ---------- 2) Bán hàng thu tiền (so dòng Thực hiện tháng 7) ----------
const bc = sheet('Bao_cao_banhang_thutien.xlsx', 'Bao_Cao');
// bc[2]: ["", "", "Mai Đình Chiến","Đinh Anh Chi","Nguyễn Xuân Vũ","Công ty","Tổng Hà Nội","Đỗ Thành Công SG",...,"Tổng Sài Gòn",,"Tổng Công ty"]
const headerRow = bc[2] ?? [];
const thucHienDS = bc[4] ?? [];   // dòng Doanh số bán hàng — Thực hiện
const thucHienThu = bc[7] ?? [];  // dòng Doanh thu thu tiền — Thực hiện
const NVKD_COLS = headerRow.map((h, i) => ({ h: String(h ?? '').trim(), i })).filter((x) => x.h && !x.h.startsWith('Tổng'));
const { data: coll } = await db.rpc('finance_collections_report', { p_thang: '2026-07' });
if (!coll) { console.error('RPC thu tiền lỗi'); process.exit(1); }
const mineByNv = new Map(coll.rows.map((r) => [r.nvkd, r]));
let collMismatch = 0;
for (const { h, i } of NVKD_COLS) {
  const r = mineByNv.get(h);
  const eDS = r0(thucHienDS[i]), eThu = r0(thucHienThu[i]);
  const mDS = r0(r?.doanh_so ?? 0), mThu = r0(r?.thu_tien ?? 0);
  if (mDS !== eDS || mThu !== eThu) { collMismatch++; console.log(`KHÁC ${h}: doanh_so pm=${mDS.toLocaleString('vi-VN')} excel=${eDS.toLocaleString('vi-VN')} · thu_tien pm=${mThu.toLocaleString('vi-VN')} excel=${eThu.toLocaleString('vi-VN')}`); }
}
console.log(`KẾT LUẬN THU TIỀN: ${collMismatch ? collMismatch + ' NVKD lệch' : 'KHỚP ' + NVKD_COLS.length + ' NVKD (Doanh số + Thu tiền, tháng 7)'}`);
