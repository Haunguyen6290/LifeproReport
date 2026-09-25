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
  const [thue, thuc] = await Promise.all([
    db.from('dm_thue').select('*').order('ma_thue'),
    db.from('dm_thuc').select('*').order('ma_thuc'),
  ]);
  return NextResponse.json({ dm_thue: thue.data ?? [], dm_thuc: thuc.data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const kind: string = body.kind; // 'thue' | 'thuc'
  const ma: string = String(body.ma ?? '').trim();
  const ten: string = String(body.ten ?? '').trim();
  const cap1: string = String(body.cap1 ?? '').trim();
  const cap2: string = String(body.cap2 ?? '').trim();
  const gia: number = Number(body.gia_chua_vat ?? 0);
  const vat: number = Number(body.vat ?? 10);
  if (!ma) return NextResponse.json({ error: 'Thiếu mã' }, { status: 400 });
  const db = admin();
  if (kind === 'thue') {
    const { data: ex } = await db.from('dm_thue').select('ma_thue').eq('ma_thue', ma).maybeSingle();
    if (ex) return NextResponse.json({ error: 'Mã đã tồn tại' }, { status: 400 });
    const { error } = await (db as any).from('dm_thue').insert({ ma_thue: ma, ten_thue: ten || ma, cap1, cap2, gia_chua_vat: gia, vat: [0, 5, 8, 10].includes(vat) ? vat : 10 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: ex } = await db.from('dm_thuc').select('ma_thuc').eq('ma_thuc', ma).maybeSingle();
    if (ex) return NextResponse.json({ error: 'Mã đã tồn tại' }, { status: 400 });
    const { error } = await (db as any).from('dm_thuc').insert({ ma_thuc: ma, ten_thuc: ten || ma, cap1, cap2 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const kind: string = body.kind;
  const ma: string = String(body.ma ?? '').trim();
  const patch: any = {};
  if ('cap1' in body) patch.cap1 = String(body.cap1 ?? '').trim();
  if ('cap2' in body) patch.cap2 = String(body.cap2 ?? '').trim();
  if ('ten' in body) patch[kind === 'thue' ? 'ten_thue' : 'ten_thuc'] = String(body.ten ?? '').trim();
  if (kind === 'thue') {
    if ('gia_chua_vat' in body) patch.gia_chua_vat = Number(body.gia_chua_vat ?? 0);
    if ('vat' in body) { const v = Number(body.vat); if ([0, 5, 8, 10].includes(v)) patch.vat = v; }
  }
  patch.updated_at = new Date().toISOString();
  const db = admin();
  const table = kind === 'thue' ? 'dm_thue' : 'dm_thuc';
  const key = kind === 'thue' ? 'ma_thue' : 'ma_thuc';
  const { error } = await (db as any).from(table).update(patch).eq(key, ma);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const sp = new globalThis.URL(req.url).searchParams;
  const kind = sp.get('kind');
  const ma = sp.get('ma');
  if (!ma) return NextResponse.json({ error: 'Thiếu mã' }, { status: 400 });
  const db = admin();
  const table = kind === 'thue' ? 'dm_thue' : 'dm_thuc';
  const key = kind === 'thue' ? 'ma_thue' : 'ma_thuc';
  const { error } = await (db as any).from(table).delete().eq(key, ma);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
