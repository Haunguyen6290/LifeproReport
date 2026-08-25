import { describe, expect, it } from 'vitest';
import { filterOptions } from '../combobox';

const opts = [
  { id: '1', label: 'Auto 365 Tan Binh', sub: 'LP_DONGTIN' },
  { id: '2', label: 'Nội thất Minh Anh', sub: 'HN_MINHANH' },
  { id: '3', label: 'Bóng LED L55', sub: undefined },
];

describe('filterOptions', () => {
  it('lọc theo tên không dấu', () => {
    expect(filterOptions(opts, 'dong tin', []).map((o) => o.id)).toEqual(['1']);
    expect(filterOptions(opts, 'minh anh', []).map((o) => o.id)).toEqual(['2']);
  });
  it('lọc theo sub (mã KH)', () => {
    expect(filterOptions(opts, 'HN_MINHANH', []).map((o) => o.id)).toEqual(['2']);
  });
  it('loại các mục đã chọn', () => {
    expect(filterOptions(opts, '', ['1']).map((o) => o.id)).toEqual(['2', '3']);
  });
  it('q rỗng + không exclude → trả hết', () => {
    expect(filterOptions(opts, '', []).map((o) => o.id)).toEqual(['1', '2', '3']);
  });
});
