import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parseOpeningSheet, ngayTruocMoc } from '@/lib/opening-balance';
import { customerPatch, makeUserFinder } from '@/lib/customer-patch';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function currentAdmin(req: NextRequest): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return null;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return null;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat') ? u.user.id : null;
}

async function fetchAll(table: string, cols: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin().from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

/**
 * POST form-data: file, ngayMoc (YYYY-MM-DD), mode = preview | commit
 * Ghi đè TOÀN BỘ số dư đầu kỳ bằng file, đặt ngày mốc, và thêm/cập nhật danh sách khách hàng.
 */
export async function POST(req: NextRequest) {
  const uid = await currentAdmin(req);
  if (!uid) return NextResponse.json({ error: 'Không có quyền (cần Quản lý cài đặt)' }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const ngayMoc = String(form.get('ngayMoc') ?? '').trim();
    const mode = String(form.get('mode') ?? 'preview');
    if (!file) return NextResponse.json({ error: 'Chưa chọn file' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngayMoc)) return NextResponse.json({ error: 'Chưa chọn ngày mốc' }, { status: 400 });

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true });
    const table = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as unknown[][];
    const parsed = parseOpeningSheet(table);
    if (parsed.thieuCot.length) return NextResponse.json({ error: `File thiếu cột: ${parsed.thieuCot.join(', ')}. Dùng file mẫu để điền.` }, { status: 400 });
    if (!parsed.rows.length) return NextResponse.json({ error: 'Không có dòng hợp lệ nào', errors: parsed.errors }, { status: 400 });

    const db = admin();
    const khCu = await fetchAll('customers', 'id, ma_kh, ten_kh');
    const byMa = new Map<string, { ma_kh: string; ten_kh: string }>();
    for (const k of khCu) byMa.set(String(k.ma_kh).trim().toLowerCase(), k);

    const moi: typeof parsed.rows = [];
    const doiTen: { ma_kh: string; ten_cu: string; ten_moi: string }[] = [];
    const daCo: { row: (typeof parsed.rows)[number]; maDb: string }[] = [];
    for (const r of parsed.rows) {
      const cu = byMa.get(r.ma_kh.toLowerCase());
      if (!cu) { moi.push(r); continue; }
      daCo.push({ row: r, maDb: cu.ma_kh });
      if (cu.ten_kh.trim() !== r.ten_kh) doiTen.push({ ma_kh: cu.ma_kh, ten_cu: cu.ten_kh, ten_moi: r.ten_kh });
    }

    const tongNo = parsed.rows.reduce((a, r) => a + (r.du_no > 0 ? r.du_no : 0), 0);
    const tongCo = parsed.rows.reduce((a, r) => a + (r.du_no < 0 ? -r.du_no : 0), 0);
    const canhBao: string[] = [];
    const { count: soCtTruocMoc } = await db.from('receivable_rows').select('id', { count: 'exact', head: true }).lt('ngay', ngayMoc);
    if ((soCtTruocMoc ?? 0) > 0) canhBao.push(`Hệ thống đang có ${soCtTruocMoc} chứng từ 131 trước ngày mốc — báo cáo công nợ sẽ cộng thêm số này. Nên xóa chứng từ trước mốc (nút bên dưới) sau khi import.`);
    const { count: soDuCu } = await db.from('customer_base_balance').select('ma_kh', { count: 'exact', head: true });
    if ((soDuCu ?? 0) > 0) canhBao.push(`Số dư đầu kỳ cũ (${soDuCu} khách) sẽ bị XÓA và thay bằng file này.`);

    const tomTat = {
      ngayMoc, ngaySoDu: ngayTruocMoc(ngayMoc),
      soKhach: parsed.rows.length, khachMoi: moi.length, khachDaCo: daCo.length,
      tongNo, tongCo, soDu: tongNo - tongCo,
      doiTen, errors: parsed.errors, canhBao,
    };
    if (mode !== 'commit') return NextResponse.json({ preview: true, ...tomTat });

    // ===== COMMIT =====
    const [users, cat] = await Promise.all([
      fetchAll('profiles', 'id, username, full_name'),
      db.from('categories').select('category_items(id,name)').eq('slug', 'trang_thai_kh').maybeSingle(),
    ]);
    const statusByName = new Map<string, string>(((cat.data as any)?.category_items ?? []).map((i: any) => [i.name, i.id]));
    const lk = { findUserId: makeUserFinder(users), findStatusId: (n: string) => statusByName.get(n) ?? null };
    const now = new Date().toISOString();

    // 1) Khách mới
    let themKhach = 0;
    const insertKh = moi.map((r) => ({
      ...customerPatch(r.extra, lk),
      ma_kh: r.ma_kh, ten_kh: r.ten_kh,
      assigned_to: lk.findUserId(r.extra.KinhDoanh ?? '') ?? uid,
      created_by: uid, updated_by: uid,
    }));
    for (let i = 0; i < insertKh.length; i += 500) {
      const { error } = await db.from('customers').insert(insertKh.slice(i, i + 500));
      if (error) return NextResponse.json({ error: 'Lỗi thêm khách: ' + error.message }, { status: 500 });
      themKhach += Math.min(500, insertKh.length - i);
    }

    // 2) Khách đã có: lấy tên theo file kế toán + các cột có dữ liệu
    let capNhatKhach = 0;
    for (const { row, maDb } of daCo) {
      const patch = customerPatch(row.extra, lk);
      const doi = row.ten_kh !== byMa.get(maDb.toLowerCase())?.ten_kh.trim();
      if (!doi && !Object.keys(patch).length) continue;
      const { error } = await db.from('customers').update({ ...patch, ten_kh: row.ten_kh, updated_by: uid, updated_at: now }).eq('ma_kh', maDb);
      if (error) return NextResponse.json({ error: `Lỗi cập nhật khách ${maDb}: ${error.message}` }, { status: 500 });
      capNhatKhach++;
    }

    // 3) Ghi đè số dư đầu kỳ (nguyên tử qua RPC — xóa + chèn trong 1 transaction)
    const maDung = new Map(daCo.map((d) => [d.row.ma_kh, d.maDb]));
    const soDu = parsed.rows.map((r) => ({ ma_kh: maDung.get(r.ma_kh) ?? r.ma_kh, ten_kh: r.ten_kh, du_no: r.du_no }));
    const { error: rpcErr } = await db.rpc('replace_customer_base_balances' as any, { p_rows: soDu as any, p_ngay_moc: ngayMoc } as any);
    if (rpcErr) {
      const missing = rpcErr.message?.includes('does not exist') || rpcErr.message?.includes('Could not find');
      if (!missing) return NextResponse.json({ error: 'Lỗi ghi số dư: ' + rpcErr.message }, { status: 500 });
      // Fallback nếu migration 0069 chưa chạy: xóa toàn bộ rồi chèn lại (không nguyên tử — sẽ hết khi RPC có)
      const { error: delErr } = await db.from('customer_base_balance').delete().not('ma_kh', 'is', null);
      if (delErr) return NextResponse.json({ error: 'Lỗi xóa số dư cũ: ' + delErr.message }, { status: 500 });
      for (let i = 0; i < soDu.length; i += 1000) {
        const chunk = soDu.map((r) => ({ ...r, ngay_moc: ngayMoc, updated_at: now })).slice(i, i + 1000);
        const { error } = await db.from('customer_base_balance').insert(chunk);
        if (error) return NextResponse.json({ error: 'Lỗi ghi số dư: ' + error.message + ' — số dư cũ đã xóa, cần import lại file.' }, { status: 500 });
      }
      await db.from('settings').upsert({ key: 'DEBT_BASE_DATE', value: ngayMoc, updated_by: uid }, { onConflict: 'key' });
    }

    try {
      const { data: me } = await db.from('profiles').select('full_name').eq('id', uid).single();
      await db.from('audit_logs').insert({ actor_id: uid, action: 'Import số dư đầu kỳ', entity_type: 'receivable', entity_id: null, details: { ngayMoc, soKhach: soDu.length, themKhach, capNhatKhach, soDu: tomTat.soDu, full_name: (me as any)?.full_name ?? '' } });
    } catch {}

    return NextResponse.json({ preview: false, ...tomTat, themKhach, capNhatKhach });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi không xác định' }, { status: 500 });
  }
}
