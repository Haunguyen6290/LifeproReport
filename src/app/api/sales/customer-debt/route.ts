import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normMa } from '@/lib/norm-ma';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const adminC = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await adminC().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('bao_cao_ban_hang') || perms.includes('xem_tai_chinh') || perms.includes('quan_ly_cai_dat') || perms.includes('ke_toan');
}

// GET ?ma_norm=abc — công nợ hiện tại 1 khách = dư đầu kỳ + lũy kế (Nợ − Có).
export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const ma = normMa(String(req.nextUrl.searchParams.get('ma_norm') ?? ''));
  if (!ma) return NextResponse.json({ data: null });
  // ?den=YYYY-MM-DD — công nợ lũy kế đến hết ngày đó (Hỗ trợ xuất hóa đơn). Không có den = hiện tại.
  const den = String(req.nextUrl.searchParams.get('den') ?? '');
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(den);
  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = asOf
      ? await (admin as any).rpc('fn_customer_debt_as_of', { p_ma_norm: ma, p_den: den })
      : await (admin as any).rpc('fn_customer_debt', { p_ma_norm: ma });
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
