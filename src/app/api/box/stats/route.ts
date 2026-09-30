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

  // Tổng số box
  const { count: total } = await db.from('boxes').select('*', { count: 'exact', head: true });

  // Đã kích hoạt
  const { count: activated } = await db.from('boxes').select('*', { count: 'exact', head: true }).eq('is_activated', true);

  // Chưa kích hoạt
  const notActivated = (total ?? 0) - (activated ?? 0);

  // Box mới hôm nay
  const today = new Date().toISOString().slice(0, 10);
  const { count: newToday } = await db
    .from('boxes')
    .select('*', { count: 'exact', head: true })
    .gte('first_seen_at', `${today}T00:00:00Z`)
    .lte('first_seen_at', `${today}T23:59:59Z`);

  // Box hoạt động 7 ngày qua
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: active7days } = await db
    .from('boxes')
    .select('*', { count: 'exact', head: true })
    .gte('last_seen_at', sevenDaysAgo);

  // Biểu đồ: Box mới mỗi ngày (7 ngày gần nhất)
  const { data: recentBoxes } = await db
    .from('boxes')
    .select('first_seen_at')
    .gte('first_seen_at', sevenDaysAgo)
    .order('first_seen_at', { ascending: true });

  const chartData: Record<string, number> = {};
  (recentBoxes ?? []).forEach((box: any) => {
    const date = box.first_seen_at.slice(0, 10);
    chartData[date] = (chartData[date] ?? 0) + 1;
  });

  // Phân bố theo model
  const { data: allBoxes } = await db.from('boxes').select('device_model, android_version');
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
  });
}
