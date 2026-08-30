import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createAnon } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Ghi lại câu hỏi bot không trả lời được (score < ngưỡng) để bổ sung QA sau. Bắt buộc đăng nhập. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { query?: unknown; context?: unknown };
  const query = String(body.query ?? '').trim().slice(0, 200);
  const context = String(body.context ?? '').trim().slice(0, 200);
  if (!query) return NextResponse.json({ error: 'query rỗng' }, { status: 400 });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  const anon = createAnon(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await anon.auth.getUser(token);
  const userId = data?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('chatbot_queries').insert({ user_id: userId, query, context });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
