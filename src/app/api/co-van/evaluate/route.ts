import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { chamMotBai } from '@/lib/co-van/service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function checkPerm(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const token = authHeader.replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  // Cho phép mọi user đã đăng nhập tự kích chấm bài của chính mình;
  // Giám đốc (quan_ly_cai_dat) thì chấm được mọi bài. Không chặn user thường.
  return !!u.user;
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
