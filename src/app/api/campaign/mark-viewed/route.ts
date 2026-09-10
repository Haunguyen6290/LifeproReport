import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAnon } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

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
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { campaign_id?: string };
  const campaign_id = String(body.campaign_id ?? '').trim();

  if (!campaign_id) {
    return NextResponse.json({ error: 'Thiếu campaign_id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('campaign_views').upsert(
    { user_id: user.id, campaign_id, last_viewed_at: new Date().toISOString() },
    { onConflict: 'user_id,campaign_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
