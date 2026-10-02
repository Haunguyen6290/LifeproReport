import { describe, expect, it } from 'vitest';
import { applyImportRules, filterCustomers } from '../customers';

const rows = [
  { ma_kh: 'LP_DONGTIN', ten_kh: 'Phụ tùng ô tô ĐÔNG TÍN', sdt: '0905 123 456', assigned_to: 'a', tier_id: null, status_id: null },
  { ma_kh: 'HN_MINHANH', ten_kh: 'Nội thất Minh Anh', sdt: '0334 560 800', assigned_to: 'b', tier_id: 't1', status_id: 's1' },
];

describe('filterCustomers', () => {
  it('tìm theo tên không dấu', () => {
    expect(filterCustomers(rows, { q: 'dong tin', assignedTo: '', tierId: '', statusId: '' })).toHaveLength(1);
  });
  it('tìm theo số điện thoại bỏ qua khoảng trắng', () => {
    expect(filterCustomers(rows, { q: '0905123456', assignedTo: '', tierId: '', statusId: '' })[0].ma_kh).toBe('LP_DONGTIN');
  });
  it('lọc theo người phụ trách và hạng', () => {
    expect(filterCustomers(rows, { q: '', assignedTo: 'b', tierId: 't1', statusId: '' })).toHaveLength(1);
  });
});

describe('applyImportRules', () => {
  it('phân loại added/dupes/errors/pending/warnings', () => {
    const incoming = [
      { MaKH: 'NEW1', TenKH: 'Mới', SDT: '0905123456', KinhDoanh: 'trungchinh' },
      { MaKH: 'LP_DONGTIN', TenKH: 'Trùng mã', SDT: '0905123456', KinhDoanh: 'x' },
      { MaKH: 'NOSDT', TenKH: 'Thiếu sdt', SDT: '', KinhDoanh: 'x' },
      { MaKH: 'PEND', TenKH: 'Chờ gán', SDT: '0334560800', KinhDoanh: 'khongton tai' },
    ];
    const r = applyImportRules(incoming, new Set(['LP_DONGTIN']), { '0905123456': 'LP_DONGTIN' }, new Set(['trungchinh']));
    expect(r.added.map((a) => a.MaKH)).toEqual(['NEW1']);
    expect(r.updates.map((u) => u.MaKH)).toEqual(['LP_DONGTIN']);
    expect(r.dupes).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.pending).toHaveLength(1);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('trùng mã → cập nhật, không cần SĐT, khớp cả mã viết thường; lặp mã trong file thì bỏ dòng sau', () => {
    const incoming = [
      { MaKH: 'lp-duytung', TenKH: '', SDT: '', TinhTP: 'Bình Định' },
      { MaKH: 'LP-DUYTUNG', TenKH: 'Lặp', SDT: '', TinhTP: 'Khác' },
    ];
    const r = applyImportRules(incoming, new Set(['LP-Duytung']), {}, new Set());
    expect(r.updates).toEqual([{ MaKH: 'LP-Duytung', data: incoming[0] }]);
    expect(r.dupes).toHaveLength(1);
    expect(r.errors).toHaveLength(0);
  });
});
