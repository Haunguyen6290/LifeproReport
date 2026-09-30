import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false };
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  const ok = perms.includes('xem_box') || perms.includes('quan_ly_cai_dat');
  return { ok, userId: u.user.id };
}

export async function POST(req: NextRequest) {
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  try {
    const body = await req.json();
    const { id, activation_code } = body;

    if (!id || !activation_code) {
      return NextResponse.json({ error: 'Thiếu id hoặc activation_code' }, { status: 400 });
    }

    // Validate activation_code format (6-20 ký tự chữ/số)
    if (typeof activation_code !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(activation_code)) {
      return NextResponse.json({ error: 'Mã kích hoạt không hợp lệ (6-20 ký tự chữ/số)' }, { status: 400 });
    }

    const db = admin();

    // Check box tồn tại và chưa được kích hoạt
    const { data: existingBox, error: fetchError } = await db
      .from('boxes')
      .select('id, is_activated, activation_code')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('DB error fetching box for activation:', fetchError);
      return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
    }

    if (!existingBox) {
      return NextResponse.json({ error: 'Không tìm thấy box' }, { status: 404 });
    }

    if (existingBox.is_activated) {
      return NextResponse.json({
        error: 'Box đã được kích hoạt trước đó',
        activation_code: existingBox.activation_code
      }, { status: 409 });
    }

    // Kích hoạt box
    const { data, error } = await db
      .from('boxes')
      .update({
        activation_code,
        is_activated: true,
        activated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('DB error activating box:', error);
      return NextResponse.json({ error: 'Lỗi kích hoạt' }, { status: 500 });
    }

    return NextResponse.json({ success: true, box: data });
  } catch (e: any) {
    console.error('Error in POST /api/box/activate:', e);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
