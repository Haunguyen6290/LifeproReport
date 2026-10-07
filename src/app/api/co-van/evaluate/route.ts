import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { chamMotBai } from '@/lib/co-van/service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function checkPerm(req: NextRequest): Promise<boolean> {
  // Cho phép cron (CRON_SECRET) hoặc user có quan_ly_cai_dat
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const token = authHeader.replace(/^Bearer /i, '').trim();
  if (!token) {
    // Thử lấy từ body nếu là internal call không có header (fallback)
    return false;
  }
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat');
}

export async function POST(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const loai = String(body.loai ?? '').trim() as 'ke_hoach' | 'bao_cao';
  const targetId = String(body.targetId ?? body.target_id ?? '').trim();
  if (loai !== 'ke_hoach' && loai !== 'bao_cao') return NextResponse.json({ error: 'loai phải là ke_hoach hoặc bao_cao' }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: 'Thiếu targetId' }, { status: 400 });
  const result = await chamMotBai(loai, targetId);
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 500 });
  return NextResponse.json({ ok: true, ket_qua: result.ket_qua, reason: result.reason });
}
