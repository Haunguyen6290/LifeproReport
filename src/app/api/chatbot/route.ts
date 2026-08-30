import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapContextToPhanHe } from '@/lib/chatbot/context';
import { rankQA } from '@/lib/chatbot/search';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 200) {
    return NextResponse.json({ error: 'q rỗng hoặc quá dài (1–200 ký tự)' }, { status: 400 });
  }
  const contextPath = req.nextUrl.searchParams.get('context') ?? '';
  const rawLimit = req.nextUrl.searchParams.get('limit') ?? '3';
  const limit = Math.min(5, Math.max(1, parseInt(rawLimit, 10) || 3));
  const phanHe = contextPath ? mapContextToPhanHe(contextPath) : null;

  const admin = createAdminClient();
  const { data, error } = await admin.from('chatbot_qa').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { matches, suggestions } = rankQA((data ?? []) as any, q, phanHe, limit);
  return NextResponse.json({
    matches: matches.map((m) => ({ ...m.qa, score: m.score })),
    suggestions,
    context: phanHe,
  });
}
