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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  const db = admin();
  const { data, error } = await db.from('boxes').select('*').eq('id', id).single();

  if (error) {
    console.error('DB error fetching box:', error);
    return NextResponse.json({ error: 'Lỗi truy vấn dữ liệu' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Không tìm thấy box' }, { status: 404 });

  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const perm = await checkPerm(req);
  if (!perm.ok) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });

  try {
    const body = await req.json();

    // Các field cho phép cập nhật từ dashboard
    const allowedFields = [
      'box_name', 'customer_name', 'customer_phone', 'customer_address',
      'vehicle_info', 'dealer_name', 'installation_date',
      'status', 'warranty_until', 'notes', 'metadata'
    ];

    const updates: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Không có dữ liệu để cập nhật' }, { status: 400 });
    }

    // Validate metadata nếu có
    if (updates.metadata) {
      if (typeof updates.metadata !== 'object' || Array.isArray(updates.metadata) || updates.metadata === null) {
        return NextResponse.json({ error: 'metadata phải là object' }, { status: 400 });
      }
      const metadataStr = JSON.stringify(updates.metadata);
      if (metadataStr.length > 50_000) {
        return NextResponse.json({ error: 'metadata quá lớn (max 50KB)' }, { status: 400 });
      }
    }

    // Validate status
    if (updates.status) {
      const validStatuses = ['active', 'inactive', 'warranty', 'returned', 'defective'];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json({ error: `status không hợp lệ. Phải là: ${validStatuses.join(', ')}` }, { status: 400 });
      }
    }

    const db = admin();
    const { data, error } = await db
      .from('boxes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('DB error updating box:', error);
      return NextResponse.json({ error: 'Lỗi cập nhật dữ liệu' }, { status: 500 });
    }

    return NextResponse.json({ success: true, box: data });
  } catch (e: any) {
    console.error('Error in PUT /api/box/[id]:', e);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
