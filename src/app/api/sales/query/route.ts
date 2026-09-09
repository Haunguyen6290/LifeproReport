import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fetchAllRows(admin: any, from: string, to: string) {
  const step = 1000;
  const out: Record<string, any>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await (admin.from('sales_rows').select('*').gte('ngay', from).lte('ngay', to).order('ngay', { ascending: true }) as any).range(offset, offset + step - 1);
    if (error) {
      if (String(error.message).includes('not find') || String((error as any).code) === 'PGRST205') throw new Error('TABLE_MISSING');
      throw error;
    }
    const chunk = (data ?? []) as Record<string, any>[];
    if (chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < step) break;
    offset += step;
    if (out.length > 500000) break; // safety cap
  }
  return out;
}

/** Nhãn sản phẩm chuẩn: "[MÃ] Tên" (Tên đã bỏ phần [MÃ] lặp đầu nếu có). */
function spLabel(maVt: unknown, tenVt: unknown): string {
  const code = String(maVt ?? '').trim();
  const name = String(tenVt ?? '').replace(/^\s*\[[^\]]*\]\s*/, '').trim();
  if (code) return name ? `[${code}] ${name}` : code;
  return name;
}

/** Fallback: kéo hết dòng về rồi tính ở Node — chỉ dùng khi hàm SQL sales_report chưa tồn tại. */
async function nodeFallback(admin: any, from: string, to: string, selKd: string[], selVung: string[], selNhom: string[], selKh: string[], selSp: string[]) {
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
    if (selSp.length && !(selSp.includes(String(r.ten_vt ?? '')) || selSp.includes(String(r.ma_vt ?? '')) || selSp.includes(spLabel(r.ma_vt, r.ten_vt)))) return false;
    return true;
  });

  const kdOpts = [...new Set(rows.map((r) => r.kinh_doanh).filter(Boolean))].sort();
  const vungOpts = [...new Set(rows.map((r) => r.vung).filter(Boolean))].sort();
  const nhomOpts = [...new Set(rows.map((r) => r.nhom_hang).filter(Boolean))].sort();
  const khOpts = [...new Set(rows.map((r) => r.ten_kh).filter(Boolean))].sort();
  const spOpts = [...new Set(rows.map((r) => spLabel(r.ma_vt, r.ten_vt)).filter(Boolean))].sort();

  const total = filtered.reduce((s, r) => s + Number(r.thanh_tien ?? 0), 0);
  const totalQty = filtered.reduce((s, r) => s + Number(r.so_luong ?? 0), 0);
  const count = filtered.length;
  const soHoaDon = new Set(filtered.map((r) => String(r.so_ct ?? '').trim()).filter(Boolean)).size;
  const soKhachHang = new Set(filtered.map((r) => String(r.ma_kh ?? '').trim()).filter(Boolean)).size;
  const avgValue = soHoaDon > 0 ? total / soHoaDon : 0;

  const kdMap = new Map<string, number>();
  for (const r of filtered) kdMap.set(r.kinh_doanh || '(trống)', (kdMap.get(r.kinh_doanh || '(trống)') ?? 0) + Number(r.thanh_tien ?? 0));
  const byKd = [...kdMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const vungMap = new Map<string, number>();
  for (const r of filtered) vungMap.set(r.vung || '(không rõ)', (vungMap.get(r.vung || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
  const byVung = [...vungMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const nhomMap = new Map<string, number>();
  for (const r of filtered) nhomMap.set(r.nhom_hang || '(không rõ)', (nhomMap.get(r.nhom_hang || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
  const byNhom = [...nhomMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const hangMap = new Map<string, number>();
  for (const r of filtered) hangMap.set(r.hang_sx || '(không rõ)', (hangMap.get(r.hang_sx || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
  const byHang = [...hangMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const khMap = new Map<string, number>();
  for (const r of filtered) khMap.set(r.ten_kh || r.ma_kh || '(không rõ)', (khMap.get(r.ten_kh || r.ma_kh || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
  const byKh = [...khMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const monthMap = new Map<string, { dt: number; hd: Set<string> }>();
  for (const r of filtered) {
    const m = String(r.sale_month ?? '');
    if (!m) continue;
    const cur = monthMap.get(m) ?? { dt: 0, hd: new Set<string>() };
    cur.dt += Number(r.thanh_tien ?? 0);
    const sc = String(r.so_ct ?? '').trim();
    if (sc) cur.hd.add(sc);
    monthMap.set(m, cur);
  }
  const byMonth = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({ m, dt: v.dt, hd: v.hd.size }));

  const spMap = new Map<string, { total: number; qty: number; count: number; label: string }>();
  for (const r of filtered) {
    const key = String(r.ma_vt ?? '').trim() || String(r.ten_vt ?? '').trim() || '(không rõ)';
    const lab = String(r.ma_vt ?? '').trim() ? spLabel(r.ma_vt, r.ten_vt) : String(r.ten_vt ?? '').replace(/^\s*\[[^\]]*\]\s*/, '').trim() || key;
    const cur = spMap.get(key) ?? { total: 0, qty: 0, count: 0, label: lab };
    cur.total += Number(r.thanh_tien ?? 0);
    cur.qty += Number(r.so_luong ?? 0);
    cur.count += 1;
    spMap.set(key, cur);
  }
  const topSp = [...spMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 15).map(([, v]) => ({ label: v.label, total: v.total, qty: v.qty, count: v.count }));
  const topSpQty = [...spMap.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 15).map(([, v]) => ({ label: v.label, total: v.total, qty: v.qty, count: v.count }));

  // Pivot Nhom hang x Thang (khop nhomMonth cua ham SQL; frontend dung bang, tu gop quy khi ky dai)
  const SEP = "";
  const nmMap = new Map();
  for (const r of filtered) {
    const nh = String(r.nhom_hang || "(khong ro)");
    const m = String(r.sale_month || "");
    if (!m) continue;
    const key = nh + SEP + m;
    nmMap.set(key, (nmMap.get(key) ?? 0) + Number(r.thanh_tien ?? 0));
  }
  const nhomMonth = [...nmMap.entries()].map(([k, value]) => {
    const i = k.indexOf(SEP);
    return { nhom: k.slice(0, i), m: k.slice(i + 1), value };
  });

  return {
    total, totalQty, count, soHoaDon, soKhachHang, avgValue,
    byKd, byVung, byNhom, byHang, byKh, byMonth, nhomMonth, topSp, topSpQty,
    options: { kd: kdOpts, vung: vungOpts, nhom: nhomOpts, kh: khOpts, sp: spOpts },
    meta: { scanned: rows.length, filtered: filtered.length, engine: 'node' },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const from = String(body.from ?? '');
    const to = String(body.to ?? '');
    if (!from || !to) return NextResponse.json({ error: 'Thiếu from/to' }, { status: 400 });
    const selKd: string[] = Array.isArray(body.kd) ? body.kd : [];
    const selVung: string[] = Array.isArray(body.vung) ? body.vung : [];
    const selNhom: string[] = Array.isArray(body.nhom) ? body.nhom : [];
    const selKh: string[] = Array.isArray(body.kh) ? body.kh : [];
    const selSp: string[] = Array.isArray(body.sp) ? body.sp : [];

    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

    // Ưu tiên hàm SQL (DB tự tính — nhanh, chịu tải). Nếu chưa chạy migration 0020 thì fallback Node.
    try {
      const { data, error } = await admin.rpc('sales_report', {
        p_from: from, p_to: to,
        p_kd: selKd.length ? selKd : null,
        p_vung: selVung.length ? selVung : null,
        p_nhom: selNhom.length ? selNhom : null,
        p_kh: selKh.length ? selKh : null,
        p_sp: selSp.length ? selSp : null,
      });
      if (!error && data) {
        return NextResponse.json({ ...(data as any), meta: { ...(data as any).meta, engine: 'sql' } });
      }
      // hàm chưa tồn tại (PGRST202) -> fallback
      if (error && String((error as any).code) !== 'PGRST202') throw error;
    } catch (rpcErr: any) {
      if (String(rpcErr?.code) !== 'PGRST202' && String(rpcErr?.message ?? '').includes('not find') === false && String(rpcErr?.code) !== '42883') {
        // lỗi khác không phải "hàm chưa có" -> vẫn thử fallback Node cho an toàn
      }
    }

    const result = await nodeFallback(admin, from, to, selKd, selVung, selNhom, selKh, selSp);
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === 'TABLE_MISSING') {
      return NextResponse.json({ error: 'Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase SQL Editor.' }, { status: 500 });
    }
    return NextResponse.json({ error: e?.message ?? 'Lỗi query' }, { status: 500 });
  }
}
