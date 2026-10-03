import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const db = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkAdmin(req: NextRequest): Promise<{ ok: boolean; userId: string | null }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false, userId: null };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false, userId: null };
  const { data: prof } = await db().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return { ok: perms.includes('quan_ly_cai_dat'), userId: u.user.id };
}

export async function POST(req: NextRequest) {
  const chk = await checkAdmin(req);
  if (!chk.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'XOA CHUNG TU CU') return NextResponse.json({ error: 'Gõ đúng "XOA CHUNG TU CU" để xác nhận' }, { status: 400 });
  const d = db();
  const { data: s } = await d.from('settings').select('value').eq('key', 'DEBT_BASE_DATE').maybeSingle();
  const baseDate = (s as any)?.value;
  if (!baseDate) return NextResponse.json({ error: 'Chưa có ngày làm gốc — dồn mốc trước' }, { status: 400 });

  // Kiểm tra trước khi xóa: đếm và lưu lại để audit
  const { count: willDelete, error: cntErr } = await d.from('receivable_rows').select('id', { count: 'exact', head: true }).lt('ngay', baseDate);
  if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
  if ((willDelete ?? 0) === 0) return NextResponse.json({ ok: true, daXoa: 0, baseDate, note: 'Không có chứng từ nào trước ngày mốc' });

  let actorName = '';
  try {
    if (chk.userId) {
      const { data: me } = await d.from('profiles').select('full_name').eq('id', chk.userId).single();
      actorName = (me as any)?.full_name ?? '';
    }
  } catch {}

  const { error, count } = await d.from('receivable_rows').delete({ count: 'exact' }).lt('ngay', baseDate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ghi audit chi tiết để còn truy vết
  try {
    await d.from('audit_logs').insert({
      actor_id: chk.userId,
      action: 'Xóa chứng từ trước mốc',
      entity_type: 'receivable_rows',
      entity_id: null,
      details: { baseDate, daXoa: count ?? 0, willDelete: willDelete ?? 0, actor_name: actorName },
    } as any);
  } catch {}

  return NextResponse.json({ ok: true, daXoa: count ?? 0, baseDate });
}
