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

function errorMessage(e: any): string { return e?.message ?? String(e); }

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  const admin = createAdminClient();

  // Badge Thông báo (bulletin)
  const { data: views } = await admin.from('badge_views').select('kind, last_viewed_at').eq('user_id', user.id);
  const byKind: Record<string, string> = {};
  for (const v of (views ?? []) as { kind: string; last_viewed_at: string }[]) byKind[v.kind] = v.last_viewed_at;
  const bBulletin = byKind['bulletin'] ?? '2000-01-01T00:00:00Z';

  const bulletinCnt = await admin.from('bulletin_posts').select('id', { count: 'exact', head: true }).gt('created_at', bBulletin);

  // Badge Chiến dịch: đếm tổng updates + comments chưa đọc của tất cả chiến dịch
  // Lấy danh sách campaign_id và last_viewed_at
  const { data: allCamps } = await admin.from('campaigns').select('id');
  const campIds = (allCamps ?? []).map((c: any) => c.id);

  let totalUnread = 0;
  if (campIds.length > 0) {
    const { data: campViews } = await admin.from('campaign_views').select('campaign_id, last_viewed_at').eq('user_id', user.id).in('campaign_id', campIds);
    const viewMap: Record<string, string> = {};
    for (const v of (campViews ?? []) as { campaign_id: string; last_viewed_at: string }[]) {
      viewMap[v.campaign_id] = v.last_viewed_at;
    }

    for (const cid of campIds) {
      const lastViewed = viewMap[cid] ?? '2000-01-01T00:00:00Z';
      const [updCnt, cmtCnt] = await Promise.all([
        admin.from('campaign_updates').select('id', { count: 'exact', head: true }).eq('campaign_id', cid).neq('reporter_id', user.id).gt('created_at', lastViewed),
        admin.from('comments').select('id', { count: 'exact', head: true }).eq('target_type', 'campaign').eq('target_id', cid).neq('author_id', user.id).gt('created_at', lastViewed),
      ]);
      totalUnread += ((updCnt as any)?.count ?? 0) + ((cmtCnt as any)?.count ?? 0);
    }
  }

  return NextResponse.json({
    bulletin: (bulletinCnt as any)?.count ?? 0,
    campaign: totalUnread,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { kind?: string };
  const kind = String(body.kind ?? '').trim();
  if (!['bulletin', 'campaign'].includes(kind)) return NextResponse.json({ error: 'kind phải là bulletin hoặc campaign' }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from('badge_views').upsert({ user_id: user.id, kind, last_viewed_at: new Date().toISOString() }, { onConflict: 'user_id,kind' });
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
