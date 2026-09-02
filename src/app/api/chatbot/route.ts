import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rankQA } from '@/lib/chatbot/search';
import { loadAIConfig, askAI } from '@/lib/chatbot/ai';
import { loadBotConfig, phanHeChoDuongDan } from '@/lib/troly-config';

async function phanHeChoReq(admin: ReturnType<typeof createAdminClient>, contextPath: string): Promise<string[] | null> {
  try {
    const cfg = await loadBotConfig(admin as unknown as any);
    const ph = phanHeChoDuongDan(contextPath, cfg.phanHe);
    return ph.length ? ph : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 200) {
    return NextResponse.json({ error: 'q rỗng hoặc quá dài (1–200 ký tự)' }, { status: 400 });
  }
  const contextPath = req.nextUrl.searchParams.get('context') ?? '';
  const rawLimit = req.nextUrl.searchParams.get('limit') ?? '3';
  const limit = Math.min(5, Math.max(1, parseInt(rawLimit, 10) || 3));

  const admin = createAdminClient();
  const phanHe = contextPath ? await phanHeChoReq(admin, contextPath) : null;

  const { data, error } = await admin.from('chatbot_qa').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { matches, suggestions } = rankQA((data ?? []) as any, q, phanHe, limit);
  return NextResponse.json({
    matches: matches.map((m) => ({ ...m.qa, score: m.score })),
    suggestions,
    context: phanHe,
  });
}

/** POST — widget chat: rankQA top 5 → Haiku chọn id / trả lời nâng cao → fallback rankQA. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    q?: unknown; context?: unknown; messages?: unknown; aiUsed?: unknown;
  };
  const q = String(body.q ?? '').trim().slice(0, 200);
  if (!q) return NextResponse.json({ error: 'q rỗng' }, { status: 400 });
  const contextPath = String(body.context ?? '');
  const history = (Array.isArray(body.messages) ? body.messages : []).slice(-6)
    .filter((m: any) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 300) }));
  const aiUsed = Math.max(0, Math.min(50, parseInt(String(body.aiUsed ?? '0'), 10) || 0));

  const admin = createAdminClient();
  const { data, error } = await admin.from('chatbot_qa').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const phanHe = contextPath ? await phanHeChoReq(admin, contextPath) : null;
  const { matches } = rankQA((data ?? []) as any, q, phanHe, 5);
  const rows = (data ?? []) as any[];

  const cfg = await loadAIConfig(admin);
  if (cfg.enabled && cfg.key) {
    const candidates = matches.length ? matches : rankQA(rows, q, null, 5).matches;
    const answer = await askAI(cfg, q, candidates.map((c) => ({ id: c.qa.id, cau_hoi: c.qa.cau_hoi })), history, aiUsed);
    if (answer?.type === 'qa') {
      const qa = rows.find((r) => r.id === answer.id);
      if (qa) return NextResponse.json({ kind: 'qa', qa });
    } else if (answer?.type === 'ai') {
      return NextResponse.json({ kind: 'ai', text: answer.text });
    } else if (answer?.type === 'limit') {
      return NextResponse.json({ kind: 'limit' });
    }
    // answer === null (lỗi/mạng/parse fail) hoặc 'off' → fallback về rankQA bên dưới
  }

  // Chế độ keyword thuần / AI tắt / AI lỗi → trả kết quả rankQA như cũ
  if (matches.length) return NextResponse.json({ kind: 'qa', qa: matches[0].qa });
  const fallback = rankQA(rows, q, null, 1);
  if (fallback.matches.length) return NextResponse.json({ kind: 'qa', qa: fallback.matches[0].qa });
  return NextResponse.json({ kind: 'miss' });
}
