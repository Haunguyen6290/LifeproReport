// Helpers for sales dashboard: name mapping, filtering, month parsing, sheet header detection.

export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export function mapSalesName(raw: string, nameMap: Record<string, string>): string {
  const k = normalizeName(raw);
  if (k in nameMap) return nameMap[k];
  // also try exact raw (in case map has non-normalized keys)
  if (raw in nameMap) return nameMap[raw];
  return k;
}

export function isAllowedName(raw: string, allowed: string[]): boolean {
  const n = normalizeName(raw).toLowerCase();
  if (!n) return false;
  return allowed.some((a) => normalizeName(a).toLowerCase() === n);
}

export function saleMonthFromDate(d: string | Date): string {
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[,  ]/g, '').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// Header detection: find row that contains both "Số CT" and "Thành tiền"
const HEADER_ALIASES: Record<string, string[]> = {
  so_ct: ['số ct', 'so ct'],
  ngay: ['ngày', 'ngay'],
  ma_vt: ['mã vt', 'ma vt'],
  ten_vt: ['tên vt', 'ten vt'],
  ma_kh: ['mã kh', 'ma kh'],
  ten_kh: ['tên kh', 'ten kh'],
  kinh_doanh: ['kinh doanh ql', 'kinh doanh', 'nhân viên', 'nhan vien'],
  so_luong: ['số lượng', 'so luong'],
  don_gia: ['đơn giá', 'don gia'],
  thanh_tien: ['thành tiền', 'thanh tien'],
  vung: ['vùng', 'vung'],
  hang_sx: ['hãng sx', 'hang sx'],
  nhom_hang: ['nhóm hàng', 'nhom hang'],
  ma_nv: ['mã nv', 'ma nv'],
};

function headerKey(cell: string): string | null {
  const c = cell.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => c === a || c.includes(a))) return key;
  }
  return null;
}

export function parseSalesSheet(rows: string[][]): { headerRow: number; col: Record<string, number>; dataStart: number } {
  let headerRow = -1;
  let col: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i].map((v) => String(v ?? '').trim());
    const found: Record<string, number> = {};
    for (let c = 0; c < cells.length; c++) {
      const k = headerKey(cells[c]);
      if (k && !(k in found)) found[k] = c;
    }
    // Require at least so_ct + thanh_tien to consider it the header
    if ('so_ct' in found && 'thanh_tien' in found) {
      headerRow = i;
      col = found;
      break;
    }
  }
  if (headerRow === -1) throw new Error('Không tìm thấy dòng tiêu đề (cần có Số CT và Thành tiền)');
  return { headerRow, col, dataStart: headerRow + 1 };
}
