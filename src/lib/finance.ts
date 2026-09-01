// Lõi nghiệp vụ trang Tài chính: quy đổi ngày & phân loại TK đối ứng theo tiền tố.
export type TkNhom = 'Doanh thu' | 'Trả lại' | 'Thu tiền';
export type TkMapItem = { ma: string; nhom: TkNhom };

const EXCEL_EPOCH = 25569; // 1970-01-01 trong hệ ngày 1900 của Excel
const DAY_MS = 86400 * 1000;

export function parseNgay(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - EXCEL_EPOCH) * DAY_MS));
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Khớp tiền tố dài nhất trong map. Trả về null nếu không khớp mã nào. */
export function phanLoaiTk(tkDoiUng: string, map: TkMapItem[]): TkNhom | null {
  const tk = String(tkDoiUng ?? '').trim();
  let best: { len: number; nhom: TkNhom } | null = null;
  for (const it of map) {
    if (!it.ma) continue;
    if (tk.startsWith(it.ma) && (!best || it.ma.length > best.len)) best = { len: it.ma.length, nhom: it.nhom };
  }
  return best ? best.nhom : null;
}
