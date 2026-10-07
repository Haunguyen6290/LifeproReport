import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function isAdmin(req: NextRequest): Promise<boolean> {
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
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const cronOk = !!(cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (cronSecret) {
    if (!cronOk && !(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } else {
    const vercelCron = req.headers.get('x-vercel-cron') === '1';
    if (!cronOk && !vercelCron && !(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  // Quét các bài chưa chấm hoặc đã sửa sau lần chấm
  const { data: plans } = await admin.from('weekly_plans').select('id, user_id, tuan_tu, updated_at').order('tuan_tu', { ascending: false }).limit(200);
  const { data: reports } = await admin.from('weekly_reports').select('id, user_id, tuan_tu, updated_at').order('tuan_tu', { ascending: false }).limit(200);
  const { data: danhGia } = await admin.from('co_van_danh_gia').select('loai, target_id, phien_ban_luc');
  const doneSet = new Set(((danhGia ?? []) as any[]).map((r) => `${r.loai}:${r.target_id}:${r.phien_ban_luc}`));

  const pending: { loai: 'ke_hoach' | 'bao_cao'; id: string }[] = [];
  for (const p of (plans ?? []) as any[]) {
    const key = `ke_hoach:${p.id}:${p.updated_at}`;
    if (!doneSet.has(key)) pending.push({ loai: 'ke_hoach', id: p.id });
  }
  for (const r of (reports ?? []) as any[]) {
    const key = `bao_cao:${r.id}:${r.updated_at}`;
    if (!doneSet.has(key)) pending.push({ loai: 'bao_cao', id: r.id });
  }

  // Chấm tuần tự, mỗi bài 1 lần gọi AI — tránh burst
  const results: { loai: string; id: string; ok: boolean; ket_qua?: string; reason?: string }[] = [];
  // Giới hạn mỗi lần quét 15 bài để không quá tải
  for (const item of pending.slice(0, 15)) {
    try {
      const { chamMotBai } = await import('@/lib/co-van/service');
      const r = await chamMotBai(item.loai, item.id);
      results.push({ loai: item.loai, id: item.id, ok: r.ok, ket_qua: r.ket_qua, reason: r.reason });
    } catch (e: any) {
      results.push({ loai: item.loai, id: item.id, ok: false, reason: e?.message ?? 'error' });
    }
  }

  return NextResponse.json({ ok: true, pending: pending.length, processed: results.length, results });
}
