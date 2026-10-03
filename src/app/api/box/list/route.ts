import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return { ok: false };
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return { ok: false };
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  const ok = perms.includes('xem_box') || perms.includes('quan_ly_cai_dat');
  return { ok, userId: u.user.id };
}

export async function GET(req: NextRequest) {
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const pageRaw = parseInt(sp.get('page') || '1', 10);
  const limitRaw = parseInt(sp.get('limit') || '50', 10);
  const searchRaw = sp.get('search') || '';
  const activated = sp.get('activated'); // 'true' | 'false' | null (all)

  // Validate pagination
  const page = Math.max(isNaN(pageRaw) ? 1 : pageRaw, 1);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 50 : limitRaw, 1), 100);

  // Validate and sanitize search - only allow alphanumeric, spaces, dash, underscore, dot
  const search = searchRaw.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();

  const db = admin();
  let query = db.from('boxes').select('*', { count: 'exact' });

  // Filter by activated
  if (activated === 'true') query = query.eq('is_activated', true);
  if (activated === 'false') query = query.eq('is_activated', false);

  // Search - escape special PostgREST characters in ilike pattern
  if (search) {
    const e = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '\\,').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    query = query.or(`serial_number.ilike.%${e}%`);
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.order('first_seen_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    boxes: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
