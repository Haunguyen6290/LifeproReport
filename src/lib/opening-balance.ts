// src/lib/opening-balance.ts — đọc file "Số dư đầu kỳ + danh sách khách hàng".
// Cột bắt buộc: Mã khách, Tên khách, Dư Nợ, Dư Có. Các cột khác dùng lại IMPORT_MAP của import khách hàng.
import { IMPORT_MAP, normalizeHeader } from './import-map';
import { fmtPhone } from './format';

export type OpeningRow = { ma_kh: string; ten_kh: string; du_no: number; extra: Record<string, string> };
export type OpeningParse = {
  rows: OpeningRow[];
  errors: { dong: number; ma_kh: string; lyDo: string }[];
  thieuCot: string[];
};

const BALANCE_MAP: Record<string, 'DuNo' | 'DuCo'> = {
  'du no': 'DuNo', 'so du no': 'DuNo', 'du no dau ky': 'DuNo', 'no': 'DuNo',
  'du co': 'DuCo', 'so du co': 'DuCo', 'du co dau ky': 'DuCo', 'co': 'DuCo',
};

/** Số tiền: nhận số Excel, hoặc chữ dạng "15.000.000" / "15,000,000" / "15000000đ". NaN nếu không đọc được. */
export function parseMoney(v: unknown): number {
  if (typeof v === 'number') return v;
  let t = String(v ?? '').replace(/[\sđĐ]/g, '');
  if (!t) return 0;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function parseOpeningSheet(table: unknown[][]): OpeningParse {
  const out: OpeningParse = { rows: [], errors: [], thieuCot: [] };
  if (!table?.length) { out.thieuCot = ['Mã khách', 'Tên khách', 'Dư Nợ', 'Dư Có']; return out; }

  const header = table[0].map((h) => normalizeHeader(String(h ?? '')));
  const fields: (string | null)[] = header.map((h) => BALANCE_MAP[h] ?? IMPORT_MAP[h] ?? null);
  if (!fields.includes('MaKH')) out.thieuCot.push('Mã khách');
  if (!fields.includes('TenKH')) out.thieuCot.push('Tên khách');
  if (!fields.includes('DuNo') && !fields.includes('DuCo')) out.thieuCot.push('Dư Nợ / Dư Có');
  if (out.thieuCot.length) return out;

  const seen = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const row = table[i] ?? [];
    const o: Record<string, unknown> = {};
    fields.forEach((f, j) => { if (f) o[f] = row[j]; });

    const ma = String(o.MaKH ?? '').trim();
    const ten = String(o.TenKH ?? '').trim();
    const no = parseMoney(o.DuNo);
    const co = parseMoney(o.DuCo);
    const dong = i + 1; // số dòng như Excel hiển thị

    if (!ma && !ten && !no && !co) continue; // dòng trống
    if (!ma) { out.errors.push({ dong, ma_kh: '', lyDo: 'Thiếu Mã khách' }); continue; }
    if (!ten) { out.errors.push({ dong, ma_kh: ma, lyDo: 'Thiếu Tên khách' }); continue; }
    if (Number.isNaN(no) || Number.isNaN(co)) { out.errors.push({ dong, ma_kh: ma, lyDo: 'Dư Nợ / Dư Có không phải số' }); continue; }
    if (no < 0 || co < 0) { out.errors.push({ dong, ma_kh: ma, lyDo: 'Không ghi số âm — khách trả trước thì ghi vào Dư Có' }); continue; }
    if (no > 0 && co > 0) { out.errors.push({ dong, ma_kh: ma, lyDo: 'Ghi cả Dư Nợ lẫn Dư Có — chỉ ghi 1 bên' }); continue; }
    const key = ma.toLowerCase();
    if (seen.has(key)) { out.errors.push({ dong, ma_kh: ma, lyDo: 'Mã khách bị lặp trong file' }); continue; }
    seen.add(key);

    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === 'MaKH' || k === 'TenKH' || k === 'DuNo' || k === 'DuCo') continue;
      const sv = (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '')).trim();
      if (sv) extra[k] = k === 'SDT' ? fmtPhone(sv) : sv;
    }
    out.rows.push({ ma_kh: ma, ten_kh: ten, du_no: no - co, extra });
  }
  return out;
}

/** Ngày số dư = ngày trước ngày mốc. Mốc 2026-01-01 → số dư cuối ngày 2025-12-31. */
export function ngayTruocMoc(moc: string): string {
  const d = new Date(moc + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
