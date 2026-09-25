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
  const sp = new globalThis.URL(req.url).searchParams;
  const maKh = sp.get('ma_kh')?.trim();
  const tu = sp.get('tu')?.trim();
  const den = sp.get('den')?.trim();
  if (!maKh) return NextResponse.json({ error: 'Thiếu ma_kh' }, { status: 400 });
  if (!tu || !den) return NextResponse.json({ error: 'Thiếu từ/đến ngày' }, { status: 400 });
  const db = admin();
  const { data: rows, error } = await (db.from('sales_rows').select('ma_vt,ten_vt,so_luong,thanh_tien,ma_kh,ten_kh').eq('ma_kh', maKh).gte('ngay', tu).lte('ngay', den).limit(2000) as any);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const agg = new Map<string, { ma_vt: string; ten_vt: string; sl: number; tt: number }>();
  for (const r of (rows ?? []) as any[]) {
    const ma = String(r.ma_vt ?? '').trim() || String(r.ten_vt ?? '').trim();
    if (!ma) continue;
    const cur = agg.get(ma) ?? { ma_vt: String(r.ma_vt ?? ma), ten_vt: String(r.ten_vt ?? ''), sl: 0, tt: 0 };
    cur.sl += Number(r.so_luong ?? 0);
    cur.tt += Number(r.thanh_tien ?? 0);
    agg.set(ma, cur);
  }
  const list = [...agg.values()].sort((a, b) => b.tt - a.tt).slice(0, 30);
  // map sang thue + 4 cot ton
  const { data: dmThue } = await db.from('dm_thue').select('ma_thue,ten_thue,cap1,cap2');
  const capMap = new Map(((dmThue ?? []) as any[]).map((d: any) => [d.cap1, d] as const));
  // also map ma_vt -> cap via dm_thuc
  const { data: dmThuc } = await db.from('dm_thuc').select('ma_thuc,cap1,cap2');
  const capByMaThuc = new Map(((dmThuc ?? []) as any[]).map((d: any) => [d.ma_thuc, d] as const));
  // so-ton agg for 4 cols
  const ngay = den;
  const { data: tThue } = await db.from('ton_thue_ngay').select('ma_thue,sl_ton').eq('ngay', ngay);
  const { data: tThuc } = await db.from('ton_thuc_ngay').select('ma_thuc,sl_kha_dung').eq('ngay', ngay);
  const thueByMa = new Map(((tThue ?? []) as any[]).map((r: any) => [r.ma_thue, Number(r.sl_ton ?? 0)]));
  const thucByMa = new Map(((tThuc ?? []) as any[]).map((r: any) => [r.ma_thuc, Number(r.sl_kha_dung ?? 0)]));
  const thucCap = new Map<string, number>();
  for (const d of (dmThuc as any[]) ?? []) thucCap.set(d.cap1, (thucCap.get(d.cap1) ?? 0) + (thucByMa.get(d.ma_thuc) ?? 0));
  const capThue = new Map<string, number>();
  for (const d of (dmThue as any[]) ?? []) capThue.set(d.cap1, (capThue.get(d.cap1) ?? 0) + (thueByMa.get(d.ma_thue) ?? 0));

  const enriched = list.map((x) => {
    const dmT = capByMaThuc.get(x.ma_vt);
    const cap1 = dmT?.cap1 ?? '';
    const cap2 = dmT?.cap2 ?? '';
    const thue = cap1 ? ((dmThue as any[])?.find((d: any) => d.cap1 === cap1) ?? null) : null;
    const ma_thue = thue?.ma_thue ?? x.ma_vt;
    const ten_thue = thue?.ten_thue ?? x.ten_vt;
    const ton_thue1 = cap1 ? (capThue.get(cap1) ?? 0) : 0;
    const ton_thuc1 = cap1 ? (thucCap.get(cap1) ?? 0) : 0;
    return {
      ma_thuc: x.ma_vt, ten_thuc: x.ten_vt, ma_thue, ten_thue, cap1, cap2,
      ton_thue1, ton_thuc1, ton_thue2: cap2 ? ton_thue1 : '—', ton_thuc2: cap2 ? ton_thuc1 : '—',
      sl: x.sl, tt: x.tt,
    };
  }).sort((a, b) => b.tt - a.tt).slice(0, 10);

  return NextResponse.json({ rows: enriched, total: list.length });
}
