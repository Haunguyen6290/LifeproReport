import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(SUPA_URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat') || perms.includes('ke_toan') || perms.includes('xem_tai_chinh');
}

export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const db = admin();
  const { data, error } = await db.from('hoa_don_xuat').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const dongIn: any[] = Array.isArray(body.dong) ? body.dong : [];
  const ngayEff: string = String(body.ngay || new Date().toISOString().slice(0, 10));
  const db = admin();
  // Server-side oversell guard: ton - truTam
  {
    const needByMa = new Map<string, number>();
    for (const d of dongIn) {
      const ma = String(d.ma ?? '').trim();
      const sl = Number(String(d.sl ?? '').replace(/\./g, '')) || 0;
      if (!ma || !sl) continue;
      needByMa.set(ma, (needByMa.get(ma) ?? 0) + sl);
    }
    if (needByMa.size) {
      const { data: dmThue } = await db.from('dm_thue').select('ma_thue,cap1').in('ma_thue', [...needByMa.keys()]);
      const capByMa = new Map(((dmThue ?? []) as any[]).map((r: any) => [r.ma_thue, String(r.cap1||'').toUpperCase()]));
      const { data: tonRows } = await db.from('ton_thue_ngay').select('ma_thue,sl_ton').eq('ngay', ngayEff);
      const tonByCap = new Map<string, number>();
      for (const r of (tonRows ?? []) as any[]) {
        const c = capByMa.get(r.ma_thue) ?? '';
        tonByCap.set(c, (tonByCap.get(c) ?? 0) + Number(r.sl_ton ?? 0));
      }
      // truTam from hoa_don_xuat same ngay
      const { data: hds } = await db.from('hoa_don_xuat').select('dong').eq('ngay', ngayEff);
      const truByCap = new Map<string, number>();
      for (const h of (hds ?? []) as any[]) for (const d of (h.dong ?? []) as any[]) {
        const ma = String(d.ma ?? '').trim(); const sl = Number(String(d.sl ?? '').replace(/\./g, ''))||0;
        const cap = capByMa.get(ma) ?? '';
        if (!cap || !sl) continue;
        truByCap.set(cap, (truByCap.get(cap) ?? 0) + sl);
      }
      // check per cap
      const needByCap = new Map<string, number>();
      for (const [ma, sl] of needByMa) {
        const cap = capByMa.get(ma) ?? '';
        if (!cap) continue;
        needByCap.set(cap, (needByCap.get(cap) ?? 0) + sl);
      }
      for (const [cap, needSl] of needByCap) {
        const ton = tonByCap.get(cap) ?? 0;
        const tru = truByCap.get(cap) ?? 0;
        const avail = ton - tru;
        if (needSl > avail) return NextResponse.json({ error: `Vượt thừa: ${cap} cần ${needSl}, còn ${Math.max(0, avail)} (tồn ${ton} - đã trừ ${tru})` }, { status: 409 });
      }
    }
  }
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  let uid: string | null = null;
  try {
    const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await anon.auth.getUser(token);
    uid = u.user?.id ?? null;
  } catch {}
  const { error } = await (db as any).from('hoa_don_xuat').insert({
    ngay: body.ngay || new Date().toISOString().slice(0, 10),
    khach_ma: body.khach_ma ?? null,
    khach_ten: body.khach_ten ?? null,
    tu_ngay: body.tu_ngay ?? null,
    den_ngay: body.den_ngay ?? null,
    tong_vat: Number(body.tong_vat ?? 0),
    dong: (Array.isArray(body.dong) ? body.dong.map((d: any) => ({ ma: d.ma, ten: d.ten, sl: d.sl, giaChua: d.giaChua, giaDa: d.giaDa, vat: d.vat })) : body.dong) ?? [],
    created_by: uid,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const { data: me } = uid ? await db.from('profiles').select('full_name').eq('id', uid).single() : { data: null } as any;
    await db.from('audit_logs').insert({
      actor_id: uid, action: 'Lưu & Xuất hóa đơn', entity_type: 'hoa_don_xuat', entity_id: null,
      details: { ngay: body.ngay, khach_ma: body.khach_ma ?? null, khach_ten: body.khach_ten ?? null, tong_vat: body.tong_vat, so_dong: dongIn.length, full_name: (me as any)?.full_name ?? '' },
    });
  } catch {}
  return NextResponse.json({ ok: true });
}
