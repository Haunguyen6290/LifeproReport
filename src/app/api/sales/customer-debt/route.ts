import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normMa } from '@/lib/norm-ma';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET ?ma_norm=abc — công nợ hiện tại 1 khách = dư đầu kỳ + lũy kế (Nợ − Có).
export async function GET(req: NextRequest) {
  const ma = normMa(String(req.nextUrl.searchParams.get('ma_norm') ?? ''));
  if (!ma) return NextResponse.json({ data: null });
  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await (admin as any).rpc('fn_customer_debt', { p_ma_norm: ma });
    if (error) {
      const msg = String((error as any).message ?? '');
      if (msg.includes('not find') || String((error as any).code) === 'PGRST202' || String((error as any).code) === '42883') {
        return NextResponse.json({ data: null });
      }
      throw error;
    }
    return NextResponse.json({ data: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? 'loi' });
  }
}
