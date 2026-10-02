import { describe, expect, it } from 'vitest';
import { parseMoney, parseOpeningSheet, ngayTruocMoc } from '../opening-balance';

describe('parseMoney', () => {
  it('đọc số Excel và chữ có dấu phân cách', () => {
    expect(parseMoney(15000000)).toBe(15000000);
    expect(parseMoney('15.000.000')).toBe(15000000);
    expect(parseMoney('15,000,000')).toBe(15000000);
    expect(parseMoney('2000000đ')).toBe(2000000);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('abc')).toBeNaN();
  });
});

describe('parseOpeningSheet', () => {
  const head = ['Mã khách', 'Tên khách', 'Dư Nợ', 'Dư Có', 'SĐT', 'Tỉnh/TP'];

  it('Dư Nợ − Dư Có ra số dư, lấy kèm cột phụ', () => {
    const r = parseOpeningSheet([
      head,
      ['LP1', 'Gara A', 15000000, 0, '0905123456', 'Đà Nẵng'],
      ['LP2', 'Gara B', 0, 2000000, '', ''],
    ]);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.du_no)).toEqual([15000000, -2000000]);
    expect(r.rows[0].extra.TinhTP).toBe('Đà Nẵng');
    expect(r.rows[1].extra).toEqual({});
  });

  it('báo lỗi từng dòng sai, bỏ qua dòng trống', () => {
    const r = parseOpeningSheet([
      head,
      ['', 'Không mã', 100, 0],
      ['LP3', '', 100, 0],
      ['LP4', 'Cả 2 bên', 100, 50],
      ['LP5', 'Chữ', 'abc', 0],
      ['LP6', 'Âm', -100, 0],
      ['LP7', 'OK', 100, 0],
      ['lp7', 'Lặp', 100, 0],
      ['', '', '', ''],
    ]);
    expect(r.rows.map((x) => x.ma_kh)).toEqual(['LP7']);
    expect(r.errors.map((e) => e.dong)).toEqual([2, 3, 4, 5, 6, 8]);
  });

  it('báo thiếu cột bắt buộc', () => {
    expect(parseOpeningSheet([['Mã khách', 'Ghi chú']]).thieuCot).toEqual(['Tên khách', 'Dư Nợ / Dư Có']);
  });
});

describe('ngayTruocMoc', () => {
  it('mốc 01/01 → cuối ngày 31/12 năm trước', () => {
    expect(ngayTruocMoc('2026-01-01')).toBe('2025-12-31');
    expect(ngayTruocMoc('2026-03-01')).toBe('2026-02-28');
  });
});
