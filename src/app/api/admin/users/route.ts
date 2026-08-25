import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer /i, '');
  if (!token) throw new Error('Chưa đăng nhập');
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud, error } = await userClient.auth.getUser(token);
  if (error || !ud.user) throw new Error('Phiên hết hạn');
  const admin = createAdminClient();
  const { data: prof } = await admin.from('profiles').select('id, roles!inner(permissions)').eq('id', ud.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  if (!perms.includes('quan_ly_nguoi_dung')) throw new Error('Không có quyền');
  return { admin, userId: ud.user.id };
}

export async function POST(req: NextRequest) {
  try {
    const { admin } = await requireAdmin(req);
    const body = await req.json();
    if (body.action === 'create') {
      const username = String(body.username ?? '').trim().toLowerCase();
      const fullName = String(body.fullName ?? '').trim();
      const roleId = String(body.roleId ?? '');
      if (!/^[a-z0-9._]{3,20}$/.test(username)) return NextResponse.json({ error: 'Tên đăng nhập không hợp lệ' }, { status: 400 });
      if (!fullName) return NextResponse.json({ error: 'Phải nhập họ tên' }, { status: 400 });
      if (!roleId) return NextResponse.json({ error: 'Phải chọn vai trò' }, { status: 400 });
      const email = `${username}@congty.local`;
      const { data, error } = await admin.auth.admin.createUser({ email, password: '123456', email_confirm: true });
      if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'Tạo thất bại' }, { status: 400 });
      const { error: pe } = await admin.from('profiles').insert({ id: data.user.id, username, full_name: fullName, role_id: roleId, must_change_password: true });
      if (pe) {
        await admin.auth.admin.deleteUser(data.user.id);
        return NextResponse.json({ error: 'Lỗi ghi profile: ' + pe.message }, { status: 400 });
      }
      await admin.from('audit_logs').insert({ actor_id: (await requireAdmin(req)).userId, action: 'Tạo tài khoản', entity_type: 'user', entity_id: data.user.id, details: { username, full_name: fullName } });
      return NextResponse.json({ ok: true, id: data.user.id });
    }
    if (body.action === 'update') {
      const { id, patch } = body as { id: string; patch: Record<string, any> };
      if (!id || !patch) return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
      const { error } = await admin.from('profiles').update(patch).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'resetPw') {
      const { id } = body as { id: string };
      const { error } = await admin.auth.admin.updateUserById(id, { password: '123456' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.from('profiles').update({ must_change_password: true }).eq('id', id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}
