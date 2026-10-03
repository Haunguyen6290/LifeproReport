import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnon } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// GET: Vercel Cron (Authorization: Bearer CRON_SECRET hoặc header x-vercel-cron) + ?group=...
// POST: Admin chạy tay (cần quan_ly_cai_dat / quan_ly_nguoi_dung) — chạy TẤT CẢ việc.

const ALL_CHECKS = ['BOT_CHECK_OKR', 'BOT_CHECK_KE_HOACH_TUAN', 'BOT_CHECK_BAO_CAO_TUAN', 'BOT_CHECK_BAO_CAO_KHO', 'BOT_CHECK_DANG_NHAP', 'BOT_CHECK_TIN_THI_TRUONG', 'BOT_CHECK_CHIEN_DICH'];

// Mỗi lịch cron chạy nhóm việc nào
const GROUPS: Record<string, { checks: string[]; late?: boolean; label: string }> = {
  main: { checks: ['BOT_CHECK_OKR', 'BOT_CHECK_KE_HOACH_TUAN', 'BOT_CHECK_BAO_CAO_KHO', 'BOT_CHECK_DANG_NHAP', 'BOT_CHECK_TIN_THI_TRUONG', 'BOT_CHECK_CHIEN_DICH'], label: '8h30 thứ 2' },
  weekly_report: { checks: ['BOT_CHECK_BAO_CAO_TUAN'], label: '8h30 thứ 3' },
  late: { checks: ['BOT_CHECK_KE_HOACH_TUAN', 'BOT_CHECK_BAO_CAO_TUAN'], late: true, label: '8h30 thứ 6 (nhắc muộn)' },
};

async function isAdmin(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
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
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day - 1));
  return mon.toISOString().slice(0, 10);
}

/** 2026-08-28 → 28/08/2026 (dd/mm/yyyy) — chỉ dùng cho nội dung hiển thị. */
function fmtDayVN(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) return d ?? '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

async function loadRoleMap(admin: ReturnType<typeof createAdminClient>): Promise<Record<string, string[]>> {
  const { data } = await admin.from('settings').select('value').eq('key', 'BOT_ROLE_MAP').maybeSingle();
  let map: Record<string, string[]> = {};
  try { map = JSON.parse((data as any)?.value ?? '{}'); } catch { map = {}; }
  if (typeof map !== 'object' || Array.isArray(map)) map = {};
  return map;
}

async function buildBotReport(admin: ReturnType<typeof createAdminClient>, roleMap: Record<string, string[]>, checksToRun: string[], late: boolean) {
  const lines: string[] = [];
  const mentioned = new Set<string>();
  const { data: profilesRaw } = await admin.from('profiles').select('id, full_name, username, role_id, roles!inner(name)').eq('status', 'ACTIVE');
  const profiles = (profilesRaw ?? []) as any[];
  const roleNameOf = (p: any): string => {
    const r = p.roles;
    if (!r) return '';
    return Array.isArray(r) ? (r[0]?.name ?? '') : (r.name ?? '');
  };
  const targetsFor = (check: string): any[] => {
    const allowed = roleMap[check] ?? [];
    if (!allowed.length) return [];
    return profiles.filter((p) => allowed.includes(roleNameOf(p)));
  };
  const lateTag = late ? ' (vẫn chưa nộp — muộn so với hạn)' : '';

  const run = (check: string, fn: () => Promise<{ missing: any[]; label: string } | null>) => {
    if (!checksToRun.includes(check)) return Promise.resolve();
    return fn().then((res) => {
      if (res && res.missing.length) {
        lines.push(`• ${res.label}${lateTag}: ${res.missing.map((p) => '@' + p.full_name).join(', ')}`);
        res.missing.forEach((p) => mentioned.add(p.id));
      }
    });
  };

  // 1) Chưa tạo OKR cá nhân kỳ hiện tại (tháng hiện tại)
  await run('BOT_CHECK_OKR', async () => {
    const targets = targetsFor('BOT_CHECK_OKR');
    if (!targets.length) return null;
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth() + 1;
    const tu = `${y}-${String(m).padStart(2, '0')}-01`;
    const den = new Date(y, m, 0).toISOString().slice(0, 10);
    const { data: okrs } = await admin.from('okrs').select('user_id').gte('tu_ngay', tu).lte('den_ngay', den);
    const has = new Set((okrs ?? []).map((r: any) => r.user_id));
    return { missing: targets.filter((p) => !has.has(p.id)), label: `Chưa tạo OKR cá nhân (kỳ ${fmtDayVN(tu)}→${fmtDayVN(den)})` };
  });

  // 2) Chưa nộp Kế hoạch tuần (tuần này, hạn T7 17h30)
  await run('BOT_CHECK_KE_HOACH_TUAN', async () => {
    const targets = targetsFor('BOT_CHECK_KE_HOACH_TUAN');
    if (!targets.length) return null;
    const mon = mondayOfThisWeek(new Date());
    const { data: plans } = await admin.from('weekly_plans').select('user_id').eq('tuan_tu', mon);
    const has = new Set((plans ?? []).map((r: any) => r.user_id));
    return { missing: targets.filter((p) => !has.has(p.id)), label: `Chưa nộp Kế hoạch tuần (tuần ${fmtDayVN(mon)})` };
  });

  // 3) Chưa nộp Báo cáo tuần (tuần trước, hạn T2 17h30) — chạy T3
  await run('BOT_CHECK_BAO_CAO_TUAN', async () => {
    const targets = targetsFor('BOT_CHECK_BAO_CAO_TUAN');
    if (!targets.length) return null;
    const lastMon = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return mondayOfThisWeek(d); })();
    const { data: reps } = await admin.from('weekly_reports').select('user_id').eq('tuan_tu', lastMon);
    const has = new Set((reps ?? []).map((r: any) => r.user_id));
    return { missing: targets.filter((p) => !has.has(p.id)), label: `Chưa nộp Báo cáo tuần (tuần ${fmtDayVN(lastMon)})` };
  });

  // 4) Chưa có Báo cáo kho trong 7 ngày
  await run('BOT_CHECK_BAO_CAO_KHO', async () => {
    const targets = targetsFor('BOT_CHECK_BAO_CAO_KHO');
    if (!targets.length) return null;
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const iso = sevenAgo.toISOString().slice(0, 10);
    const { data: reps } = await admin.from('warehouse_reports').select('user_id').gte('ngay', iso);
    const has = new Set((reps ?? []).map((r: any) => r.user_id));
    return { missing: targets.filter((p) => !has.has(p.id)), label: 'Chưa có Báo cáo kho trong 7 ngày' };
  });

  // 5) Không hoạt động >7 ngày
  await run('BOT_CHECK_DANG_NHAP', async () => {
    const targets = targetsFor('BOT_CHECK_DANG_NHAP');
    if (!targets.length) return null;
    const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
    const { data: logs } = await admin.from('audit_logs').select('actor_id, created_at').order('created_at', { ascending: false }).limit(500);
    const lastByActor = new Map<string, string>();
    for (const r of (logs ?? []) as any[]) if (!lastByActor.has(r.actor_id)) lastByActor.set(r.actor_id, r.created_at);
    const missing = targets.filter((p) => { const last = lastByActor.get(p.id); return !last || new Date(last) < sevenAgo; });
    return { missing, label: 'Không hoạt động >7 ngày' };
  });

  // 6) Tuần rồi không có Tin thị trường
  await run('BOT_CHECK_TIN_THI_TRUONG', async () => {
    const targets = targetsFor('BOT_CHECK_TIN_THI_TRUONG');
    if (!targets.length) return null;
    const aWeekAgo = new Date(); aWeekAgo.setDate(aWeekAgo.getDate() - 7);
    const { data: news } = await admin.from('market_news').select('reporter_id').gte('created_at', aWeekAgo.toISOString());
    const has = new Set((news ?? []).map((r: any) => r.reporter_id));
    return { missing: targets.filter((p) => !has.has(p.id)), label: 'Tuần rồi không có Tin thị trường' };
  });

  // 7) Tuần rồi không có Cập nhật Chiến dịch
  await run('BOT_CHECK_CHIEN_DICH', async () => {
    const targets = targetsFor('BOT_CHECK_CHIEN_DICH');
    if (!targets.length) return null;
    const aWeekAgo = new Date(); aWeekAgo.setDate(aWeekAgo.getDate() - 7);
    const { data: ups } = await admin.from('campaign_updates').select('reporter_id').gte('created_at', aWeekAgo.toISOString());
    const has = new Set((ups ?? []).map((r: any) => r.reporter_id));
    return { missing: targets.filter((p) => !has.has(p.id)), label: 'Tuần rồi không có Cập nhật Chiến dịch' };
  });

  return { lines, mentioned: [...mentioned] };
}

async function runBot(authorId: string, group?: string) {
  const admin = createAdminClient();
  const roleMap = await loadRoleMap(admin);
  const hasAny = ALL_CHECKS.some((k) => (roleMap[k] ?? []).length > 0);
  if (!hasAny) {
    const { data: roles } = await admin.from('roles').select('name');
    const allNames = (roles ?? []).map((r: any) => r.name as string);
    for (const k of ALL_CHECKS) roleMap[k] = allNames;
  }
  // Xác định nhóm việc
  const g = group && GROUPS[group] ? GROUPS[group] : null;
  const checksToRun = g ? g.checks : ALL_CHECKS; // không có group (test tay) -> chạy tất cả
  const late = g?.late ?? false;
  const label = g?.label ?? 'Chạy tay';

  const { lines, mentioned } = await buildBotReport(admin, roleMap, checksToRun, late);
  if (lines.length === 0) return { ok: true, message: `(${label}) Không có cảnh báo — mọi người đã ổn.`, lines };
  const title = `Nhắc việc ${label} — tuần ${fmtDayVN(mondayOfThisWeek(new Date()))}`;
  const content = `Bot kiểm tra ${label}:\n` + lines.join('\n');
  const { data: post, error } = await admin.from('bulletin_posts').insert({ author_id: authorId, title, content, mentioned_user_ids: mentioned, is_bot: true }).select('id').single();
  if (error) return { error: error.message };
  return { ok: true, id: (post as any).id, message: `(${label}) Đã tạo 1 bài Bảng tin với ${mentioned.length} người được tag.`, lines };
}

export async function POST(req: NextRequest) {
  const auth = await isAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const group = req.nextUrl.searchParams.get('group') ?? undefined;
  const result = await runBot(auth.userId!, group);
  if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: 500 });
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const cronOk = !!(cronSecret && authHeader === `Bearer ${cronSecret}`);
  let authorId: string | undefined;
  // Nếu đã cấu hình CRON_SECRET thì bắt buộc phải đúng CRON_SECRET — không tin x-vercel-cron một mình
  if (cronSecret) {
    if (!cronOk) {
      const adminCheck = await isAdmin(req);
      if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
      authorId = adminCheck.userId;
    }
  } else {
    const vercelCron = req.headers.get('x-vercel-cron') === '1';
    if (!cronOk && !vercelCron) {
      const adminCheck = await isAdmin(req);
      if (!adminCheck.ok) return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
      authorId = adminCheck.userId;
    }
  }
  if (!authorId) {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin.from('profiles').select('id, roles!inner(name)').limit(1).maybeSingle();
    authorId = (adminProfile as any)?.id as string | undefined;
    if (!authorId) {
      const { data: anyProf } = await admin.from('profiles').select('id').limit(1).single();
      authorId = (anyProf as any)?.id;
    }
  }
  if (!authorId) return NextResponse.json({ error: 'No author' }, { status: 500 });
  const group = req.nextUrl.searchParams.get('group') ?? undefined;
  const result = await runBot(authorId, group);
  if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: 500 });
  return NextResponse.json(result);
}
