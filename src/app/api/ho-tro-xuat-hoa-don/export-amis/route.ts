import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false };
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  const ok = perms.includes('quan_ly_cai_dat') || perms.includes('ke_toan') || perms.includes('xem_tai_chinh');
  return { ok, userId: u.user.id };
}

export async function GET(req: NextRequest) {
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const maKh = sp.get('ma_kh') || '';
  const tu = sp.get('tu') || '';
  const den = sp.get('den') || '';

  const db = admin();
  let query = db.from('amis_sales_rows').select('*').order('ngay_hach_toan', { ascending: true }).order('so_ct');

  if (maKh) query = query.eq('ma_kh', maKh);
  if (tu && /^\d{4}-\d{2}-\d{2}$/.test(tu)) query = query.gte('ngay_hach_toan', tu);
  if (den && /^\d{4}-\d{2}-\d{2}$/.test(den)) query = query.lte('ngay_hach_toan', den);

  const { data, error } = await query.limit(50000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Không có dữ liệu' }, { status: 400 });
  }

  // Map sang format Excel giống file gốc
  const excelRows = data.map((r: any) => ({
    'Hình thức bán hàng': r.hinh_thuc_ban_hang || '',
    'Phương thức thanh toán': r.phuong_thuc_thanh_toan || '',
    'Kiêm phiếu xuất kho': r.kiem_phieu_xuat_kho || '',
    'Lập kèm hóa đơn': r.lap_kem_hoa_don || '',
    'Đã lập hóa đơn': r.da_lap_hoa_don || '',
    'Ngày hạch toán (*)': formatDate(r.ngay_hach_toan),
    'Ngày chứng từ (*)': formatDate(r.ngay_chung_tu),
    'Số chứng từ (*)': r.so_ct || '',
    'Số phiếu xuất': r.so_phieu_xuat || '',
    'Mẫu số HĐ': r.mau_so_hd || '',
    'Ký hiệu HĐ': r.ky_hieu_hd || '',
    'Số hóa đơn': r.so_hoa_don || '',
    'Ngày hóa đơn': formatDate(r.ngay_hoa_don),
    'Mã khách hàng': r.ma_kh || '',
    'Tên khách hàng': r.ten_khach_hang || '',
    'Địa chỉ': r.dia_chi || '',
    'Mã số thuế': r.ma_so_thue || '',
    'Đơn vị giao đại lý': r.don_vi_giao_dai_ly || '',
    'Người nộp': r.nguoi_nop || '',
    'Nộp vào TK': r.nop_vao_tk || '',
    'Tên ngân hàng': r.ten_ngan_hang || '',
    'Diễn giải/Lý do nộp': r.dien_giai || '',
    'Lý do xuất': r.ly_do_xuat || '',
    'Loại tiền': r.loai_tien || '',
    'Tỷ giá': r.ty_gia || '',
    'Mã hàng (*)': r.ma_hang || '',
    'Tên hàng': r.ten_hang || '',
    'Là dòng ghi chú': r.la_dong_ghi_chu || '',
    'Hàng khuyến mại': r.hang_khuyen_mai || '',
    'Chiết khấu thương mại': r.chiet_khau_thuong_mai || '',
    'TK Tiền/Chi phí/Nợ (*)': r.tk_tien_chi_phi_no || '',
    'TK Doanh thu/Có (*)': r.tk_doanh_thu_co || '',
    'ĐVT': r.dvt || '',
    'Số lượng': r.so_luong || '',
    'Đơn giá': r.don_gia || '',
    'Thành tiền': r.thanh_tien || '',
    'Thành tiền quy đổi': r.thanh_tien_quy_doi || '',
    'Thành tiền quy đổi theo TGHQ': r.thanh_tien_quy_doi_tghq || '',
    'Tỷ lệ CK (%)': r.ty_le_ck || '',
    'Tiền chiết khấu': r.tien_chiet_khau || '',
    'Tiền chiết khấu quy đổi': r.tien_ck_quy_doi || '',
    'Tiền CK quy đổi theo TGHQ': r.tien_ck_quy_doi_tghq || '',
    'TK chiết khấu': r.tk_chiet_khau || '',
    'Giá tính thuế XK': r.gia_tinh_thue_xk || '',
    '% thuế xuất khẩu': r.phan_tram_thue_xk || '',
    'Tiền thuế xuất khẩu': r.tien_thue_xk || '',
    'TK thuế xuất khẩu': r.tk_thue_xk || '',
    '% thuế GTGT': r.phan_tram_thue_gtgt || '',
    '% thuế suất KHAC': r.phan_tram_thue_suat_khac || '',
    'Tiền thuế GTGT': r.tien_thue_gtgt || '',
    'Tiền thuế GTGT quy đổi': r.tien_thue_gtgt_quy_doi || '',
    'TK thuế GTGT': r.tk_thue_gtgt || '',
    'HH không TH trên tờ khai thuế GTGT': r.hh_khong_th_tren_to_khai || '',
    'Mã kho': r.ma_kho || '',
    'TK giá vốn': r.tk_gia_von || '',
    'TK Kho': r.tk_kho || '',
    'Đơn giá vốn': r.don_gia_von || '',
    'Tiền vốn': r.tien_von || '',
    'Hàng hóa giữ hộ/bán hộ': r.hang_hoa_giu_ho_ban_ho || '',
  }));

  // Tạo workbook
  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ban hang');

  // Xuất buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Log export
  const allSoCt = Array.from(new Set(data.map((r: any) => r.so_ct))).sort();
  await db.from('amis_logs').insert({
    user_id: perm.userId,
    action: 'export',
    file_name: `AMIS_Export_${new Date().toISOString().slice(0, 10)}.xlsx`,
    so_dong: data.length,
    so_ct_tu: allSoCt[0] || '',
    so_ct_den: allSoCt[allSoCt.length - 1] || '',
    filters: { ma_kh: maKh, tu, den },
  });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="AMIS_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

function formatDate(d: any): string {
  if (!d) return '';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
