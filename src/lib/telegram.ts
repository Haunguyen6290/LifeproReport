import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

function getAdmin() {
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function getAnon() {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/** Gửi Telegram server-side: đọc settings, check toggle, fetch Bot API. Không throw. */
export async function sendTelegram(eventKey: string, text: string) {
  try {
    const admin = getAdmin() ?? getAnon();
    if (!admin) return { ok: false, reason: 'no-supabase' };
    const { data } = await admin.from('settings').select('key, value').in('key', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', eventKey]);
    const m = new Map((data ?? []).map((r: any) => [r.key, r.value]));
    const token = String(m.get('TELEGRAM_BOT_TOKEN') ?? '').trim();
    const chatId = String(m.get('TELEGRAM_CHAT_ID') ?? '').trim();
    const toggle = String(m.get(eventKey) ?? 'FALSE').toUpperCase();
    if (!token || !chatId) return { ok: false, reason: 'not-configured' };
    if (toggle !== 'TRUE') return { ok: false, reason: 'disabled' };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = await res.json();
    return j;
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'error' };
  }
}

export function tgLink(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}
