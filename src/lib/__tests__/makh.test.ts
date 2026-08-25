import { describe, expect, it } from 'vitest';
import { buildMaKH } from '../makh';

describe('buildMaKH', () => {
  it('viết tắt tỉnh + từ khóa tên cuối, viết hoa', () => {
    expect(buildMaKH('Cửa hàng nội thất Minh Anh', 'Hà Nội')).toBe('HN_MINHANH');
  });
  it('thêm hậu tố số khi mã đã tồn tại', () => {
    expect(buildMaKH('Cửa hàng nội thất Minh Anh', 'Hà Nội', new Set(['HN_MINHANH']))).toBe('HN_MINHANH2');
  });
  it('lấy 3 từ cuối khi 2 từ cuối ngắn dưới 6 ký tự', () => {
    expect(buildMaKH('Nội thất ô tô Minh An Lê', 'Đà Nẵng')).toBe('DN_MINHANLE');
  });
});
