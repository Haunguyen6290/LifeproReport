import { describe, it, expect } from 'vitest';
import { normalizeName, mapSalesName, isAllowedName, isAllowedNameWithMap, saleMonthFromDate, parseSalesSheet, parseNumber } from '@/lib/sales';

describe('sales helpers', () => {
  it('mapSalesName gộp SG và Công về Chính', () => {
    const m: Record<string, string> = { 'Nguyễn Trung Chính SG': 'Nguyễn Trung Chính', 'Đỗ Thành Công': 'Nguyễn Trung Chính' };
    expect(mapSalesName('Nguyễn Trung Chính SG', m)).toBe('Nguyễn Trung Chính');
    expect(mapSalesName('Đỗ Thành Công', m)).toBe('Nguyễn Trung Chính');
    expect(mapSalesName('Đinh Anh Chi', m)).toBe('Đinh Anh Chi');
  });

  it('isAllowedName bỏ qua tên khác và ô trống', () => {
    const allowed = ['Mai Đình Chiến', 'Đinh Anh Chi'];
    expect(isAllowedName('Đinh Anh Chi', allowed)).toBe(true);
    expect(isAllowedName('  đinh anh chi  ', allowed)).toBe(true);
    expect(isAllowedName('', allowed)).toBe(false);
    expect(isAllowedName('Người lạ', allowed)).toBe(false);
  });

  it('saleMonthFromDate', () => {
    expect(saleMonthFromDate('2026-08-28')).toBe('2026-08');
    expect(saleMonthFromDate(new Date('2026-01-15'))).toBe('2026-01');
  });

  it('parseSalesSheet tìm header', () => {
    const rows: string[][] = [
      ['', 'SỔ CHI TIẾT'],
      ['', 'Ngày', 'Số CT', 'Thành tiền'],
      ['', '2026-08-28', 'HD1', '1000'],
    ];
    const r = parseSalesSheet(rows);
    expect(r.headerRow).toBe(1);
    expect(r.col['so_ct']).toBe(2);
    expect(r.col['thanh_tien']).toBe(3);
  });

  it('parseNumber', () => {
    expect(parseNumber(123)).toBe(123);
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('')).toBe(0);
    expect(parseNumber(null)).toBe(0);
  });

  it('normalizeName', () => {
    expect(normalizeName('  Nguyễn   Trung  Chính  SG  ')).toBe('Nguyễn Trung Chính SG');
  });

  it('isAllowedNameWithMap cho qua khi anh xa ve ten duoc phep', () => {
    const allowed = ['Nguyễn Trung Chính', 'Mai Đình Chiến'];
    const map: Record<string, string> = { 'Nguyễn Trung Chính SG': 'Nguyễn Trung Chính', 'Đỗ Thành Công': 'Nguyễn Trung Chính' };
    // Tên gốc đã được phép
    expect(isAllowedNameWithMap('Mai Đình Chiến', allowed, map)).toBe(true);
    // Tên không được phép nhưng ánh xạ về tên được phép → cho qua
    expect(isAllowedNameWithMap('Nguyễn Trung Chính SG', allowed, map)).toBe(true);
    expect(isAllowedNameWithMap('Đỗ Thành Công', allowed, map)).toBe(true);
    // Tên không được phép và không ánh xạ
    expect(isAllowedNameWithMap('Người lạ', allowed, map)).toBe(false);
    expect(isAllowedNameWithMap('', allowed, map)).toBe(false);
  });
});
