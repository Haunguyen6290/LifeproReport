import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { guiGopY, boQua } from '@/lib/co-van/service';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function checkPerm(req: NextRequest): Promise<{ ok: boolean; userId: string | null }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false, userId: null };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false, userId: null };
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return { ok: perms.includes('quan_ly_cai_dat'), userId: u.user.id };
}

export async function POST(req: NextRequest) {
  const chk = await checkPerm(req);
  if (!chk.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  const action = String(body.action ?? 'gui').trim(); // gui | bo_qua
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });

  if (action === 'bo_qua' || action === 'boqua') {
    const r = await boQua(id, chk.userId!);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // action gui: cho phép sửa góp ý trước khi gửi
  const gopY = body.gop_y ?? body.gopY;
  if (gopY != null) {
    const admin = createAdminClient() as any;
    const text = String(gopY).trim();
    if (!text) return NextResponse.json({ error: 'Góp ý trống' }, { status: 400 });
    await admin.from('co_van_danh_gia').update({ gop_y_soan_san: text.slice(0, 4000) }).eq('id', id);
  }

  const r = await guiGopY(id, chk.userId!);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 500 });
  return NextResponse.json({ ok: true });
}
