import { describe, it, expect } from 'vitest';
import { parseTk131Sheet, parseDataKHSheet } from '@/lib/receivable-import';

// Bố cục thật của sheet TK131 trong Bao_cao_cong_no_qua_han.xlsx (lệch 1 cột do có cột A trống)
const SO_LECH = [
  ['  Đơn vị : LIFEPRO', null, null, 'Mẫu số S38-DN'],
  ['Sổ chi tiết tài khoản'],
  ['Tài khoản: 131 Phải thu của khách hàng'],
  ['Từ ngày: 2026-01-01  đến ngày: 2026-08-31'],
  [null, 'Tài khoản', 'Chứng từ', null, 'Mã đói tác', 'Đối tác', 'Diễn giải', 'TK đối ứng', 'Số phát sinh', null, 'Số dư'],
  [null, null, 'Số hiệu', 'Ngày, tháng', null, null, null, null, 'Nợ', 'Có', 'Nợ', 'Có'],
  [null, '- Số dư đầu kỳ', null, null, null, null, null, null, null, null, 3486085967, 0],
  [null, '- Số phát sinh trong kỳ', null, null, null, null, null, null, null, null, null, null],
  [null, '131', 'BNK1060126-00005', '02/01/2026', 'LP1341', 'Hoàng Phúc Auto', 'KH thanh toán tiền hàng', '112101', 0, 18559600, 3467526367, 0],
  [null, '131', 'HD010726-00002', '02/01/2026', 'LP1455', 'KH Triệu Độ Đèn', 'Bán hàng', '51111', 6200000, 0, 3473726367, 0],
  [null, null, null, null, null, null, null, null, null, '2026-08-31 08:42:12'],
  [null, null, 'Người lập', null, null, 'Kế toán trưởng', null, null, null, 'Giám đốc'],
];

// Bố cục sheet Tai_khoan_131 trong Bao_cao_banhang_thutien.xlsx (KHÔNG lệch cột)
const SO_KHONG_LECH = [
  ['Tài khoản', 'Chứng từ', null, 'Mã đói tác', 'Đối tác', 'Diễn giải', 'TK đối ứng', 'Số phát sinh', null, 'Số dư'],
  [null, 'Số hiệu', 'Ngày, tháng', null, null, null, null, 'Nợ', 'Có', 'Nợ', 'Có'],
  ['- Số dư đầu kỳ', null, null, null, null, null, null, null, null, 3123963086, 0],
  ['131', 'BNK1010726-00001', '01/07/2026', 'LP-HOANGSINH2', 'Cửa hàng Hoàng Sinh 2', 'KH thanh toán tiền hàng', '112101', 0, 10600000, 3113363086, 0],
];

describe('parseTk131Sheet — bản lệch cột', () => {
  const r = parseTk131Sheet(SO_LECH);
  it('đọc metadata kỳ + số dư đầu kỳ', () => {
    expect(r.header.tuNgay).toBe('2026-01-01');
    expect(r.header.denNgay).toBe('2026-08-31');
    expect(r.header.soDuDauKy).toBe(3486085967);
  });
  it('lấy đúng 2 dòng chứng từ, bỏ dòng tổng/chữ ký', () => {
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ ngay: '2026-01-02', so_ct: 'BNK1060126-00005', ma_kh: 'LP1341', ten_kh: 'Hoàng Phúc Auto', tk_doi_ung: '112101', so_no: 0, so_co: 18559600 });
    expect(r.rows[1]).toMatchObject({ ma_kh: 'LP1455', tk_doi_ung: '51111', so_no: 6200000, so_co: 0 });
  });
});

describe('parseTk131Sheet — bản không lệch cột', () => {
  const r = parseTk131Sheet(SO_KHONG_LECH);
  it('số dư đầu kỳ + 1 dòng chứng từ', () => {
    expect(r.header.soDuDauKy).toBe(3123963086);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ ngay: '2026-07-01', ma_kh: 'LP-HOANGSINH2', so_co: 10600000 });
  });
  it('không có tiêu đề kỳ → tuNgay/denNgay rỗng (route sẽ tự suy từ dòng dữ liệu)', () => {
    expect(r.header.tuNgay).toBe('');
    expect(r.header.denNgay).toBe('');
  });
});

describe('parseDataKHSheet', () => {
  it('nhận diện cột "Nợ 01/01/2026" (file nợ)', () => {
    const rows = [
      ['Ma KH', 'Ten KH', 'NVKD', 'NVKD — DÙNG CHO BÁO CÁO', 'Tỉnh/Thành', 'Nợ 01/01/2026'],
      ['LP1163', 'Cửa hàng Anh Vinh', 'Đinh Anh Chi', 'Đinh Anh Chi', 'Hà Nội', 58426000],
      ['HPG-KL', 'HyperGard - Khách lẻ', '', 'Công ty', '', 0],
    ];
    const r = parseDataKHSheet(rows);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ ma: 'LP1163', ten: 'Cửa hàng Anh Vinh', nvkd: 'Đinh Anh Chi', duNo: 58426000 });
    expect(r[1].duNo).toBe(0);
    expect(r[1].nvkd).toBe('Công ty');
  });
  it('DataKH bản thu tiền KHÔNG có cột Nợ → trả rỗng, không được ghi đè số gốc', () => {
    const rows = [
      ['Ma KH', 'Ten KH', 'NVKD', 'NVKD — DÙNG CHO BÁO CÁO', 'Tỉnh/Thành', 'Bán hàng', 'Thu tiền'],
      ['HKDADG', 'HKD Phụ kiện ô tô ADG', 'Trần Thị Hồng', 'Trần Thị Hồng', 'Hà Nội', 50520000, 0],
    ];
    expect(parseDataKHSheet(rows)).toEqual([]);
  });
});
