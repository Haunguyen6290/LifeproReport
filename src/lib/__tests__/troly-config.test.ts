import { describe, it, expect } from 'vitest';
import { phanHeChoDuongDan, locCauHoiTheoCauHinh, type BotPhanHe, type BotNhom, type BotRow } from '@/lib/troly-config';

describe('phanHeChoDuongDan', () => {
  it('chưa có danh mục → fallback hành vi cũ', () => {
    expect(phanHeChoDuongDan('/bao-cao-tuan', [])).toEqual(['Trợ lý Báo cáo tuần']);
    expect(phanHeChoDuongDan('/tro-ly', [])).toEqual(['Bộ não chung công ty']);
    expect(phanHeChoDuongDan('/bao-cao-ban-hang', [])).toEqual(['Trợ lý Kinh doanh']);
  });

  it('một trang hiện nhiều phân hệ (Kế hoạch trong Báo cáo tuần)', () => {
    const ds: BotPhanHe[] = [
      { name: 'Trợ lý Báo cáo tuần', routes: ['/bao-cao-tuan'], macDinh: false },
      { name: 'Trợ lý Kế hoạch', routes: ['/bao-cao-tuan'], macDinh: false },
    ];
    expect(phanHeChoDuongDan('/bao-cao-tuan', ds)).toEqual(['Trợ lý Báo cáo tuần', 'Trợ lý Kế hoạch']);
  });

  it('đường dẫn cụ thể thắng đường dẫn ngắn (longest prefix)', () => {
    const ds: BotPhanHe[] = [
      { name: 'Trợ lý Kho', routes: ['/bao-cao-kho'], macDinh: false },
      { name: 'Trợ lý Kinh doanh', routes: ['/bao-cao-ban-hang'], macDinh: false },
    ];
    expect(phanHeChoDuongDan('/bao-cao-ban-hang', ds)).toEqual(['Trợ lý Kinh doanh']);
    expect(phanHeChoDuongDan('/bao-cao-kho', ds)).toEqual(['Trợ lý Kho']);
    expect(phanHeChoDuongDan('/bao-cao-ban-hang/thang-08', ds)).toEqual(['Trợ lý Kinh doanh']);
  });

  it('không khớp → dùng phân hệ mặc định', () => {
    const ds: BotPhanHe[] = [
      { name: 'Bộ não chung công ty', routes: [], macDinh: true },
      { name: 'Trợ lý OKRs', routes: ['/okr'], macDinh: false },
    ];
    expect(phanHeChoDuongDan('/tai-chinh', ds)).toEqual(['Bộ não chung công ty']);
    expect(phanHeChoDuongDan('/okr', ds)).toEqual(['Trợ lý OKRs']);
  });
});

describe('locCauHoiTheoCauHinh', () => {
  const rows: BotRow[] = [
    { cau_hoi: 'KH tuần là gì?', nhom_chu_de: 'Nhóm Kế hoạch', phan_he: 'Trợ lý Kế hoạch' },
    { cau_hoi: 'Báo cáo tuần nộp khi nào?', nhom_chu_de: 'Quy trình', phan_he: 'Trợ lý Báo cáo tuần' },
    { cau_hoi: 'OKRs là gì?', nhom_chu_de: 'Khái niệm', phan_he: 'Trợ lý OKRs' },
  ];

  it('chỉ hiện câu hỏi của phân hệ đang kích hoạt', () => {
    const { groups, rows: kept } = locCauHoiTheoCauHinh(rows, ['Trợ lý Báo cáo tuần'], []);
    expect(groups).toEqual(['Quy trình']);
    expect(kept.length).toBe(1);
  });

  it('nhóm gắn nhiều phân hệ → câu hỏi nhóm đó cũng hiện ở phân hệ kia', () => {
    const nhom: BotNhom[] = [{ key: 'Nhóm Kế hoạch', name: 'Nhóm Kế hoạch', phanHe: ['Trợ lý Báo cáo tuần'] }];
    const { groups, rows: kept } = locCauHoiTheoCauHinh(rows, ['Trợ lý Báo cáo tuần'], nhom);
    expect(groups.sort()).toEqual(['Nhóm Kế hoạch', 'Quy trình']);
    expect(kept.length).toBe(2);
  });

  it('nhóm chưa gắn phân hệ nào → không thêm gì', () => {
    const nhom: BotNhom[] = [{ key: 'Nhóm Kế hoạch', name: 'Nhóm Kế hoạch', phanHe: [] }];
    const { groups } = locCauHoiTheoCauHinh(rows, ['Trợ lý Báo cáo tuần'], nhom);
    expect(groups).toEqual(['Quy trình']);
  });

  it('đổi tên nhóm trong Danh mục → bot hiện tên mới, vẫn nối đúng câu hỏi qua key', () => {
    const nhom: BotNhom[] = [{ key: 'Nhóm Kế hoạch', name: 'Kế hoạch tuần', phanHe: [] }];
    const { groups, rows: kept } = locCauHoiTheoCauHinh(rows, ['Trợ lý Kế hoạch'], nhom);
    // Phân hệ kích hoạt là Trợ lý Kế hoạch → giữ câu hỏi; tên nhóm hiển thị theo Danh mục
    expect(groups).toEqual(['Kế hoạch tuần']);
    expect(kept.find((r) => r.cau_hoi === 'KH tuần là gì?')?.nhom_chu_de).toBe('Kế hoạch tuần');
  });
});
