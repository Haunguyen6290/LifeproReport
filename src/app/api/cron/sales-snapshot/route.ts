import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const uc = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await uc.auth.getUser(token);
  if (!ud?.user) return false;
  const admin = createAdminClient();
  const { data: prof } = await admin.from('profiles').select('roles!inner(permissions)').eq('id', ud.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat') || perms.includes('quan_ly_nguoi_dung');
}

function vnTodayISO(d = new Date()): string {
  // Ngày theo Asia/Ho_Chi_Minh (UTC+7), không phụ thuộc TZ của server.
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
}

// GET: Vercel Cron (x-vercel-cron hoặc Authorization: Bearer CRON_SECRET) hoặc admin chạy tay (?date=YYYY-MM-DD).
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const cronOk = !!(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const vercelCron = req.headers.get('x-vercel-cron') === '1';
  if (!cronOk && !vercelCron) {
    if (!(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const qp = req.nextUrl.searchParams.get('date');
  const asOf = qp && /^\d{4}-\d{2}-\d{2}$/.test(qp) ? qp : vnTodayISO(new Date());

  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } }) as any;
    const { data, error } = await admin.rpc('fn_refresh_sales_snapshots', { p_as_of: asOf });
    if (error) {
      const code = String((error as any).code ?? '');
      const msg = String((error as any).message ?? error);
      if (code === 'PGRST202' || code === '42883' || msg.includes('not find') || msg.includes('does not exist')) {
        return NextResponse.json({ ok: false, as_of: asOf, error: 'DB chưa chạy migration 0051_sales_cust_snapshots.sql — chạy trong Supabase SQL Editor rồi gọi lại.', code }, { status: 200 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true, as_of: asOf, result: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, as_of: asOf, error: e?.message ?? 'Lỗi cron' }, { status: 500 });
  }
}
