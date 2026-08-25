import { NextRequest, NextResponse } from 'next/server';
import { sendTelegram } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? '').trim();
  const eventKey = String(body.eventKey ?? 'TB_KHACH_HANG_MOI').trim() || 'TB_KHACH_HANG_MOI';
  if (!text) return NextResponse.json({ ok: false, description: 'Missing text' }, { status: 400 });

  // Cho phép gửi thử mà không check toggle nếu body.test === true
  if (body.test) {
    // Gửi thẳng, bỏ qua toggle
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
    if (!url || !key) return NextResponse.json({ ok: false, description: 'Missing Supabase env' }, { status: 500 });
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin.from('settings').select('key, value').in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']);
    const m = new Map((data ?? []).map((r: any) => [r.key, r.value]));
    const token = String(m.get('TELEGRAM_BOT_TOKEN') ?? '').trim();
    const chatId = String(m.get('TELEGRAM_CHAT_ID') ?? '').trim();
    if (!token || !chatId) return NextResponse.json({ ok: false, description: 'Chưa cấu hình Bot Token hoặc Chat ID' }, { status: 400 });
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: j.ok ? 200 : 400 });
  }

  const j = await sendTelegram(eventKey, text);
  return NextResponse.json(j, { status: j.ok ? 200 : 400 });
}

// Lấy group id từ getUpdates (để ông không phải mở browser)
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url || !key) return NextResponse.json({ ok: false, description: 'Missing env' }, { status: 500 });
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin.from('settings').select('value').eq('key', 'TELEGRAM_BOT_TOKEN').single();
  const token = String((data as any)?.value ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, description: 'Chưa cấu hình Bot Token' }, { status: 400 });
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=30`);
  const j = await r.json();
  const chats: any[] = [];
  for (const u of (j.result ?? [])) {
    const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
    if (c) chats.push({ id: c.id, type: c.type, title: c.title ?? c.first_name ?? '', username: c.username ?? '' });
  }
  return NextResponse.json({ ok: j.ok, chats, rawCount: (j.result ?? []).length });
}
