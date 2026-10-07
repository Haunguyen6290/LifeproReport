// src/lib/co-van/telegram-private.ts — gửi tin riêng cho Giám đốc
import { createAdminClient } from '@/lib/supabase/admin';

export async function sendToDirector(
  text: string,
  inlineKeyboard?: { text: string; callback_data: string }[][],
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const admin = createAdminClient() as any;
    const { data } = await admin.from('settings').select('key, value').in('key', ['TELEGRAM_BOT_TOKEN', 'CO_VAN_TELEGRAM_PRIVATE_CHAT_ID']);
    const m = new Map((data ?? []).map((r: any) => [r.key, r.value]));
    const token = String(m.get('TELEGRAM_BOT_TOKEN') ?? '').trim();
    const chatId = String(m.get('CO_VAN_TELEGRAM_PRIVATE_CHAT_ID') ?? '').trim();
    if (!token || !chatId) return { ok: false, reason: 'Chưa cấu hình bot hoặc chat riêng' };
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (inlineKeyboard?.length) body.reply_markup = { inline_keyboard: inlineKeyboard };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    return { ok: !!j.ok, reason: j.ok ? undefined : j.description };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'error' };
  }
}
