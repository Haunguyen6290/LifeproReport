import { describe, it, expect } from 'vitest';
import { normalizeQuery } from '@/lib/chatbot/normalize';
import { mapContextToPhanHe } from '@/lib/chatbot/context';
import { rankQA, SCORE_THRESHOLD } from '@/lib/chatbot/search';

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

const rows: any[] = [
  { id: 'QA-0012', phan_he: 'Trợ lý OKRs', nhom_chu_de: 'Khái niệm', cau_hoi: 'OKRs là gì?', tra_loi_chuan: 'OKRs là cách xác định mục tiêu và các kết quả then chốt.', vi_du: '', cau_hoi_tiep_theo: '', hanh_dong: '', phan_he_lien_quan: [], vai_tro: '', muc_do: '', uu_tien: '' },
  { id: 'QA-0054', phan_he: 'Trợ lý Kho', nhom_chu_de: 'Tồn kho', cau_hoi: 'Hàng tồn lâu cần làm gì?', tra_loi_chuan: 'Thống kê phân loại nguyên nhân.', vi_du: '', cau_hoi_tiep_theo: '', hanh_dong: '', phan_he_lien_quan: [], vai_tro: '', muc_do: '', uu_tien: '' },
];

describe('rankQA', () => {
  it('khớp không dấu', () => {
    const { matches } = rankQA(rows, 'okrs la gi', null, 3);
    expect(matches[0]?.qa.id).toBe('QA-0012');
  });
  it('ưu tiên context boost', () => {
    const { matches } = rankQA(rows, 'hang ton', 'Trợ lý Kho', 3);
    expect(matches[0]?.qa.id).toBe('QA-0054');
  });
  it('không khớp trả rỗng + suggestions', () => {
    const { matches, suggestions } = rankQA(rows, 'zzzzxxxx', null, 3);
    expect(matches.length).toBe(0);
    expect(suggestions.length).toBeGreaterThan(0);
  });
  it('ngưỡng SCORE_THRESHOLD', () => {
    expect(SCORE_THRESHOLD).toBe(0.2);
  });
});
