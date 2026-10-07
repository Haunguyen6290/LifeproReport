import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { loadCoVanConfig } from '@/lib/co-van/config';
import { buildChatSystem } from '@/lib/co-van/prompt';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat');
}

export async function GET(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('co_van_tin_nhan').select('id, vai_tro, noi_dung, kenh, created_at').order('created_at', { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const q = String(body.q ?? body.content ?? '').trim().slice(0, 2000);
  if (!q) return NextResponse.json({ error: 'Nội dung trống' }, { status: 400 });

  const admin = createAdminClient() as any;
  const cfg = await loadCoVanConfig(admin);

  if (!cfg.ai.key) return NextResponse.json({ error: 'Chưa cấu hình AI_KEY trong Cài đặt' }, { status: 400 });

  // Lưu tin nhắn của ông
  await admin.from('co_van_tin_nhan').insert({ vai_tro: 'user', noi_dung: q, kenh: 'web' });

  // Lấy lịch sử gần đây + tóm tắt đánh giá gần đây để làm context
  const { data: recent } = await admin.from('co_van_danh_gia').select('loai, ket_qua, ly_do, dau_hieu_doi_pho, tuan_tu, user_id').order('created_at', { ascending: false }).limit(20);
  const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', ((recent ?? []) as any[]).map((r) => r.user_id).filter(Boolean));
  const nameById = new Map(((profs ?? []) as any[]).map((p) => [p.id, p.full_name]));
  const summary = ((recent ?? []) as any[]).map((r) => `${r.loai}/${r.ket_qua} — ${nameById.get(r.user_id) ?? r.user_id} tuần ${r.tuan_tu}: ${r.ly_do.slice(0, 120)}${r.dau_hieu_doi_pho ? ` | Dấu hiệu: ${r.dau_hieu_doi_pho.slice(0, 80)}` : ''}`).join('\n');

  const { data: history } = await admin.from('co_van_tin_nhan').select('vai_tro, noi_dung').order('created_at', { ascending: false }).limit(12);
  const histOrdered = (((history ?? []) as any[]).reverse()).filter((m) => m.vai_tro !== 'system').map((m) => ({ role: m.vai_tro as 'user' | 'assistant', content: m.noi_dung.slice(0, 1000) }));

  const system = buildChatSystem(cfg.ai.brief, cfg.extraInstructions);
  const contextBlock = summary ? `\n\nDỮ LIỆU CHẤM GẦN ĐÂY (để trả lời có số liệu):\n${summary.slice(0, 4000)}` : '';

  try {
    const client = new Anthropic({
      apiKey: cfg.ai.key,
      ...(cfg.ai.endpoint ? { baseURL: cfg.ai.endpoint.replace(/\/+$/, '').replace(/\/v1\/messages$/i, '') } : {}),
      timeout: 30_000,
      maxRetries: 0,
    });
    const res = await client.messages.create({
      model: cfg.ai.model,
      max_tokens: 1500,
      temperature: 0.3,
      system: system + contextBlock,
      messages: [...histOrdered.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam), { role: 'user' as const, content: q }],
    });
    const text = res.content.find((b) => b.type === 'text')?.text?.trim() ?? '';
    if (!text) return NextResponse.json({ error: 'AI không trả về' }, { status: 500 });
    const clean = text.slice(0, 4000);
    await admin.from('co_van_tin_nhan').insert({ vai_tro: 'assistant', noi_dung: clean, kenh: 'web' });
    return NextResponse.json({ ok: true, text: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi AI' }, { status: 500 });
  }
}
