import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(SUPA_URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('xem_hoat_dong_ns');
}

async function fetchAll(q: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Cột = loại công việc. Nhóm audit theo action.
const AUDIT_GROUP: Record<string, string> = {
  'Sửa hồ sơ': 'cap_nhat_kh',
  'Tạo OKR cá nhân': 'okr', 'Tạo OKR công ty': 'okr',
  'Tạo báo cáo kho': 'bao_cao_kho', 'Sửa báo cáo kho': 'bao_cao_kho', 'Bình luận báo cáo kho': 'bao_cao_kho',
  'Tạo chiến dịch': 'chien_dich', 'Cập nhật chiến dịch': 'chien_dich', 'Bình luận chiến dịch': 'chien_dich',
  'Đăng bảng tin': 'bang_tin',
  'Lưu & Xuất hóa đơn': 'hoa_don',
  'Import sổ 131': 'tai_chinh',
};

export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const tu = req.nextUrl.searchParams.get('tu') ?? '';
  const den = req.nextUrl.searchParams.get('den') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den)) return NextResponse.json({ error: 'Ngày không hợp lệ' }, { status: 400 });
  const tuTs = `${tu}T00:00:00+07:00`;
  const denTs = `${den}T23:59:59+07:00`;
  const db = admin();

  const [profiles, plans, reports, inters, audits, customers] = await Promise.all([
    fetchAll(() => db.from('profiles').select('id,full_name,status,roles(name)').order('full_name')),
    fetchAll(() => db.from('weekly_plans').select('id,user_id,tuan_tu,tuan_den,muc_tieu_tuan,noi_dung,trang_thai_duyet,created_at').gte('created_at', tuTs).lte('created_at', denTs)),
    fetchAll(() => db.from('weekly_reports').select('id,user_id,tuan_tu,tuan_den,noi_dung,diem_noi_bat,kho_khan,de_xuat,ty_le_ht,trang_thai_duyet,created_at').gte('created_at', tuTs).lte('created_at', denTs)),
    fetchAll(() => db.from('customer_interactions').select('id,customer_id,loai,noi_dung,ngay,hen_nhac,nguoi_tao,created_at').gte('ngay', tu).lte('ngay', den)),
    fetchAll(() => db.from('audit_logs').select('id,actor_id,action,entity_type,entity_id,details,created_at').gte('created_at', tuTs).lte('created_at', denTs)),
    fetchAll(() => db.from('customers').select('id,ma_kh,ten_kh,created_by,created_at').gte('created_at', tuTs).lte('created_at', denTs)),
  ]);

  // Tên khách cho tương tác/cập nhật
  const custIds = [...new Set([...inters.map((x) => x.customer_id), ...audits.filter((a) => a.entity_type === 'customer').map((a) => a.entity_id)].filter(Boolean))];
  const custName = new Map<string, string>();
  for (let i = 0; i < custIds.length; i += 800) {
    const { data } = await db.from('customers').select('id,ma_kh,ten_kh').in('id', custIds.slice(i, i + 800));
    for (const c of data ?? []) custName.set(c.id, `${c.ma_kh} - ${c.ten_kh}`);
  }

  type Item = { loai: string; thoi_gian: string; tieu_de: string; noi_dung: string };
  const byUser = new Map<string, Record<string, Item[]>>();
  const push = (uid: string | null, col: string, it: Item) => {
    if (!uid) return;
    const u = byUser.get(uid) ?? {};
    (u[col] ??= []).push(it);
    byUser.set(uid, u);
  };

  for (const p of plans) push(p.user_id, 'ke_hoach_tuan', {
    loai: 'Kế hoạch tuần', thoi_gian: p.created_at,
    tieu_de: `Tuần ${p.tuan_tu} → ${p.tuan_den} · ${p.trang_thai_duyet ?? ''}`,
    noi_dung: [p.muc_tieu_tuan && `Mục tiêu: ${p.muc_tieu_tuan}`, p.noi_dung].filter(Boolean).join('\n'),
  });
  for (const r of reports) push(r.user_id, 'bao_cao_tuan', {
    loai: 'Báo cáo tuần', thoi_gian: r.created_at,
    tieu_de: `Tuần ${r.tuan_tu} → ${r.tuan_den} · ${r.ty_le_ht != null ? `HT ${r.ty_le_ht}% · ` : ''}${r.trang_thai_duyet ?? ''}`,
    noi_dung: [r.noi_dung, r.diem_noi_bat && `Nổi bật: ${r.diem_noi_bat}`, r.kho_khan && `Khó khăn: ${r.kho_khan}`, r.de_xuat && `Đề xuất: ${r.de_xuat}`].filter(Boolean).join('\n'),
  });
  const LOAI_TT: Record<string, string> = { goi: 'Gọi', gap: 'Gặp', zalo: 'Zalo', khieu_nai: 'Khiếu nại' };
  for (const t of inters) push(t.nguoi_tao, 'tuong_tac', {
    loai: `Tương tác · ${LOAI_TT[t.loai] ?? t.loai}`, thoi_gian: t.created_at ?? t.ngay,
    tieu_de: `${custName.get(t.customer_id) ?? 'Khách'}${t.hen_nhac ? ` · hẹn ${t.hen_nhac}` : ''}`,
    noi_dung: t.noi_dung ?? '',
  });
  for (const c of customers) push(c.created_by, 'khach_moi', {
    loai: 'Khách mới', thoi_gian: c.created_at, tieu_de: `${c.ma_kh} - ${c.ten_kh}`, noi_dung: '',
  });
  for (const a of audits) {
    const col = AUDIT_GROUP[a.action];
    if (!col) continue;
    const d = a.details ?? {};
    let noi = '';
    if (Array.isArray(d.changes)) noi = d.changes.map((c: any) => `${c.field}: ${c.old ?? ''} → ${c.new ?? ''}`).join('\n');
    else noi = Object.entries(d).filter(([k]) => k !== 'full_name').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    push(a.actor_id, col, {
      loai: a.action, thoi_gian: a.created_at,
      tieu_de: a.entity_type === 'customer' ? (custName.get(a.entity_id) ?? 'Khách') : (d.title ?? d.ten ?? a.entity_type ?? ''),
      noi_dung: noi,
    });
  }

  const rows = profiles
    .map((p: any) => {
      const cols = byUser.get(p.id) ?? {};
      for (const k of Object.keys(cols)) cols[k].sort((a, b) => String(b.thoi_gian).localeCompare(String(a.thoi_gian)));
      const tong = Object.values(cols).reduce((s, v) => s + v.length, 0);
      return { user_id: p.id, ho_ten: p.full_name, vai_tro: p.roles?.name ?? '', trang_thai: p.status, cols, tong };
    })
    .filter((r) => r.trang_thai === 'ACTIVE' || r.tong > 0)
    .sort((a, b) => b.tong - a.tong);

  return NextResponse.json({ tu, den, rows });
}
