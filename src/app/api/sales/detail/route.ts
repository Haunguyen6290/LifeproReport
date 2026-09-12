import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normMa } from '@/lib/norm-ma';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Nhãn sản phẩm chuẩn: "[MÃ] Tên" (Tên đã bỏ phần [MÃ] lặp đầu nếu có). */
function spLabel(maVt: unknown, tenVt: unknown): string {
  const code = String(maVt ?? '').trim();
  const name = String(tenVt ?? '').replace(/^\s*\[[^\]]*\]\s*/, '').trim();
  if (code) return name ? `[${code}] ${name}` : code;
  return name;
}

async function fetchAllRows(admin: any, from: string, to: string) {
  const step = 1000;
  const out: Record<string, any>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await (admin.from('sales_rows').select('*').gte('ngay', from).lte('ngay', to).order('ngay', { ascending: false }).order('created_at', { ascending: false }) as any).range(offset, offset + step - 1);
    if (error) {
      if (String(error.message).includes('not find') || String((error as any).code) === 'PGRST205') throw new Error('TABLE_MISSING');
      throw error;
    }
    const chunk = (data ?? []) as Record<string, any>[];
    if (chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < step) break;
    offset += step;
    if (out.length > 500000) break;
  }
  return out;
}

/** Fallback Node — chỉ dùng khi hàm SQL sales_detail chưa tồn tại. */
async function nodeFallback(admin: any, from: string, to: string, selKd: string[], selVung: string[], selNhom: string[], selKh: string[], selSp: string[], search: string, page: number, limit: number, selMaNorm: string[]) {
  const rows = await fetchAllRows(admin, from, to);
  try {
    const { data: custs } = await admin.from('customers').select('ma_kh, tinh_thanh').limit(20000);
    const custTinh = new Map<string, string>();
    for (const c of (custs ?? []) as { ma_kh: string; tinh_thanh: string | null }[]) {
      const ma = String(c.ma_kh ?? '').trim();
      const tinh = String(c.tinh_thanh ?? '').trim();
      if (ma && tinh) custTinh.set(ma, tinh);
    }
    for (const r of rows) {
      const ma = String(r.ma_kh ?? '').trim();
      if (ma && custTinh.has(ma)) r.vung = custTinh.get(ma)!;
    }
  } catch {}

  const filtered = rows.filter((r) => {
    if (selKd.length && !selKd.includes(r.kinh_doanh)) return false;
    if (selVung.length && !selVung.includes(r.vung)) return false;
    if (selNhom.length && !selNhom.includes(r.nhom_hang)) return false;
    if (selKh.length && !selKh.includes(r.ten_kh)) return false;
    if (selMaNorm.length && !selMaNorm.includes(normMa(r.ma_kh))) return false;
    if (selSp.length && !(selSp.includes(String(r.ten_vt ?? '')) || selSp.includes(String(r.ma_vt ?? '')) || selSp.includes(spLabel(r.ma_vt, r.ten_vt)))) return false;
    if (search) {
      const hay = `${r.ten_kh ?? ''} ${r.ma_kh ?? ''} ${r.ten_vt ?? ''} ${r.ma_vt ?? ''} ${r.kinh_doanh ?? ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const pageRows = filtered.slice(start, start + limit).map((r) => ({
    ngay: r.ngay, so_ct: r.so_ct, ma_vt: r.ma_vt, ten_vt: spLabel(r.ma_vt, r.ten_vt),
    ma_kh: r.ma_kh, ten_kh: r.ten_kh, kinh_doanh: r.kinh_doanh,
    so_luong: Number(r.so_luong ?? 0), thanh_tien: Number(r.thanh_tien ?? 0),
    vung: r.vung, nhom_hang: r.nhom_hang,
  }));
  return { rows: pageRows, total, page, limit, hasMore: start + limit < total, engine: 'node' };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const from = String(body.from ?? '');
    const to = String(body.to ?? '');
    if (!from || !to) return NextResponse.json({ error: 'Thiếu from/to' }, { status: 400 });
    const page = Math.max(1, Number(body.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(body.limit ?? 20)));
    const selKd: string[] = Array.isArray(body.kd) ? body.kd : [];
    const selVung: string[] = Array.isArray(body.vung) ? body.vung : [];
    const selNhom: string[] = Array.isArray(body.nhom) ? body.nhom : [];
    const selKh: string[] = Array.isArray(body.kh) ? body.kh : [];
    const selSp: string[] = Array.isArray(body.sp) ? body.sp : [];
    const search = String(body.search ?? '').trim();
    const maNorm: string[] = Array.isArray(body.ma_kh_norm)
      ? body.ma_kh_norm.map((s: unknown) => normMa(s)).filter(Boolean)
      : [];

    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

    // Ưu tiên hàm SQL (DB tự lọc + phân trang). Nếu chưa chạy migration 0020 thì fallback Node.
    try {
      const { data, error } = await admin.rpc('sales_detail', {
        p_from: from, p_to: to,
        p_kd: selKd.length ? selKd : null,
        p_vung: selVung.length ? selVung : null,
        p_nhom: selNhom.length ? selNhom : null,
        p_kh: selKh.length ? selKh : null,
        p_sp: selSp.length ? selSp : null,
        p_search: search || null,
        p_page: page, p_limit: limit,
        p_ma_kh_norm: maNorm.length ? maNorm : null,
      });
      if (!error && data) {
        return NextResponse.json({ ...(data as any), page, limit });
      }
      if (error && String((error as any).code) !== 'PGRST202' && String((error as any).code) !== '42883') throw error;
    } catch (rpcErr: any) {
      if (String(rpcErr?.code) !== 'PGRST202' && String(rpcErr?.code) !== '42883') {
        // lỗi khác -> vẫn thử fallback Node
      }
    }

    const result = await nodeFallback(admin, from, to, selKd, selVung, selNhom, selKh, selSp, search.toLowerCase(), page, limit, maNorm);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === 'TABLE_MISSING') {
      return NextResponse.json({ error: 'Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase SQL Editor.' }, { status: 500 });
    }
    return NextResponse.json({ error: e?.message ?? 'Lỗi detail' }, { status: 500 });
  }
}
