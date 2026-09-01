import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const thang = req.nextUrl.searchParams.get('thang');
  if (!thang || !/^\d{4}-\d{2}$/.test(thang)) return NextResponse.json({ error: 'Thiếu tháng (YYYY-MM)' }, { status: 400 });
  const db = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: s } = await db.from('settings').select('value').eq('key', 'DEBT_GRACE_DAYS').maybeSingle();
  const han = Number((s as any)?.value ?? 90) || 90;
  const { data, error } = await db.rpc('finance_debt_report', { p_thang: thang, p_han: han });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ han, ...(data as any) });
}
