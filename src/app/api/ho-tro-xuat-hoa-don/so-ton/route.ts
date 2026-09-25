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
  const ngay = new globalThis.URL(req.url).searchParams.get('ngay') || new Date().toISOString().slice(0, 10);
  const db = admin();
  // thu RPC neu co, fallback ve tinh tay
  const { data: rpc, error: rpcErr } = await (db as any).rpc('fn_so_ton_4cot', { p_ngay: ngay });
  if (!rpcErr && rpc) return NextResponse.json({ ngay, rows: rpc });
  // fallback: doc 2 bang ton va gom
  const { data: thue } = await db.from('dm_thue').select('ma_thue,ten_thue,cap1,cap2');
  const { data: tThue } = await db.from('ton_thue_ngay').select('ma_thue,sl_ton').eq('ngay', ngay);
  const { data: tThuc } = await db.from('ton_thuc_ngay').select('ma_thuc,sl_kha_dung').eq('ngay', ngay);
  const { data: dmThuc } = await db.from('dm_thuc').select('ma_thuc,cap1,cap2');
  const capMapThue = new Map<string, number>();
  const cap2Thue = new Map<string, number>();
  const tenByCap = new Map<string, string>();
  for (const d of (thue as any[]) ?? []) {
    if (!tenByCap.has(d.cap1)) tenByCap.set(d.cap1, d.ten_thue);
  }
  const thueByMa = new Map((tThue as any[])?.map((r: any) => [r.ma_thue, Number(r.sl_ton || 0)]) ?? []);
  const thucByMa = new Map((tThuc as any[])?.map((r: any) => [r.ma_thuc, Number(r.sl_kha_dung || 0)]) ?? []);
  const thucCap = new Map<string, number>();
  const thucCap2 = new Map<string, number>();
  for (const d of (dmThuc as any[]) ?? []) {
    const sl = thucByMa.get(d.ma_thuc) ?? 0;
    thucCap.set(d.cap1, (thucCap.get(d.cap1) ?? 0) + sl);
    if (d.cap2) thucCap2.set(d.cap2, (thucCap2.get(d.cap2) ?? 0) + sl);
  }
  for (const d of (thue as any[]) ?? []) {
    const sl = thueByMa.get(d.ma_thue) ?? 0;
    capMapThue.set(d.cap1, (capMapThue.get(d.cap1) ?? 0) + sl);
    if (d.cap2) cap2Thue.set(d.cap2, (cap2Thue.get(d.cap2) ?? 0) + sl);
  }
  const rows = (thue as any[]).map((d: any) => ({
    ma_thue: d.ma_thue, ten_thue: d.ten_thue, cap1: d.cap1 || '', cap2: d.cap2 || '',
    ton_thue1: capMapThue.get(d.cap1) ?? 0,
    ton_thuc1: thucCap.get(d.cap1) ?? 0,
    ton_thue2: d.cap2 ? (cap2Thue.get(d.cap2) ?? 0) : '—',
    ton_thuc2: d.cap2 ? (thucCap2.get(d.cap2) ?? 0) : '—',
    thua: (capMapThue.get(d.cap1) ?? 0) - (thucCap.get(d.cap1) ?? 0),
  })).sort((a: any, b: any) => a.ma_thue.localeCompare(b.ma_thue));
  return NextResponse.json({ ngay, rows });
}
