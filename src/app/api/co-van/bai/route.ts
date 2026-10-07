import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function checkPerm(req: NextRequest): Promise<boolean> {
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

// GET /api/co-van/bai?loai=ke_hoach|bao_cao&id=xxx — trả nội dung gốc để xem kèm khi duyệt
export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const loai = req.nextUrl.searchParams.get('loai') ?? '';
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id || (loai !== 'ke_hoach' && loai !== 'bao_cao')) return NextResponse.json({ error: 'Thiếu loai/id' }, { status: 400 });
  const admin = createAdminClient() as any;
  if (loai === 'ke_hoach') {
    const { data: plan } = await admin.from('weekly_plans').select('id, tuan_tu, tuan_den, muc_tieu_tuan, noi_dung').eq('id', id).single();
    const { data: items } = await admin.from('weekly_plan_items').select('cong_viec, kq_can_dat, ngay_list, uu_tien').eq('plan_id', id).order('sort_order');
    return NextResponse.json({ plan, items: items ?? [] });
  } else {
    const { data: rep } = await admin.from('weekly_reports').select('id, tuan_tu, tuan_den, tu_danh_gia, ty_le_ht, diem_noi_bat, kho_khan, de_xuat, noi_dung').eq('id', id).single();
    const { data: items } = await admin.from('weekly_report_items').select('viec_da_lam, phan_tram, tu_danh_gia, nguyen_nhan').eq('report_id', id).order('sort_order');
    // Kèm kế hoạch cùng tuần để đối chiếu
    let keHoach: unknown = null;
    let khItems: unknown[] = [];
    if (rep) {
      const { data: p } = await admin.from('weekly_plans').select('id').eq('user_id', (rep as any).user_id ?? '').eq('tuan_tu', (rep as any).tuan_tu).maybeSingle();
      if (p) {
        const { data: pi } = await admin.from('weekly_plan_items').select('cong_viec, kq_can_dat').eq('plan_id', (p as any).id).order('sort_order');
        khItems = pi ?? [];
        keHoach = p;
      }
    }
    return NextResponse.json({ report: rep, items: items ?? [], keHoach, khItems });
  }
}
