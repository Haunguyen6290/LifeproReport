import { describe, it, expect } from 'vitest';
import { parseNgay, phanLoaiTk } from '@/lib/finance';

describe('parseNgay', () => {
  it('dd/mm/yyyy string', () => expect(parseNgay('02/01/2026')).toBe('2026-01-02'));
  it('ISO string', () => expect(parseNgay('2026-08-31')).toBe('2026-08-31'));
  it('Excel serial', () => expect(parseNgay(46024)).toBe('2026-01-02'));
  it('Date object', () => expect(parseNgay(new Date('2026-07-15'))).toBe('2026-07-15'));
  it('rỗng → null', () => expect(parseNgay('')).toBeNull());
});

describe('phanLoaiTk — tiền tố dài nhất thắng', () => {
  const map = [
    { ma: '511', nhom: 'Doanh thu' as const },
    { ma: '5111', nhom: 'Doanh thu' as const },
    { ma: '521', nhom: 'Trả lại' as const },
    { ma: '111', nhom: 'Thu tiền' as const },
    { ma: '112', nhom: 'Thu tiền' as const },
    { ma: '131', nhom: 'Thu tiền' as const },
    { ma: '1368', nhom: 'Thu tiền' as const },
    { ma: '6426', nhom: 'Thu tiền' as const },
  ];
  it('112101 → Thu tiền (112)', () => expect(phanLoaiTk('112101', map)).toBe('Thu tiền'));
  it('51111 → Doanh thu (5111 dài hơn 511)', () => expect(phanLoaiTk('51111', map)).toBe('Doanh thu'));
  it('52121 → Trả lại', () => expect(phanLoaiTk('52121', map)).toBe('Trả lại'));
  it('3413 → Thu tiền (nếu có trong map)', () => {
    const m2 = [...map, { ma: '3413', nhom: 'Thu tiền' as const }];
    expect(phanLoaiTk('3413', m2)).toBe('Thu tiền');
  });
  it('TK lạ → null', () => expect(phanLoaiTk('999', map)).toBeNull());
});
