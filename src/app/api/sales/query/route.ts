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

    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const rows = await fetchAllRows(admin, from, to);

    const filtered = rows.filter((r) => {
      if (selKd.length && !selKd.includes(r.kinh_doanh)) return false;
      if (selVung.length && !selVung.includes(r.vung)) return false;
      if (selNhom.length && !selNhom.includes(r.nhom_hang)) return false;
      if (selKh.length && !selKh.includes(r.ten_kh)) return false;
      return true;
    });

    const kdOpts = [...new Set(filtered.map((r) => r.kinh_doanh).filter(Boolean))].sort();
    const vungOpts = [...new Set(filtered.map((r) => r.vung).filter(Boolean))].sort();
    const nhomOpts = [...new Set(filtered.map((r) => r.nhom_hang).filter(Boolean))].sort();
    const khOpts = [...new Set(filtered.map((r) => r.ten_kh).filter(Boolean))].sort();

    const total = filtered.reduce((s, r) => s + Number(r.thanh_tien ?? 0), 0);
    const count = filtered.length;

    const kdMap = new Map<string, number>();
    for (const r of filtered) kdMap.set(r.kinh_doanh || '(trống)', (kdMap.get(r.kinh_doanh || '(trống)') ?? 0) + Number(r.thanh_tien ?? 0));
    const byKd = [...kdMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    const vungMap = new Map<string, number>();
    for (const r of filtered) vungMap.set(r.vung || '(không rõ)', (vungMap.get(r.vung || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
    const byVung = [...vungMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    const nhomMap = new Map<string, number>();
    for (const r of filtered) nhomMap.set(r.nhom_hang || '(không rõ)', (nhomMap.get(r.nhom_hang || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
    const byNhom = [...nhomMap.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    const khMap = new Map<string, number>();
    for (const r of filtered) khMap.set(r.ten_kh || r.ma_kh || '(không rõ)', (khMap.get(r.ten_kh || r.ma_kh || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
    const byKh = [...khMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));

    const spMap = new Map<string, { total: number; count: number }>();
    for (const r of filtered) {
      const k = r.ten_vt || r.ma_vt || '(không rõ)';
      const cur = spMap.get(k) ?? { total: 0, count: 0 };
      cur.total += Number(r.thanh_tien ?? 0);
      cur.count += 1;
      spMap.set(k, cur);
    }
    const topSp = [...spMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10).map(([label, v]) => ({ label, total: v.total, count: v.count }));

    return NextResponse.json({
      total, count,
      byKd, byVung, byNhom, byKh, topSp,
      options: { kd: kdOpts, vung: vungOpts, nhom: nhomOpts, kh: khOpts },
      meta: { scanned: rows.length, filtered: filtered.length },
    });
  } catch (e: any) {
    if (e?.message === 'TABLE_MISSING') {
      return NextResponse.json({ error: 'Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase SQL Editor.' }, { status: 500 });
    }
    return NextResponse.json({ error: e?.message ?? 'Lỗi query' }, { status: 500 });
  }
}
