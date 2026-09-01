import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import * as XLSX from 'xlsx';
import { parseTk131Sheet, parseDataKHSheet } from '@/lib/receivable-import';

const NO_FILE = 'Bao_cao_cong_no_qua_han.xlsx';
const THU_FILE = 'Bao_cao_banhang_thutien.xlsx';

function sheet(name: string): unknown[][] {
  const wb = XLSX.read(readFileSync(name), { type: 'buffer' });
  const sn = wb.SheetNames.find((n) => /131|tai_khoan/i.test(n) && !/helper/i.test(n))!;
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null }) as unknown[][];
}
function datakh(name: string): unknown[][] {
  const wb = XLSX.read(readFileSync(name), { type: 'buffer' });
  const sn = wb.SheetNames.find((n) => /datakh/i.test(n));
  if (!sn) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null }) as unknown[][];
}

describe.skipIf(!existsSync(NO_FILE))('Đối chuẩn file CÔNG NỢ QUÁ HẠN (parser, không cần DB)', () => {
  const { header, rows } = parseTk131Sheet(sheet(NO_FILE));

  it('nhận đúng kỳ + số dư đầu kỳ', () => {
    expect(header.tuNgay).toBe('2026-01-01');
    expect(header.denNgay).toBe('2026-08-31');
    expect(header.soDuDauKy).toBe(3486085967);
  });
  it('đọc ~18.3k dòng chứng từ', () => {
    expect(rows.length).toBeGreaterThan(18000);
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.ngay))).toBe(true);
  });
  it('CÂN ĐỐI 1: đầu kỳ + ΣNợ − ΣCó = số dư dòng cuối', () => {
    const sumNo = rows.reduce((a, r) => a + r.so_no, 0);
    const sumCo = rows.reduce((a, r) => a + r.so_co, 0);
    expect(header.soDuDauKy + sumNo - sumCo).toBe(rows[rows.length - 1].du_dong);
  });
  it('CÂN ĐỐI 3: Σ đầu kỳ theo khách (DataKH) = đầu kỳ toàn công ty', () => {
    const base = parseDataKHSheet(datakh(NO_FILE));
    expect(base.length).toBeGreaterThan(800);
    const sumBase = base.reduce((a, b) => a + b.duNo, 0);
    expect(sumBase).toBe(header.soDuDauKy);
  });
});

describe.skipIf(!existsSync(THU_FILE))('Đối chuẩn file BÁN HÀNG THU TIỀN (parser, không cần DB)', () => {
  const { header, rows } = parseTk131Sheet(sheet(THU_FILE));

  it('nhận đúng số dư đầu kỳ; kỳ suy từ dữ liệu vì bản thu tiền không có tiêu đề kỳ', () => {
    expect(header.soDuDauKy).toBe(3123963086);
    expect(header.tuNgay).toBe('');
    expect(header.denNgay).toBe('');
    const min = rows.reduce((m, r) => (r.ngay < m ? r.ngay : m), rows[0].ngay);
    const max = rows.reduce((m, r) => (r.ngay > m ? r.ngay : m), rows[0].ngay);
    expect(min).toBe('2026-07-01');
    expect(max).toBe('2026-07-31');
  });
  it('đọc được dòng chứng từ (layout không lệch cột)', () => {
    expect(rows.length).toBeGreaterThan(2000);
    expect(rows[0]).toMatchObject({ ma_kh: expect.any(String), so_co: expect.any(Number) });
  });
  it('CÂN ĐỐI 1 nội bộ', () => {
    const sumNo = rows.reduce((a, r) => a + r.so_no, 0);
    const sumCo = rows.reduce((a, r) => a + r.so_co, 0);
    if (rows[rows.length - 1].du_dong != null) {
      expect(header.soDuDauKy + sumNo - sumCo).toBe(rows[rows.length - 1].du_dong);
    }
  });
});
