import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guiGopY, boQua } from '@/lib/co-van/service';

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const expected = process.env.CO_VAN_TELEGRAM_WEBHOOK_SECRET ?? '';
  // Nếu đã cấu hình secret thì bắt buộc phải khớp; chưa cấu hình thì cho qua (dev)
  if (expected && secret !== expected) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient() as any;

  // Lấy private chat id từ settings
  const { data: sRows } = await admin.from('settings').select('key, value').in('key', ['CO_VAN_TELEGRAM_PRIVATE_CHAT_ID', 'TELEGRAM_BOT_TOKEN']);
  const sm = new Map((sRows ?? []).map((r: any) => [r.key, r.value]));
  const privateChatId = String(sm.get('CO_VAN_TELEGRAM_PRIVATE_CHAT_ID') ?? '').trim();
  const botToken = String(sm.get('TELEGRAM_BOT_TOKEN') ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();

  // Callback query từ nút Gửi / Bỏ qua
  if (body.callback_query) {
    const cb = body.callback_query;
    const chatId = String(cb.message?.chat?.id ?? '');
    if (privateChatId && chatId !== privateChatId) return NextResponse.json({ ok: true });
    const data = String(cb.data ?? '');
    const fromId = cb.from?.id;
    if (data.startsWith('cv:gui:')) {
      const id = data.slice('cv:gui:'.length);
      const r = await guiGopY(id);
      await answerCallback(cb.id, botToken, r.ok ? 'Đã gửi cho nhân viên' : (r.reason ?? 'Lỗi'));
      if (r.ok && botToken && cb.message?.message_id) {
        await editMessage(botToken, chatId, cb.message.message_id, `${cb.message.text ?? ''}\n\n✅ Đã gửi`);
      }
      return NextResponse.json({ ok: true });
    }
    if (data.startsWith('cv:boqua:')) {
      const id = data.slice('cv:boqua:'.length);
      const r = await boQua(id);
      await answerCallback(cb.id, botToken, r.ok ? 'Đã bỏ qua' : (r.reason ?? 'Lỗi'));
      if (r.ok && botToken && cb.message?.message_id) {
        await editMessage(botToken, chatId, cb.message.message_id, `${cb.message.text ?? ''}\n\n⏭ Đã bỏ qua`);
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  const msg = body.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat?.id ?? '');
  const text = String(msg.text ?? '').trim();

  // /start — lưu private chat id
  if (text === '/start' || text.startsWith('/start ')) {
    if (chatId) {
      await admin.from('settings').upsert({ key: 'CO_VAN_TELEGRAM_PRIVATE_CHAT_ID', value: chatId }, { onConflict: 'key' });
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Đã kết nối Cố vấn Giám đốc — từ giờ các cảnh báo chấm bài sẽ gửi riêng vào đây. Ông có thể nhắn hỏi như "Tuần này ai làm dở nhất?"',
          }),
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Chỉ xử lý tin nhắn từ private chat của Giám đốc
  if (privateChatId && chatId !== privateChatId) return NextResponse.json({ ok: true });
  if (!privateChatId && msg.chat?.type !== 'private') return NextResponse.json({ ok: true });

  // Tin nhắn thường — forward vào luồng chat (tái dùng /api/co-van/chat)
  if (!text) return NextResponse.json({ ok: true });

  // Lưu tin nhắn user
  await admin.from('co_van_tin_nhan').insert({ vai_tro: 'user', noi_dung: text, kenh: 'telegram', telegram_message_id: msg.message_id ?? null });

  // Gọi chat flow (tái dùng logic chat)
  try {
    const { loadCoVanConfig } = await import('@/lib/co-van/config');
    const { buildChatSystem } = await import('@/lib/co-van/prompt');
    const cfg = await loadCoVanConfig(admin);
    if (!cfg.ai.key) {
      await sendReply(botToken, chatId, 'Chưa cấu hình AI_KEY trong Cài đặt.');
      return NextResponse.json({ ok: true });
    }
    const { data: recent } = await admin.from('co_van_danh_gia').select('loai, ket_qua, ly_do, dau_hieu_doi_pho, tuan_tu, user_id').order('created_at', { ascending: false }).limit(20);
    const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', ((recent ?? []) as any[]).map((r: any) => r.user_id).filter(Boolean));
    const nameById = new Map(((profs ?? []) as any[]).map((p: any) => [p.id, p.full_name]));
    const summary = ((recent ?? []) as any[]).map((r: any) => `${r.loai}/${r.ket_qua} — ${nameById.get(r.user_id) ?? r.user_id} tuần ${r.tuan_tu}: ${String(r.ly_do).slice(0, 120)}`).join('\n');
    const { data: history } = await admin.from('co_van_tin_nhan').select('vai_tro, noi_dung').order('created_at', { ascending: false }).limit(12);
    const histOrdered = (((history ?? []) as any[]).reverse()).filter((m: any) => m.vai_tro !== 'system').map((m: any) => ({ role: m.vai_tro as 'user' | 'assistant', content: String(m.noi_dung).slice(0, 1000) }));

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({
      apiKey: cfg.ai.key,
      ...(cfg.ai.endpoint ? { baseURL: cfg.ai.endpoint.replace(/\/+$/, '').replace(/\/v1\/messages$/i, '') } : {}),
      timeout: 30_000,
      maxRetries: 0,
    });
    const system = buildChatSystem(cfg.ai.brief, cfg.extraInstructions) + (summary ? `\n\nDỮ LIỆU CHẤM GẦN ĐÂY:\n${summary.slice(0, 4000)}` : '');
    const res = await client.messages.create({
      model: cfg.ai.model,
      max_tokens: 1500,
      temperature: 0.3,
      system,
      messages: [...histOrdered.map((h: any) => ({ role: h.role, content: h.content })), { role: 'user' as const, content: text }] as any,
    });
    const reply = (res.content.find((b: any) => b.type === 'text') as any)?.text?.trim().slice(0, 4000) ?? '';
    if (reply) {
      await admin.from('co_van_tin_nhan').insert({ vai_tro: 'assistant', noi_dung: reply, kenh: 'telegram' });
      await sendReply(botToken, chatId, reply);
    }
  } catch (e: any) {
    await sendReply(botToken, chatId, `Lỗi: ${e?.message ?? 'không rõ'}`);
  }

  return NextResponse.json({ ok: true });
}

async function answerCallback(id: string, token: string, text: string) {
  if (!token || !id) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id, text }),
    });
  } catch {}
}

async function editMessage(token: string, chatId: string, messageId: number, text: string) {
  if (!token || !chatId || !messageId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }),
    });
  } catch {}
}

async function sendReply(token: string, chatId: string, text: string) {
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch {}
}
