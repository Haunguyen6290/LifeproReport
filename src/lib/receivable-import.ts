// src/lib/receivable-import.ts — parse sheet TK131 & DataKH từ file MISA xuất.
import { parseNgay } from '@/lib/finance';

export type RcvRow = {
  ngay: string; so_ct: string; ma_kh: string; ten_kh: string;
  dien_giai: string; tk_doi_ung: string; so_no: number; so_co: number; du_dong: number | null;
};

export type Tk131Header = { tuNgay: string; denNgay: string; soDuDauKy: number; coDauKy: boolean };

const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return isNaN(n) ? 0 : n;
};

const s = (v: unknown): string => String(v ?? '').trim();

/**
 * Dòng "Số dư đầu kỳ": giá trị nằm ở cột Số dư Nợ.
 * Nếu cột Số hiệu rỗng toàn bảng → lệch cột (bản nợ có cột A trống).
 */
function findDataLayout(rows: unknown[][]): { soHieuCol: number; ngayCol: number } | null {
  // tiêu đề: có "Số hiệu" và "Ngày"
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const line = rows[i].map((c) => s(c).toLowerCase());
    if (line.some((c) => c.includes('số hiệu')) && line.some((c) => c.includes('ngày'))) { headerRow = i; break; }
  }
  if (headerRow === -1) return null;
  const h = rows[headerRow];
  let soHieuCol = -1, ngayCol = -1;
  h.forEach((c, i) => {
    const v = s(c).toLowerCase();
    if (soHieuCol === -1 && v.includes('số hiệu')) soHieuCol = i;
    if (ngayCol === -1 && v.includes('ngày')) ngayCol = i;
  });
  if (soHieuCol === -1 || ngayCol === -1) return null;
  // Bản MISA có thể thêm 1 cột A trống → tất cả dịch +1. Kiểm tra bằng cột "Tài khoản":
  // giá trị '131' phải rơi đúng vào cột tk; nếu tk là rỗng nhưng cột ngay-1 là '131' thì lệch.
  for (let i = headerRow + 1; i < Math.min(rows.length, headerRow + 20); i++) {
    const r = rows[i];
    if (s(r[ngayCol]) === '' && /^\d{2}\/\d{2}\/\d{4}$/.test(s(r[ngayCol - 1]))) {
      return { soHieuCol: soHieuCol - 1, ngayCol: ngayCol - 1 };
    }
    if (s(r[ngayCol]) !== '') return { soHieuCol, ngayCol };
  }
  return { soHieuCol, ngayCol };
}

export function parseTk131Sheet(rows: unknown[][]): { header: Tk131Header; rows: RcvRow[] } {
  let tuNgay = '', denNgay = '', soDuDauKy = 0, coDauKy = false;
  for (const r of rows) {
    const txt = r.map((c) => s(c)).join(' ');
    const m = txt.match(/Từ ngày[:\s]*([\d\/\-]+)\s*đến ngày[:\s]*([\d\/\-]+)/i);
    if (m && !tuNgay) { tuNgay = parseNgay(m[1]) ?? ''; denNgay = parseNgay(m[2]) ?? ''; }
    if (/số dư đầu kỳ/i.test(txt)) {
      // các giá trị số đầu tiên trong dòng
      const vals = r.map((c) => num(c)).filter((n) => n !== 0);
      if (vals.length) { soDuDauKy = vals[0]; coDauKy = true; }
    }
  }

  const layout = findDataLayout(rows);
  const out: RcvRow[] = [];
  if (!layout) return { header: { tuNgay, denNgay, soDuDauKy, coDauKy }, rows: out };
  const { soHieuCol, ngayCol } = layout;
  // so_ct ngay trước ngày; ma_kh/ten_kh/dien_giai/tk_doi_ung sau ngày 1..4;
  // Nợ/Có: tìm từ cột "Số phát sinh Nợ" = ngayCol+? — quy ước layout 2 bản: Nợ = ngayCol+4, Có = ngayCol+5, Dư = ngayCol+6
  for (const r of rows) {
    const tkCol = s(r[soHieuCol - 1]);
    if (tkCol !== '131') continue;
    const ngay = parseNgay(r[ngayCol]);
    if (!ngay) continue;
    out.push({
      ngay,
      so_ct: s(r[soHieuCol]),
      ma_kh: s(r[ngayCol + 1]),
      ten_kh: s(r[ngayCol + 2]),
      dien_giai: s(r[ngayCol + 3]),
      tk_doi_ung: s(r[ngayCol + 4]),
      so_no: num(r[ngayCol + 5]),
      so_co: num(r[ngayCol + 6]),
      du_dong: r[ngayCol + 7] != null && s(r[ngayCol + 7]) !== '' ? num(r[ngayCol + 7]) : null,
    });
  }
  return { header: { tuNgay, denNgay, soDuDauKy, coDauKy }, rows: out };
}

/** Chỉ nhận khi có cột dư nợ đầu kỳ (header chứa "Nợ"); bản DataKH không có cột này → []. */
export function parseDataKHSheet(rows: unknown[][]): { ma: string; ten: string; nvkd: string; duNo: number }[] {
  if (!rows.length) return [];
  const h = rows[0].map((c) => s(c).toLowerCase());
  let colDu = -1, colNvkd = -1;
  h.forEach((c, i) => {
    if (/nợ\s*\d{2}|\dnợ$|nợ \d{4}/.test(c)) colDu = i;
    if (c.includes('dùng cho báo cáo') || c.includes('dung cho bao cao')) colNvkd = i;
  });
  if (colDu === -1) return [];
  if (colNvkd === -1) colNvkd = 2; // fallback cột "NVKD" thường ở vị trí 3
  const out: { ma: string; ten: string; nvkd: string; duNo: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const ma = s(rows[i][0]);
    if (!ma) continue;
    out.push({ ma, ten: s(rows[i][1]), nvkd: s(rows[i][colNvkd]), duNo: num(rows[i][colDu]) });
  }
  return out;
}
