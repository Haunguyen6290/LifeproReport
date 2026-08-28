import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const step = 1000;
    let offset = 0;
    const months = new Set<string>();
    const years = new Set<string>();
    const kd = new Set<string>();
    const vung = new Set<string>();
    const nhom = new Set<string>();
    const kh = new Set<string>();
    const sp = new Set<string>();
    let scanned = 0;
    while (true) {
      const { data, error } = await (admin.from('sales_rows').select('sale_month,ngay,kinh_doanh,vung,nhom_hang,ten_kh,ten_vt') as any).range(offset, offset + step - 1);
      if (error) {
        if (String(error.message).includes('not find') || String((error as any).code) === 'PGRST205') {
          return NextResponse.json({ months: [], years: [], kd: [], vung: [], nhom: [], kh: [], sp: [] });
        }
        throw error;
      }
      const chunk = (data ?? []) as { sale_month: string; ngay: string; kinh_doanh: string; vung: string; nhom_hang: string; ten_kh: string; ten_vt: string }[];
      if (chunk.length === 0) break;
      scanned += chunk.length;
      for (const r of chunk) {
        if (r.sale_month) months.add(r.sale_month);
        if (r.ngay) years.add(String(r.ngay).slice(0, 4));
        if (r.kinh_doanh) kd.add(r.kinh_doanh);
        if (r.vung) vung.add(r.vung);
        if (r.nhom_hang) nhom.add(r.nhom_hang);
        if (r.ten_kh) kh.add(r.ten_kh);
        if (r.ten_vt) sp.add(r.ten_vt);
      }
      if (chunk.length < step) break;
      offset += step;
      if (scanned > 200000) break; // safety cap
    }
    return NextResponse.json({
      months: [...months].sort().reverse(),
      years: [...years].sort().reverse(),
      kd: [...kd].sort(),
      vung: [...vung].sort(),
      nhom: [...nhom].sort(),
      kh: [...kh].sort(),
      sp: [...sp].sort(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi meta' }, { status: 500 });
  }
}
