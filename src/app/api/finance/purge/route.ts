import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await db().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat');
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'XOA CHUNG TU CU') return NextResponse.json({ error: 'Gõ đúng "XOA CHUNG TU CU" để xác nhận' }, { status: 400 });
  const d = db();
  const { data: s } = await d.from('settings').select('value').eq('key', 'DEBT_BASE_DATE').maybeSingle();
  const baseDate = (s as any)?.value;
  if (!baseDate) return NextResponse.json({ error: 'Chưa có ngày làm gốc — dồn mốc trước' }, { status: 400 });
  const { error, count } = await d.from('receivable_rows').delete({ count: 'exact' }).lt('ngay', baseDate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, daXoa: count ?? 0, baseDate });
}
