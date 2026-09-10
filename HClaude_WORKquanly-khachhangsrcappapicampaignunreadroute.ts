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

  const body = await req.json().catch(() => ({})) as { campaign_ids?: string[] };
  const campaign_ids = body.campaign_ids ?? [];

  if (!Array.isArray(campaign_ids) || campaign_ids.length === 0) {
    return NextResponse.json({});
  }

  const admin = createAdminClient();

  // Lấy last_viewed_at cho từng campaign
  const { data: views } = await admin
    .from('campaign_views')
    .select('campaign_id, last_viewed_at')
    .eq('user_id', user.id)
    .in('campaign_id', campaign_ids);

  const viewMap: Record<string, string> = {};
  for (const v of (views ?? []) as { campaign_id: string; last_viewed_at: string }[]) {
    viewMap[v.campaign_id] = v.last_viewed_at;
  }

  // Đếm updates + comments cho từng campaign (không đếm của chính mình)
  const result: Record<string, number> = {};

  for (const cid of campaign_ids) {
    const lastViewed = viewMap[cid] ?? '2000-01-01T00:00:00Z';

    // Đếm updates (không phải của mình)
    const { count: updatesCount } = await admin
      .from('campaign_updates')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', cid)
      .neq('reporter_id', user.id)
      .gt('created_at', lastViewed);

    // Đếm comments (không phải của mình)
    const { count: commentsCount } = await admin
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'campaign')
      .eq('target_id', cid)
      .neq('author_id', user.id)
      .gt('created_at', lastViewed);

    result[cid] = (updatesCount ?? 0) + (commentsCount ?? 0);
  }

  return NextResponse.json(result);
}
