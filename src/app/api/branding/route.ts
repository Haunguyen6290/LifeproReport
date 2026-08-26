import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin
      .from('settings')
      .select('key, value')
      .in('key', ['LOGIN_TITLE', 'LOGIN_SUBTITLE', 'LOGO_URL']);
    if (error) throw error;
    const map: Record<string, string> = {};
    for (const r of (data ?? []) as { key: string; value: string }[]) map[r.key] = r.value;
    return NextResponse.json({
      title: map.LOGIN_TITLE ?? 'Chào mừng anh chị em Lifepro',
      subtitle: map.LOGIN_SUBTITLE ?? 'Vui lòng đăng nhập để sử dụng hệ thống',
      logoUrl: map.LOGO_URL ?? '',
    });
  } catch (e: any) {
    return NextResponse.json({
      title: 'Chào mừng anh chị em Lifepro',
      subtitle: 'Vui lòng đăng nhập để sử dụng hệ thống',
      logoUrl: '',
    });
  }
}
