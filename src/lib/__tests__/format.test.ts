import { describe, expect, it } from 'vitest';
import { fmtPhone, fmtPhones, normText } from '../format';

describe('normText', () => {
  it('viết thường, trim, gom khoảng trắng, bỏ dấu, đ->d', () => {
    expect(normText('  Nguyễn  Văn A ')).toBe('nguyen van a');
    expect(normText('Đà Nẵng')).toBe('da nang');
  });
});

describe('fmtPhone', () => {
  it('định dạng số VN 10 chữ số bắt đầu bằng 0', () => {
    expect(fmtPhone('0905123456')).toBe('0905 123 456');
    expect(fmtPhone('0334 560 800')).toBe('0334 560 800');
  });
  it('giữ nguyên (trim) khi không khớp mẫu', () => {
    expect(fmtPhone('123')).toBe('123');
    expect(fmtPhone(' +84 90 512 3456 ')).toBe('+84 90 512 3456');
  });
});

describe('fmtPhones', () => {
  it('định dạng từng số ngăn bởi , ; /', () => {
    expect(fmtPhones('0905123456;0334560800')).toBe('0905 123 456, 0334 560 800');
    expect(fmtPhones('')).toBe('');
  });
});
