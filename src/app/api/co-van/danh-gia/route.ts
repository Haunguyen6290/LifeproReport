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

export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const admin = createAdminClient() as any;
  const sp = req.nextUrl.searchParams;
  const trangThai = sp.get('trang_thai') ?? sp.get('trangThai') ?? '';
  const tuanTu = sp.get('tuan_tu') ?? '';
  const loai = sp.get('loai') ?? '';
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10) || 50));

  let q = admin.from('co_van_danh_gia').select('*').order('tuan_tu', { ascending: false }).limit(limit);
  if (trangThai) q = q.eq('trang_thai', trangThai);
  if (loai) q = q.eq('loai', loai);
  if (tuanTu) q = q.eq('tuan_tu', tuanTu);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Kèm tên nhân viên
  const uids = [...new Set(((data ?? []) as any[]).map((r) => r.user_id).filter(Boolean))];
  const nameById = new Map<string, string>();
  if (uids.length) {
    const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', uids);
    for (const p of (profs ?? []) as any[]) nameById.set(p.id, p.full_name ?? '');
  }

  const rows = ((data ?? []) as any[]).map((r) => ({ ...r, ten_nhan_vien: nameById.get(r.user_id) ?? '' }));
  return NextResponse.json({ rows });
}
