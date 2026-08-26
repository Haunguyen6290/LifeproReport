import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Chưa có file' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Chỉ nhận file ảnh' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Ảnh tối đa 2MB' }, { status: 400 });

    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    // Đảm bảo bucket tồn tại (idempotent)
    try { await admin.storage.createBucket('avatars', { public: true } as any); } catch {}

    const buf = Buffer.from(await file.arrayBuffer());
    const path = `branding/logo-${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from('avatars').upload(path, buf, { contentType: 'image/png' });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    const url = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Upload lỗi' }, { status: 500 });
  }
}
