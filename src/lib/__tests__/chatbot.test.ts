import { describe, it, expect } from 'vitest';
import { normalizeQuery } from '@/lib/chatbot/normalize';
import { mapContextToPhanHe } from '@/lib/chatbot/context';

describe('normalizeQuery', () => {
  it('bỏ dấu và lowercase', () => {
    expect(normalizeQuery('Báo cáo tuần')).toBe('bao cao tuan');
    expect(normalizeQuery('  OKRs — là gì?  ')).toBe('okrs la gi');
    expect(normalizeQuery('đường')).toBe('duong');
  });
  it('ký tự đặc biệt → khoảng trắng', () => {
    expect(normalizeQuery('---')).toBe('');
    expect(normalizeQuery('A.B/C')).toBe('a b c');
  });
});

describe('mapContextToPhanHe', () => {
  it('map prefix', () => {
    expect(mapContextToPhanHe('/okr')).toBe('Trợ lý OKRs');
    expect(mapContextToPhanHe('/okr/123')).toBe('Trợ lý OKRs');
    expect(mapContextToPhanHe('/khach-hang/moi')).toBe('Trợ lý Khách hàng');
    expect(mapContextToPhanHe('/bao-cao-kho')).toBe('Trợ lý Kho');
    expect(mapContextToPhanHe('/bao-cao-ban-hang')).toBe('Trợ lý Kinh doanh');
    expect(mapContextToPhanHe('/thi-truong')).toBe('Trợ lý Thị trường kinh doanh');
    expect(mapContextToPhanHe('/chien-dich')).toBe('Trợ lý Chiến dịch');
    expect(mapContextToPhanHe('/bao-cao-tuan')).toBe('Trợ lý Báo cáo tuần');
    expect(mapContextToPhanHe('/tro-ly')).toBe('Bộ não chung công ty');
  });
  it('/ chỉ khớp exact /, unknown trả null', () => {
    expect(mapContextToPhanHe('/')).toBe('Bộ não chung công ty');
    expect(mapContextToPhanHe('/unknown')).toBe(null);
    expect(mapContextToPhanHe('')).toBe(null);
  });
});
