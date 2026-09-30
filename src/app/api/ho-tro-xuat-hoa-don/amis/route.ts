import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false };
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  const ok = perms.includes('quan_ly_cai_dat') || perms.includes('ke_toan') || perms.includes('xem_tai_chinh');
  return { ok, userId: u.user.id };
}

export async function GET(req: NextRequest) {
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const maKh = sp.get('ma_kh') || '';
  const tu = sp.get('tu') || '';
  const den = sp.get('den') || '';

  const db = admin();
  let query = db.from('amis_sales_rows').select('*').order('ngay_hach_toan', { ascending: false }).order('so_ct');

  if (maKh) query = query.eq('ma_kh', maKh);
  if (tu && /^\d{4}-\d{2}-\d{2}$/.test(tu)) query = query.gte('ngay_hach_toan', tu);
  if (den && /^\d{4}-\d{2}-\d{2}$/.test(den)) query = query.lte('ngay_hach_toan', den);

  const { data, error } = await query.limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lấy danh sách khách hàng unique
  const { data: customers } = await db.from('amis_sales_rows').select('ma_kh, ten_khach_hang').limit(1000);
  const khachMap = new Map<string, string>();
  for (const c of (customers ?? [])) {
    if (c.ma_kh && c.ten_khach_hang) {
      khachMap.set(c.ma_kh, c.ten_khach_hang);
    }
  }
  const khachList = Array.from(khachMap.entries()).map(([ma, ten]) => ({ ma_kh: ma, ten_khach_hang: ten })).sort((a, b) => a.ma_kh.localeCompare(b.ma_kh));

  return NextResponse.json({ rows: data ?? [], khach_list: khachList });
}
