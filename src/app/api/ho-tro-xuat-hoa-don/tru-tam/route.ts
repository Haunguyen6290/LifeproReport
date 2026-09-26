import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(SUPA_URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
function checkPerm(req: NextRequest) {
  const t = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!t) return false;
  return true;
}
async function hasPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u?.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat') || perms.includes('ke_toan') || perms.includes('xem_tai_chinh');
}

export async function GET(req: NextRequest) {
  if (!(await hasPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const sp = new globalThis.URL(req.url).searchParams;
  const ngay = sp.get('ngay') || new Date().toISOString().slice(0, 10);
  const db = admin();
  const { data: ds } = await db.from('hoa_don_xuat').select('dong').eq('ngay', ngay);
  const sumByCap = new Map<string, number>();
  const sumByMa = new Map<string, number>();
  for (const r of (ds ?? []) as any[]) {
    for (const d of (r.dong ?? []) as any[]) {
      const ma = String(d.ma ?? '').trim();
      const sl = Number(String(d.sl ?? '').replace(/\./g, '')) || 0;
      if (!ma || !sl) continue;
      sumByMa.set(ma, (sumByMa.get(ma) ?? 0) + sl);
    }
  }
  // also aggregate by cap1
  const { data: dmThue } = await db.from('dm_thue').select('ma_thue,cap1');
  const capByMa = new Map(((dmThue ?? []) as any[]).map((d: any) => [d.ma_thue, d.cap1]));
  for (const [ma, sl] of sumByMa) {
    const cap = capByMa.get(ma);
    if (cap) sumByCap.set(cap, (sumByCap.get(cap) ?? 0) + sl);
  }
  return NextResponse.json({ ngay, byMa: Object.fromEntries(sumByMa), byCap: Object.fromEntries(sumByCap) });
}
