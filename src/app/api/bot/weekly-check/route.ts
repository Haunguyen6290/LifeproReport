import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnon } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: Vercel Cron (dùng Authorization: Bearer CRON_SECRET nếu đặt, hoặc cho phép Vercel header)
// POST: Admin chạy tay (cần quan_ly_cai_dat)

async function isAdmin(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false };
  const uc = createAnon(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await uc.auth.getUser(token);
  if (!ud?.user) return { ok: false };
  const admin = createAdminClient();
  const { data: prof } = await admin.from('profiles').select('roles!inner(permissions)').eq('id', ud.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  if (!perms.includes('quan_ly_cai_dat') && !perms.includes('quan_ly_nguoi_dung')) return { ok: false };
  return { ok: true, userId: ud.user.id };
}

function mondayOfThisWeek(d = new Date()): string {
  const day = d.getDay() || 7; // Mon=1
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day - 1));
  return mon.toISOString().slice(0, 10);
}

async function buildBotReport(admin: ReturnType<typeof createAdminClient>, enabled: Record<string, boolean>) {
  const lines: string[] = [];
  const mentioned = new Set<string>();
  const { data: profiles } = await admin.from('profiles').select('id, full_name, username, role_id').eq('status', 'ACTIVE');
  const byId = new Map<string, { full_name: string }>();
  for (const p of (profiles ?? []) as any[]) byId.set(p.id, p);

  // 1) Chưa tạo OKR cá nhân kỳ hiện tại (lấy kỳ từ weekly/quarterish: dùng tháng hiện tại)
  if (enabled.BOT_CHECK_OKR) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const tu = `${y}-${String(m).padStart(2, '0')}-01`;
    const den = new Date(y, m, 0).toISOString().slice(0, 10);
    const { data: okrs } = await admin.from('okrs').select('user_id').gte('tu_ngay', tu).lte('den_ngay', den);
    const hasOkr = new Set((okrs ?? []).map((r: any) => r.user_id));
    const missing = (profiles ?? []).filter((p: any) => !hasOkr.has(p.id));
    if (missing.length) {
      lines.push(`• Chưa tạo OKR cá nhân (kỳ ${tu}→${den}): ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  // 2) Chưa nộp Kế hoạch tuần (tuần này)
  if (enabled.BOT_CHECK_KE_HOACH_TUAN) {
    const mon = mondayOfThisWeek(new Date());
    const { data: plans } = await admin.from('weekly_plans').select('user_id').eq('tuan_tu', mon);
    const has = new Set((plans ?? []).map((r: any) => r.user_id));
    const missing = (profiles ?? []).filter((p: any) => !has.has(p.id));
    if (missing.length) {
      lines.push(`• Chưa nộp Kế hoạch tuần (tuần ${mon}): ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  // 3) Chưa nộp Báo cáo tuần (tuần trước)
  if (enabled.BOT_CHECK_BAO_CAO_TUAN) {
    const lastMon = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return mondayOfThisWeek(d); })();
    const { data: reps } = await admin.from('weekly_reports').select('user_id').eq('tuan_tu', lastMon);
    const has = new Set((reps ?? []).map((r: any) => r.user_id));
    const missing = (profiles ?? []).filter((p: any) => !has.has(p.id));
    if (missing.length) {
      lines.push(`• Chưa nộp Báo cáo tuần (tuần ${lastMon}): ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  // 4) Chưa có Báo cáo kho trong 7 ngày
  if (enabled.BOT_CHECK_BAO_CAO_KHO) {
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const iso = sevenAgo.toISOString().slice(0, 10);
    const { data: reps } = await admin.from('warehouse_reports').select('user_id').gte('ngay', iso);
    const has = new Set((reps ?? []).map((r: any) => r.user_id));
    const missing = (profiles ?? []).filter((p: any) => !has.has(p.id));
    if (missing.length) {
      lines.push(`• Chưa có Báo cáo kho trong 7 ngày: ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  // 5) Không đăng nhập quá 7 ngày (dựa vào audit_logs last Đăng nhập/Đăng xuất hoặc profiles.updated_at fallback)
  if (enabled.BOT_CHECK_DANG_NHAP) {
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    // Dùng auth.users.last_sign_in_at không expose via REST -> fallback: nếu không có audit, bỏ qua
    // Thử đọc audit_logs last 200 dòng gần đây
    const { data: logs } = await admin.from('audit_logs').select('actor_id, created_at').order('created_at', { ascending: false }).limit(500);
    const lastByActor = new Map<string, string>();
    for (const r of (logs ?? []) as any[]) if (!lastByActor.has(r.actor_id)) lastByActor.set(r.actor_id, r.created_at);
    const missing: any[] = [];
    for (const p of (profiles ?? []) as any[]) {
      const last = lastByActor.get(p.id);
      if (!last || new Date(last) < sevenAgo) missing.push(p);
    }
    if (missing.length) {
      lines.push(`• Không hoạt động >7 ngày: ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  // 6) Tuần rồi không có Tin thị trường
  if (enabled.BOT_CHECK_TIN_THI_TRUONG) {
    const aWeekAgo = new Date(); aWeekAgo.setDate(aWeekAgo.getDate() - 7);
    const { data: news } = await admin.from('market_news').select('reporter_id').gte('created_at', aWeekAgo.toISOString());
    const has = new Set((news ?? []).map((r: any) => r.reporter_id));
    const missing = (profiles ?? []).filter((p: any) => !has.has(p.id));
    if (missing.length) {
      lines.push(`• Tuần rồi không có Tin thị trường: ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  // 7) Tuần rồi không có Cập nhật Chiến dịch
  if (enabled.BOT_CHECK_CHIEN_DICH) {
    const aWeekAgo = new Date(); aWeekAgo.setDate(aWeekAgo.getDate() - 7);
    const { data: ups } = await admin.from('campaign_updates').select('reporter_id').gte('created_at', aWeekAgo.toISOString());
    const has = new Set((ups ?? []).map((r: any) => r.reporter_id));
    const missing = (profiles ?? []).filter((p: any) => !has.has(p.id));
    if (missing.length) {
      lines.push(`• Tuần rồi không có Cập nhật Chiến dịch: ${missing.map((p: any) => '@' + p.full_name).join(', ')}`);
      for (const p of missing as any[]) mentioned.add(p.id);
    }
  }

  return { lines, mentioned: [...mentioned] };
}

export async function POST(req: NextRequest) {
  const auth = await isAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const admin = createAdminClient();
  const { data: settings } = await admin.from('settings').select('key, value').like('key', 'BOT_CHECK_%');
  const enabled: Record<string, boolean> = {};
  for (const r of (settings ?? []) as { key: string; value: string }[]) enabled[r.key] = String(r.value).toUpperCase() === 'TRUE';
  // default bật nếu chưa có
  const defaults = ['BOT_CHECK_OKR','BOT_CHECK_KE_HOACH_TUAN','BOT_CHECK_BAO_CAO_TUAN','BOT_CHECK_BAO_CAO_KHO','BOT_CHECK_DANG_NHAP','BOT_CHECK_TIN_THI_TRUONG','BOT_CHECK_CHIEN_DICH'];
  for (const k of defaults) if (!(k in enabled)) enabled[k] = true;

  const { lines, mentioned } = await buildBotReport(admin, enabled);
  if (lines.length === 0) {
    return NextResponse.json({ ok: true, message: 'Tuần này mọi người đã ổn — không có cảnh báo.', lines });
  }
  const title = `Nhắc việc tuần ${mondayOfThisWeek(new Date())}`;
  const content = `Bot kiểm tra 8h30 thứ 2:\n` + lines.join('\n');
  const authorId = auth.userId!;
  const { data: post, error } = await admin.from('bulletin_posts').insert({
    author_id: authorId, title, content, mentioned_user_ids: mentioned, is_bot: true,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (post as any).id, message: `Đã tạo 1 bài Bảng tin với ${mentioned.length} người được tag.`, lines });
}

export async function GET(req: NextRequest) {
  // Cron: allow if CRON_SECRET matches or if running on Vercel via vercel-cron header, or fallback to service_role check
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const cronOk = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const vercelCron = req.headers.get('x-vercel-cron') === '1';
  if (!cronOk && !vercelCron) {
    // fallback: allow if caller has admin token
    const adminCheck = await isAdmin(req);
    if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
  }
  // Use service_role to find an admin author (first admin profile)
  const admin = createAdminClient();
  const { data: adminProfile } = await admin.from('profiles').select('id, roles!inner(name)').limit(1).maybeSingle();
  // fallback author: any admin or first profile
  let authorId = (adminProfile as any)?.id as string | undefined;
  if (!authorId) {
    const { data: anyProf } = await admin.from('profiles').select('id').limit(1).single();
    authorId = (anyProf as any)?.id;
  }
  if (!authorId) return NextResponse.json({ error: 'No author' }, { status: 500 });

  const { data: settings } = await admin.from('settings').select('key, value').like('key', 'BOT_CHECK_%');
  const enabled: Record<string, boolean> = {};
  for (const r of (settings ?? []) as { key: string; value: string }[]) enabled[r.key] = String(r.value).toUpperCase() === 'TRUE';
  const defaults = ['BOT_CHECK_OKR','BOT_CHECK_KE_HOACH_TUAN','BOT_CHECK_BAO_CAO_TUAN','BOT_CHECK_BAO_CAO_KHO','BOT_CHECK_DANG_NHAP','BOT_CHECK_TIN_THI_TRUONG','BOT_CHECK_CHIEN_DICH'];
  for (const k of defaults) if (!(k in enabled)) enabled[k] = true;

  const { lines, mentioned } = await buildBotReport(admin, enabled);
  if (lines.length === 0) {
    return NextResponse.json({ ok: true, message: 'Tuần này mọi người đã ổn — không có cảnh báo.', lines });
  }
  const title = `Nhắc việc tuần ${mondayOfThisWeek(new Date())}`;
  const content = `Bot kiểm tra 8h30 thứ 2:\n` + lines.join('\n');
  const { data: post, error } = await admin.from('bulletin_posts').insert({
    author_id: authorId, title, content, mentioned_user_ids: mentioned, is_bot: true,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (post as any).id, lines });
}
