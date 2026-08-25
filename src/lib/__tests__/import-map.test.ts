import { describe, expect, it } from 'vitest';
import { mapTable, normalizeHeader } from '../import-map';

describe('normalizeHeader', () => {
  it('bỏ dấu và phần ghi chú trong ngoặc', () => {
    expect(normalizeHeader('Mã khách hàng')).toBe('ma khach hang');
    expect(normalizeHeader('SĐT (bắt buộc)')).toBe('sdt');
    expect(normalizeHeader('KinhDoanh')).toBe('kinhdoanh');
  });
});

describe('mapTable', () => {
  it('ánh xạ các đồng nghĩa sang field DB, bỏ dòng trống', () => {
    const table = [
      ['Ma KH', 'Tên khách hàng', 'SDT', 'Ghi chú (thêm)'],
      ['LP1221', 'Auto 365', '0905123456', 'x'],
      ['', '', '', ''],
    ];
    const rows = mapTable(table);
    expect(rows).toHaveLength(1);
    expect(rows[0].MaKH).toBe('LP1221');
    expect(rows[0].TenKH).toBe('Auto 365');
    expect(rows[0].SDT).toBe('0905 123 456');
    expect(rows[0].GhiChu).toBe('x');
  });
});
