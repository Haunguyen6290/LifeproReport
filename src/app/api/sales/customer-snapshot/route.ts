import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normMa } from '@/lib/norm-ma';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET ?ma_norm=abc&loai=year|quarter|month|debt&ky=2026|2026Q3|2026-09|debt
export async function GET(req: NextRequest) {
  const rawMa = String(req.nextUrl.searchParams.get('ma_norm') ?? '');
  const loai = String(req.nextUrl.searchParams.get('loai') ?? '').toLowerCase();
  const ky = String(req.nextUrl.searchParams.get('ky') ?? '');
  const ma = normMa(rawMa);
  if (!ma || !loai || !ky) return NextResponse.json({ data: null }, { status: 200 });
  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await (admin as any).rpc('fn_sales_customer_snapshot', {
      p_ma_norm: ma, p_loai: loai, p_ky: ky,
    });
    if (error) {
      const msg = String((error as any).message ?? '');
      if (msg.includes('not find') || String((error as any).code) === 'PGRST202' || String((error as any).code) === '42883') {
        return NextResponse.json({ data: null });
      }
      throw error;
    }
    // data = {data: jsonb, refreshed_at} | null
    if (!data || !(data as any).data) return NextResponse.json({ data: null });
    return NextResponse.json(data as any);
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? 'loi' });
  }
}
