import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await db().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat');
}

/** POST { ngayMoc: 'YYYY-MM-DD' } — dồn số dư gốc đến ngày mốc (nguyên tử qua RPC). */
export async function POST(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const { ngayMoc } = await req.json().catch(() => ({}));
  if (!ngayMoc || !/^\d{4}-\d{2}-\d{2}$/.test(ngayMoc)) return NextResponse.json({ error: 'Ngày mốc không hợp lệ (YYYY-MM-DD)' }, { status: 400 });

  // Ưu tiên RPC nguyên tử (0071). Fallback khi migration chưa chạy.
  const d = db();
  const { data: rpcData, error: rpcErr } = await (d as any).rpc('rebase_debt', { p_new_base: ngayMoc as any });
  if (!rpcErr && rpcData) {
    return NextResponse.json({ ok: true, soKhach: (rpcData as any).so_khach ?? (rpcData as any).soKhach ?? 0, ngayMoc });
  }
  if (rpcErr) {
    const missing = String(rpcErr.code) === 'PGRST202' || String(rpcErr.code) === '42883' || rpcErr.message?.includes('does not exist');
    if (!missing) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // Fallback — giữ logic cũ tới khi 0071 chạy
  const { data: s } = await d.from('settings').select('value').eq('key', 'DEBT_BASE_DATE').maybeSingle();
  const oldBase = (s as any)?.value ?? '2026-01-01';
  if (ngayMoc <= oldBase) return NextResponse.json({ error: `Ngày mốc mới phải sau mốc hiện tại (${oldBase})` }, { status: 400 });

  const { data: base } = await d.from('customer_base_balance').select('ma_kh, ten_kh, du_no');
  const { data: ps } = await d.from('receivable_rows').select('ma_kh, ten_kh, so_no, so_co').gte('ngay', oldBase).lt('ngay', ngayMoc);
  const byKh = new Map<string, number>();
  for (const r of (ps ?? []) as any[]) byKh.set(r.ma_kh, (byKh.get(r.ma_kh) ?? 0) + Number(r.so_no) - Number(r.so_co));

  const upserts = (base ?? []).map((b: any) => ({
    ma_kh: b.ma_kh, ten_kh: b.ten_kh,
    du_no: Number(b.du_no) + (byKh.get(b.ma_kh) ?? 0),
    ngay_moc: ngayMoc, updated_at: new Date().toISOString(),
  }));
  for (const [ma, nu] of byKh) {
    if (!upserts.some((u) => u.ma_kh === ma)) {
      const ten = ((ps ?? []) as any[]).find((r) => r.ma_kh === ma)?.ten_kh ?? '';
      upserts.push({ ma_kh: ma, ten_kh: ten, du_no: nu, ngay_moc: ngayMoc, updated_at: new Date().toISOString() });
    }
  }

  const CHUNK = 2000;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const { error } = await d.from('customer_base_balance').upsert(upserts.slice(i, i + CHUNK), { onConflict: 'ma_kh' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await d.from('settings').upsert({ key: 'DEBT_BASE_DATE', value: ngayMoc }, { onConflict: 'key' });
  return NextResponse.json({ ok: true, soKhach: upserts.length, ngayMoc });
}
