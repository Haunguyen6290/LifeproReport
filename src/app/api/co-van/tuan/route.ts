import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat');
}

// GET /api/co-van/tuan?loai=ke_hoach|bao_cao — danh sách tuần có bài
export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const loai = req.nextUrl.searchParams.get('loai') ?? '';
  const admin = createAdminClient() as any;
  const table = loai === 'bao_cao' ? 'weekly_reports' : 'weekly_plans';
  const { data, error } = await admin.from(table).select('tuan_tu').order('tuan_tu', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tuans = [...new Set(((data ?? []) as any[]).map((r) => r.tuan_tu).filter(Boolean))].sort().reverse();
  return NextResponse.json({ tuans });
}
