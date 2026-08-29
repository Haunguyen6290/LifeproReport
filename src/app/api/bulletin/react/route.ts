import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnon } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return null;
  const uc = createAnon(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await uc.auth.getUser(token);
  return data?.user ?? null;
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Phiên hết hạn' }, { status: 401 });
  const body = await req.json() as { post_id?: string; kind?: string };
  const post_id = String(body.post_id ?? '').trim();
  const kind = String(body.kind ?? '').trim() as 'like' | 'love' | 'haha' | 'angry';
  if (!post_id || !['like','love','haha','angry'].includes(kind)) return NextResponse.json({ error: 'Thiếu post_id/kind' }, { status: 400 });
  const admin = createAdminClient();

  // Nếu đã có reaction cùng post+user
  const { data: existing } = await admin.from('bulletin_reactions').select('id, kind').eq('post_id', post_id).eq('user_id', user.id).maybeSingle();
  if (existing) {
    if ((existing as any).kind === kind) {
      await admin.from('bulletin_reactions').delete().eq('id', (existing as any).id);
      return NextResponse.json({ ok: true, action: 'removed' });
    }
    await admin.from('bulletin_reactions').update({ kind }).eq('id', (existing as any).id);
    return NextResponse.json({ ok: true, action: 'updated' });
  }
  const { error } = await admin.from('bulletin_reactions').insert({ post_id, user_id: user.id, kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: 'added' });
}
