// src/lib/customer-patch.ts — dựng dữ liệu ghi vào bảng customers từ 1 dòng Excel đã map (IMPORT_MAP).
// Dùng chung cho Import khách hàng và Import số dư đầu kỳ.
import { normText } from './format';

const TEXT_COLS: Record<string, string> = {
  SDT: 'sdt', Facebook: 'facebook', GoogleMaps: 'google_maps',
  DiaChi: 'dia_chi', QuanHuyen: 'quan_huyen', TinhTP: 'tinh_thanh',
  NguoiQuyetDinh: 'nguoi_quyet_dinh', ChucVu: 'chuc_vu', GhiChu: 'ghi_chu',
};

export type PatchLookups = {
  findUserId: (raw: string) => string | null;
  findStatusId: (name: string) => string | null;
};

/** Chỉ lấy ô CÓ dữ liệu — ô trống không xóa dữ liệu đang có. */
export function customerPatch(data: Record<string, string>, lk: PatchLookups): Record<string, string> {
  const p: Record<string, string> = {};
  for (const [k, col] of Object.entries(TEXT_COLS)) {
    const v = String(data[k] ?? '').trim();
    if (v) p[col] = v;
  }
  const kd = String(data.KinhDoanh ?? '').trim();
  if (kd) { const id = lk.findUserId(kd); if (id) p.assigned_to = id; }
  const tt = String(data.TrangThai ?? '').trim();
  if (tt) { const id = lk.findStatusId(tt); if (id) p.status_id = id; }
  return p;
}

/** Tìm người phụ trách theo username / họ tên, kể cả tên viết tắt ("Trung Chinh" ~ "Nguyễn Trung Chính"). */
export function makeUserFinder(users: { id: string; username: string; full_name: string }[]) {
  const byName = new Map<string, string>([
    ...users.map((u) => [u.username.toLowerCase(), u.id] as const),
    ...users.map((u) => [normText(u.full_name), u.id] as const),
  ]);
  return (raw: string): string | null => {
    const k = String(raw ?? '').trim();
    if (!k) return null;
    const hit = byName.get(k.toLowerCase()) ?? byName.get(normText(k));
    if (hit) return hit;
    const nk = normText(k);
    for (const u of users) if (normText(u.full_name).includes(nk) || nk.includes(normText(u.full_name))) return u.id;
    return null;
  };
}
