import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('xem_tai_chinh') || perms.includes('quan_ly_cai_dat');
}

type Row = { ngay: string; so_ct: string; dien_giai: string; tk_doi_ung: string; so_no: number; so_co: number };
type Item = { ngay: string; so_ct: string; dien_giai: string; tien: number };

export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const ma = req.nextUrl.searchParams.get('ma_kh') ?? '';
  const tu = req.nextUrl.searchParams.get('tu') ?? '';
  const den = req.nextUrl.searchParams.get('den') ?? '';
  if (!ma || !/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den)) {
    return NextResponse.json({ error: 'Thiếu tham số hoặc định dạng sai' }, { status: 400 });
  }

  const db = admin();

  // Nợ đầu kỳ
  const { data: cb } = await db.from('customer_base_balance').select('du_no,ngay_moc').eq('ma_kh', ma).single();
  const dauKy = Number(cb?.du_no ?? 0);
  const moc = cb?.ngay_moc ?? '2026-01-01';

  // Phát sinh trước đầu kỳ báo cáo (để tính nợ đầu kỳ báo cáo)
  const { data: truoc } = await db.from('receivable_rows').select('so_no,so_co').eq('ma_kh', ma).gte('ngay', moc).lt('ngay', tu).limit(1000);
  const phatSinhTruoc = (truoc ?? []).reduce((s, r: any) => s + Number(r.so_no) - Number(r.so_co), 0);
  const dauKyBaoCao = dauKy + phatSinhTruoc;

  // Dòng phát sinh trong kỳ
  const { data: rows } = await db.from('receivable_rows').select('ngay,so_ct,dien_giai,tk_doi_ung,so_no,so_co').eq('ma_kh', ma).gte('ngay', tu).lte('ngay', den).order('ngay').limit(1000);

  const muaHang: Item[] = [];
  const traHang: Item[] = [];
  const traTien: Item[] = [];
  const khauTru: Item[] = [];
  const all: Row[] = [];

  for (const r of (rows ?? []) as any[]) {
    const row: Row = { ngay: r.ngay, so_ct: r.so_ct ?? '', dien_giai: r.dien_giai ?? '', tk_doi_ung: r.tk_doi_ung ?? '', so_no: Number(r.so_no ?? 0), so_co: Number(r.so_co ?? 0) };
    all.push(row);

    if (row.so_no > 0 && /^511/.test(row.tk_doi_ung)) {
      muaHang.push({ ngay: row.ngay, so_ct: row.so_ct, dien_giai: row.dien_giai || 'Bán hàng', tien: row.so_no });
    } else if (row.so_no > 0 && /^512/.test(row.tk_doi_ung)) {
      traHang.push({ ngay: row.ngay, so_ct: row.so_ct, dien_giai: row.dien_giai || 'Trả hàng', tien: row.so_no });
    } else if (row.so_co > 0 && /^642/.test(row.tk_doi_ung)) {
      khauTru.push({ ngay: row.ngay, so_ct: row.so_ct, dien_giai: row.dien_giai || 'Khấu trừ chi phí', tien: row.so_co });
    } else if (row.so_co > 0) {
      traTien.push({ ngay: row.ngay, so_ct: row.so_ct, dien_giai: row.dien_giai || 'Thu tiền', tien: row.so_co });
    }
  }

  // Phát hiện điều chỉnh: cùng ngày + cùng số tiền + ngược chiều
  const dieuChinh: Item[] = [];
  const used = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const a = all[i];
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      const b = all[j];
      if (a.ngay === b.ngay && Math.abs(a.so_no - b.so_co) < 1 && Math.abs(a.so_co - b.so_no) < 1 && (a.so_no > 0 || a.so_co > 0)) {
        dieuChinh.push({ ngay: a.ngay, so_ct: a.so_ct || b.so_ct, dien_giai: a.dien_giai || b.dien_giai || 'Điều chỉnh sổ', tien: 0 });
        used.add(i); used.add(j);
        break;
      }
    }
  }

  const tongMua = muaHang.reduce((s, x) => s + x.tien, 0);
  const tongTra = traTien.reduce((s, x) => s + x.tien, 0);
  const tongKhau = khauTru.reduce((s, x) => s + x.tien, 0);
  const tongTraHang = traHang.reduce((s, x) => s + x.tien, 0);
  const cuoiKy = dauKyBaoCao + tongMua - tongTra - tongKhau - tongTraHang;

  return NextResponse.json({
    dau_ky: dauKyBaoCao,
    mua_hang: muaHang.slice(0, 100),
    tra_hang: traHang.slice(0, 100),
    tra_tien: traTien.slice(0, 100),
    khau_tru: khauTru.slice(0, 100),
    dieu_chinh: dieuChinh.slice(0, 100),
    cuoi_ky: cuoiKy,
  });
}
