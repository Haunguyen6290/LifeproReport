import { supabase } from './supabase/client';

type SbClient = typeof supabase;

export type BotPhanHe = { name: string; routes: string[]; macDinh: boolean };
/** `key` là tên gốc của nhóm dùng để nối với câu hỏi; `name` là tên hiển thị (ông tự đổi trong Danh mục). */
export type BotNhom = { key: string; name: string };

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

/** Lọc câu hỏi theo phân hệ đang kích hoạt rồi đặt tên nhóm theo Danh mục "Nhóm trợ lý".
 *  - Row thuộc phân hệ đang kích hoạt → hiện.
 *  - Tên hiển thị lấy theo Danh mục (đổi tên ở đó là bot đổi theo), khớp qua "khóa" = tên gốc.
 *    Nhóm không có trong danh mục giữ tên gốc. */
export function locCauHoiTheoCauHinh(rows: BotRow[], activePhanHe: string[], tenNhomMap: Map<string, string>): { groups: string[]; rows: BotRow[] } {
  const kept = rows
    .filter((r) => activePhanHe.includes(r.phan_he))
    .map((r) => ({ ...r, nhom_chu_de: tenNhomMap.get(r.nhom_chu_de) ?? r.nhom_chu_de }));
  const groups = [...new Set(kept.map((r) => r.nhom_chu_de).filter(Boolean))];
  return { groups, rows: kept };
}

/** Bảng tra key → tên hiển thị từ Danh mục "Nhóm trợ lý". */
export function taoBangTenNhom(nhomCfg: BotNhom[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of nhomCfg) m.set(n.key, n.name);
  return m;
}

/** Nạp toàn bộ cấu hình trợ lý (phân hệ + nhóm) từ danh mục. */
export async function loadBotConfig(client?: SbClient): Promise<{ phanHe: BotPhanHe[]; nhom: BotNhom[] }> {
  const [dsPhanHe, dsNhom] = await Promise.all([itemsOf('tro_ly_phan_he', client), itemsOf('tro_ly_nhom', client)]);
  return {
    phanHe: dsPhanHe.map((i) => ({ name: i.name, routes: Array.isArray(i.extra?.routes) ? (i.extra.routes as string[]) : [], macDinh: !!i.extra?.mac_dinh })),
    nhom: dsNhom.map((i) => ({ key: (i.extra?.key ?? i.name) as string, name: i.name })),
  };
}
