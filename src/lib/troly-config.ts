import { supabase } from './supabase/client';

type SbClient = typeof supabase;

export type BotPhanHe = { name: string; routes: string[]; macDinh: boolean };
export type BotNhom = { name: string; phanHe: string[] };

// Fallback khi chưa chạy migration 0036 (giữ đúng hành vi cũ)
const PHAN_HE_DUONG_DAN: [string, string][] = [
  ['/okr', 'Trợ lý OKRs'],
  ['/bao-cao-tuan', 'Trợ lý Báo cáo tuần'],
  ['/bao-cao-kho', 'Trợ lý Kho'],
  ['/bao-cao-ban-hang', 'Trợ lý Kinh doanh'],
  ['/khach-hang', 'Trợ lý Khách hàng'],
  ['/thi-truong', 'Trợ lý Thị trường kinh doanh'],
  ['/chien-dich', 'Trợ lý Chiến dịch'],
];
const BO_NAO_CHUNG = 'Bộ não chung công ty';

async function itemsOf(slug: string, client?: SbClient) {
  const c = client ?? supabase;
  const { data } = await c
    .from('categories')
    .select('id, category_items(name, description, active, sort_order, extra)')
    .eq('slug', slug)
    .single();
  const cat = data as { category_items?: { name: string; active: boolean; sort_order: number; extra: any }[] } | null;
  return (cat?.category_items ?? []).filter((i) => i.active).sort((a, b) => a.sort_order - b.sort_order);
}

/** Danh sách tên phân hệ nên hiện trên một trang (theo cấu hình danh mục).
 *  Dùng longest-prefix-match để đường dẫn cụ thể thắng đường dẫn ngắn
 *  (vd /bao-cao-kho và /bao-cao-ban-hang không "nuốt" nhau). */
export function phanHeChoDuongDan(path: string, ds: BotPhanHe[]): string[] {
  if (!ds.length) {
    const hit = PHAN_HE_DUONG_DAN.find(([p]) => path === p || path.startsWith(`${p  }/`));
    return [hit ? hit[1] : BO_NAO_CHUNG];
  }
  let bestLen = -1;
  for (const d of ds) for (const r of d.routes) {
    if (!r) continue;
    const hit = path === r || path.startsWith(`${r  }/`);
    if (hit) bestLen = Math.max(bestLen, r.length);
  }
  if (bestLen >= 0) return ds.filter((d) => d.routes.some((r) => r && (path === r || path.startsWith(`${r  }/`)) && r.length === bestLen)).map((d) => d.name);
  const macDinh = ds.filter((d) => d.macDinh);
  return macDinh.length ? macDinh.map((d) => d.name) : [BO_NAO_CHUNG];
}

export type BotRow = { cau_hoi: string; nhom_chu_de: string; phan_he: string };

/** Lọc câu hỏi + dựng danh sách nhóm theo cấu hình phân hệ/nhóm.
 *  - Row thuộc phân hệ đang kích hoạt → luôn hiện.
 *  - Row thuộc phân hệ khác nhưng nhóm của nó được gắn vào phân hệ đang kích hoạt → cũng hiện.
 *  - Nhóm chưa chọn phân hệ nào trong "Nhóm trợ lý" → không thêm gì (coi như chưa cấu hình). */
export function locCauHoiTheoCauHinh(rows: BotRow[], activePhanHe: string[], nhomCfg: BotNhom[]): { groups: string[]; rows: BotRow[] } {
  const nhomHien = new Set(nhomCfg.filter((n) => n.phanHe.some((p) => activePhanHe.includes(p))).map((n) => n.name));
  const kept = rows.filter((r) => activePhanHe.includes(r.phan_he) || nhomHien.has(r.nhom_chu_de));
  const groups = [...new Set(kept.map((r) => r.nhom_chu_de).filter(Boolean))];
  return { groups, rows: kept };
}

/** Nạp toàn bộ cấu hình trợ lý (phân hệ + nhóm) từ danh mục. */
export async function loadBotConfig(client?: SbClient): Promise<{ phanHe: BotPhanHe[]; nhom: BotNhom[] }> {
  const [dsPhanHe, dsNhom] = await Promise.all([itemsOf('tro_ly_phan_he', client), itemsOf('tro_ly_nhom', client)]);
  return {
    phanHe: dsPhanHe.map((i) => ({ name: i.name, routes: Array.isArray(i.extra?.routes) ? (i.extra.routes as string[]) : [], macDinh: !!i.extra?.mac_dinh })),
    nhom: dsNhom.map((i) => ({ name: i.name, phanHe: Array.isArray(i.extra?.phan_he) ? (i.extra.phan_he as string[]) : [] })),
  };
}
