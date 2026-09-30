import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false };
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  const ok = perms.includes('xem_box') || perms.includes('quan_ly_cai_dat');
  return { ok, userId: u.user.id };
}

export async function GET(req: NextRequest) {
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const db = admin();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Chạy các query count song song để giảm latency
  const [
    { count: total },
    { count: activated },
    { count: newToday },
    { count: active7days },
    { data: recentBoxes },
    { data: allBoxes },
  ] = await Promise.all([
    db.from('boxes').select('*', { count: 'exact', head: true }),
    db.from('boxes').select('*', { count: 'exact', head: true }).eq('is_activated', true),
    db.from('boxes').select('*', { count: 'exact', head: true })
      .gte('first_seen_at', `${today}T00:00:00Z`)
      .lte('first_seen_at', `${today}T23:59:59Z`),
    db.from('boxes').select('*', { count: 'exact', head: true })
      .gte('last_seen_at', sevenDaysAgo),
    db.from('boxes').select('first_seen_at')
      .gte('first_seen_at', sevenDaysAgo)
      .order('first_seen_at', { ascending: true }),
    db.from('boxes').select('device_model, android_version').limit(10000),
  ]);

  const notActivated = (total ?? 0) - (activated ?? 0);

  // Biểu đồ: Box mới mỗi ngày (7 ngày gần nhất)
  const chartData: Record<string, number> = {};
  (recentBoxes ?? []).forEach((box: any) => {
    const date = box.first_seen_at.slice(0, 10);
    chartData[date] = (chartData[date] ?? 0) + 1;
  });

  // Phân bố theo model - GIỚI HẠN để tránh OOM
  // Với số lượng lớn (>10k boxes) nên dùng RPC aggregation thay vì fetch all
  const modelCount: Record<string, number> = {};
  const androidCount: Record<string, number> = {};

  (allBoxes ?? []).forEach((box: any) => {
    modelCount[box.device_model] = (modelCount[box.device_model] ?? 0) + 1;
    androidCount[box.android_version] = (androidCount[box.android_version] ?? 0) + 1;
  });

  return NextResponse.json({
    total: total ?? 0,
    activated: activated ?? 0,
    notActivated,
    activatedPercent: total ? ((activated ?? 0) / total * 100).toFixed(1) : '0',
    newToday: newToday ?? 0,
    active7days: active7days ?? 0,
    chartData,
    modelCount,
    androidCount,
    _note: allBoxes && allBoxes.length >= 10000 ? 'Stats limited to 10k boxes' : undefined,
  });
}
