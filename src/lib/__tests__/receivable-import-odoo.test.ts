// src/lib/__tests__/receivable-import-odoo.test.ts
// Kiểm tra parseTk131Sheet đọc đúng file Odoo "Sổ chi tiết 1 tài khoản.xls" (1 sheet "Sheet1").
// Bỏ qua khi file mẫu không có trong máy (không commit file này kèm repo).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { parseTk131Sheet } from '@/lib/receivable-import';

const FILE = join(process.cwd(), 'Sổ chi tiết 1 tài khoản.xls');
const has = existsSync(FILE);

describe.skipIf(!has)('parseTk131Sheet — file Odoo Sổ chi tiết 1 tài khoản.xls', () => {
  const wb = XLSX.read(readFileSync(FILE), { type: 'buffer' });
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null }) as unknown[][];
  const r = parseTk131Sheet(raw);

  it('đọc kỳ + số dư đầu kỳ', () => {
    expect(r.header.tuNgay).toBe('2026-08-01');
    expect(r.header.denNgay).toBe('2026-08-31');
    expect(r.header.coDauKy).toBe(true);
    expect(r.header.soDuDauKy).toBe(3404796974);
  });
  it('nhiều dòng chứng từ, bỏ dòng đầu kỳ/ký tên', () => {
    expect(r.rows.length).toBeGreaterThan(2000);
    const first = r.rows[0];
    expect(first).toMatchObject({ ngay: '2026-08-01', so_ct: 'BNK1010826-00002', ma_kh: 'LP-SAP75', tk_doi_ung: '112101', so_no: 0, so_co: 6600000 });
    expect(r.rows.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.ngay))).toBe(true);
  });
});
