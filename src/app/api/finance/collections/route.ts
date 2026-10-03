import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('xem_tai_chinh') || perms.includes('quan_ly_cai_dat');
}

export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const thang = req.nextUrl.searchParams.get('thang');
  if (!thang || !/^\d{4}-\d{2}$/.test(thang)) return NextResponse.json({ error: 'Thiếu tháng (YYYY-MM)' }, { status: 400 });
  const db = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.rpc('finance_collections_report', { p_thang: thang });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as any);
}
