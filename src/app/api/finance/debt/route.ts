import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const thang = req.nextUrl.searchParams.get('thang');
  const den = req.nextUrl.searchParams.get('den');
  if (!thang || !/^\d{4}-\d{2}$/.test(thang)) return NextResponse.json({ error: 'Thiếu tháng (YYYY-MM)' }, { status: 400 });
  const db = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: s } = await db.from('settings').select('value').eq('key', 'DEBT_GRACE_DAYS').maybeSingle();
  const han = Number((s as any)?.value ?? 90) || 90;
  const args: any = { p_thang: thang, p_han: han };
  if (den && /^\d{4}-\d{2}-\d{2}$/.test(den)) args.p_den = den;
  const { data, error } = await db.rpc('finance_debt_report', args);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Gộp "Công nợ hiện tại" lũy kế (0053) vào từng dòng — không phụ thuộc cửa sổ quá hạn.
  let cur = new Map<string, number>();
  const key = (t: any) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/gi, '');
  try {
    const { data: dc } = await (db as any).rpc('fn_debt_current_all');
    if (Array.isArray(dc)) {
      for (const x of dc as any[]) cur.set(key(x.ma_norm), Number(x.con_thieu ?? 0));
    }
  } catch {}
  const rows = Array.isArray((data as any)?.rows)
    ? (data as any).rows.map((r: any) => ({ ...r, con_no_hien_tai: cur.get(key(r.ma_kh)) ?? null }))
    : (data as any)?.rows;
  return NextResponse.json({ han, ...(data as any), rows });
}
