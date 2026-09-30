import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

type ParsedRow = {
  so_ct: string;
  ma_kh: string;
  ma_hang: string;
  ngay_hach_toan: string;
  [key: string]: any;
};

export async function POST(req: NextRequest) {
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Thiếu file' }, { status: 400 });

    // Parse Excel
    const buffer = await file.arrayBuffer();
    const XLSX = (await import('xlsx')).default;
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rawData.length < 2) return NextResponse.json({ error: 'File rỗng' }, { status: 400 });

    // Dòng 1 là header (index 1)
    const headers = rawData[1] as string[];
    const rows: ParsedRow[] = [];

    for (let i = 2; i < rawData.length; i++) {
      const rowData = rawData[i];
      if (!rowData || rowData.length === 0) continue;

      const row: any = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const val = rowData[j];
        if (header && val !== null && val !== undefined && val !== '') {
          row[header] = val;
        }
      }

      const soCt = String(row['Số chứng từ (*)'] ?? '').trim();
      const maHang = String(row['Mã hàng (*)'] ?? '').trim();
      const maKh = String(row['Mã khách hàng'] ?? '').trim();

      if (!soCt || !maHang) continue;

      rows.push({
        so_ct: soCt,
        ma_kh: maKh,
        ma_hang: maHang,
        ngay_hach_toan: parseDate(row['Ngày hạch toán (*)']),
        rawData: row,
      });
    }

    if (rows.length === 0) return NextResponse.json({ error: 'Không có dòng hợp lệ' }, { status: 400 });

    const db = admin();

    // Lấy dm_thue để so sánh
    const { data: dmThue } = await db.from('dm_thue').select('ma_thue,cap1');
    const thueMap = new Map<string, string>();
    for (const t of (dmThue ?? [])) {
      if (t.cap1) thueMap.set(String(t.cap1).trim().toUpperCase(), String(t.ma_thue).trim());
    }

    // Nhóm theo số chứng từ và xác định trạng thái
    const groupBySoCt = new Map<string, ParsedRow[]>();
    for (const r of rows) {
      const list = groupBySoCt.get(r.so_ct) || [];
      list.push(r);
      groupBySoCt.set(r.so_ct, list);
    }

    const processedRows: any[] = [];
    for (const [soCt, group] of groupBySoCt.entries()) {
      let hasBad = false;
      for (const r of group) {
        const maHangUpper = r.ma_hang.toUpperCase();
        const maThue = thueMap.get(maHangUpper);
        // Chuẩn: cap1 = ma_hang = ma_thue
        if (!maThue || maThue.toUpperCase() !== maHangUpper) {
          hasBad = true;
          break;
        }
      }

      const finalSoCt = hasBad ? `${soCt}_MTK` : soCt;
      const trangThai = hasBad ? 'khong_chuan' : 'chuan';

      for (const r of group) {
        processedRows.push({ ...r, so_ct: finalSoCt, trang_thai: trangThai });
      }
    }

    // Check trùng: lấy tất cả so_ct hiện có
    const uniqueSoCt = Array.from(new Set(processedRows.map(r => r.so_ct)));
    const { data: existing } = await db.from('amis_sales_rows')
      .select('so_ct,ma_hang,ma_kh,so_luong,don_gia,thanh_tien')
      .in('so_ct', uniqueSoCt);

    const existingMap = new Map<string, Set<string>>();
    for (const e of (existing ?? [])) {
      const key = `${e.so_ct}|${e.ma_hang}|${e.ma_kh}|${e.so_luong}|${e.don_gia}|${e.thanh_tien}`;
      const set = existingMap.get(e.so_ct) || new Set();
      set.add(key);
      existingMap.set(e.so_ct, set);
    }

    // So sánh và quyết định xóa/insert
    const toDelete = new Set<string>();
    const toInsert: any[] = [];

    for (const [soCt, group] of groupBySoCt.entries()) {
      const finalSoCt = processedRows.find(p => p.so_ct.startsWith(soCt))?.so_ct || soCt;
      const existingSet = existingMap.get(finalSoCt);

      if (!existingSet) {
        // Chứng từ mới hoàn toàn
        for (const r of processedRows.filter(p => p.so_ct === finalSoCt)) {
          toInsert.push(mapToDbRow(r, perm.userId!));
        }
        continue;
      }

      // So sánh từng dòng
      let isDifferent = false;
      const newKeys = new Set<string>();
      for (const r of processedRows.filter(p => p.so_ct === finalSoCt)) {
        const raw = r.rawData;
        const key = `${finalSoCt}|${r.ma_hang}|${r.ma_kh}|${raw['Số lượng']}|${raw['Đơn giá']}|${raw['Thành tiền']}`;
        newKeys.add(key);
        if (!existingSet.has(key)) {
          isDifferent = true;
          break;
        }
      }

      if (isDifferent || newKeys.size !== existingSet.size) {
        toDelete.add(finalSoCt);
        for (const r of processedRows.filter(p => p.so_ct === finalSoCt)) {
          toInsert.push(mapToDbRow(r, perm.userId!));
        }
      }
    }

    // Execute delete + insert
    let newCount = 0;
    let updatedCount = toDelete.size;

    if (toDelete.size > 0) {
      await db.from('amis_sales_rows').delete().in('so_ct', Array.from(toDelete));
    }

    if (toInsert.length > 0) {
      // Batch insert 500 dòng/lần
      for (let i = 0; i < toInsert.length; i += 500) {
        const batch = toInsert.slice(i, i + 500);
        await db.from('amis_sales_rows').insert(batch);
      }
      newCount = toInsert.length;
    }

    // Tính số CT từ - đến
    const allSoCt = Array.from(new Set(processedRows.map(r => r.so_ct))).sort();
    const soCt_tu = allSoCt[0] || '';
    const soCt_den = allSoCt[allSoCt.length - 1] || '';

    // Log
    await db.from('amis_logs').insert({
      user_id: perm.userId,
      action: 'import',
      file_name: file.name,
      so_dong: rows.length,
      so_ct_tu: soCt_tu,
      so_ct_den: soCt_den,
      filters: null,
    });

    return NextResponse.json({
      ok: true,
      total: rows.length,
      new: newCount,
      updated: updatedCount,
      so_ct_tu: soCt_tu,
      so_ct_den: soCt_den,
    });
  } catch (e: any) {
    console.error('Import AMIS error:', e);
    return NextResponse.json({ error: e?.message || 'Lỗi xử lý file' }, { status: 500 });
  }
}

function parseDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    // DD/MM/YYYY
    const parts = val.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    // Excel date serial
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + val * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return '';
}

function mapToDbRow(r: ParsedRow, userId: string): any {
  const raw = r.rawData;
  return {
    so_ct: r.so_ct,
    ma_kh: r.ma_kh,
    ma_hang: r.ma_hang,
    ngay_hach_toan: r.ngay_hach_toan || null,
    trang_thai: r.trang_thai,
    hinh_thuc_ban_hang: raw['Hình thức bán hàng'] || null,
    phuong_thuc_thanh_toan: raw['Phương thức thanh toán'] || null,
    kiem_phieu_xuat_kho: raw['Kiêm phiếu xuất kho'] || null,
    lap_kem_hoa_don: raw['Lập kèm hóa đơn'] || null,
    da_lap_hoa_don: raw['Đã lập hóa đơn'] || null,
    ngay_chung_tu: parseDate(raw['Ngày chứng từ (*)']) || null,
    so_phieu_xuat: raw['Số phiếu xuất'] || null,
    mau_so_hd: raw['Mẫu số HĐ'] || null,
    ky_hieu_hd: raw['Ký hiệu HĐ'] || null,
    so_hoa_don: raw['Số hóa đơn'] || null,
    ngay_hoa_don: parseDate(raw['Ngày hóa đơn']) || null,
    ten_khach_hang: raw['Tên khách hàng'] || null,
    dia_chi: raw['Địa chỉ'] || null,
    ma_so_thue: raw['Mã số thuế'] || null,
    don_vi_giao_dai_ly: raw['Đơn vị giao đại lý'] || null,
    nguoi_nop: raw['Người nộp'] || null,
    nop_vao_tk: raw['Nộp vào TK'] || null,
    ten_ngan_hang: raw['Tên ngân hàng'] || null,
    dien_giai: raw['Diễn giải/Lý do nộp'] || null,
    ly_do_xuat: raw['Lý do xuất'] || null,
    loai_tien: raw['Loại tiền'] || null,
    ty_gia: raw['Tỷ giá'] || null,
    ten_hang: raw['Tên hàng'] || null,
    la_dong_ghi_chu: raw['Là dòng ghi chú'] || null,
    hang_khuyen_mai: raw['Hàng khuyến mại'] || null,
    chiet_khau_thuong_mai: raw['Chiết khấu thương mại'] || null,
    tk_tien_chi_phi_no: raw['TK Tiền/Chi phí/Nợ (*)'] || null,
    tk_doanh_thu_co: raw['TK Doanh thu/Có (*)'] || null,
    dvt: raw['ĐVT'] || null,
    so_luong: raw['Số lượng'] || null,
    don_gia: raw['Đơn giá'] || null,
    thanh_tien: raw['Thành tiền'] || null,
    thanh_tien_quy_doi: raw['Thành tiền quy đổi'] || null,
    thanh_tien_quy_doi_tghq: raw['Thành tiền quy đổi theo TGHQ'] || null,
    ty_le_ck: raw['Tỷ lệ CK (%)'] || null,
    tien_chiet_khau: raw['Tiền chiết khấu'] || null,
    tien_ck_quy_doi: raw['Tiền chiết khấu quy đổi'] || null,
    tien_ck_quy_doi_tghq: raw['Tiền CK quy đổi theo TGHQ'] || null,
    tk_chiet_khau: raw['TK chiết khấu'] || null,
    gia_tinh_thue_xk: raw['Giá tính thuế XK'] || null,
    phan_tram_thue_xk: raw['% thuế xuất khẩu'] || null,
    tien_thue_xk: raw['Tiền thuế xuất khẩu'] || null,
    tk_thue_xk: raw['TK thuế xuất khẩu'] || null,
    phan_tram_thue_gtgt: raw['% thuế GTGT'] || null,
    phan_tram_thue_suat_khac: raw['% thuế suất KHAC'] || null,
    tien_thue_gtgt: raw['Tiền thuế GTGT'] || null,
    tien_thue_gtgt_quy_doi: raw['Tiền thuế GTGT quy đổi'] || null,
    tk_thue_gtgt: raw['TK thuế GTGT'] || null,
    hh_khong_th_tren_to_khai: raw['HH không TH trên tờ khai thuế GTGT'] || null,
    ma_kho: raw['Mã kho'] || null,
    tk_gia_von: raw['TK giá vốn'] || null,
    tk_kho: raw['TK Kho'] || null,
    don_gia_von: raw['Đơn giá vốn'] || null,
    tien_von: raw['Tiền vốn'] || null,
    hang_hoa_giu_ho_ban_ho: raw['Hàng hóa giữ hộ/bán hộ'] || null,
    imported_by: userId,
    imported_at: new Date().toISOString(),
  };
}
