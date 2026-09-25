import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(SUPA_URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

async function checkPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('quan_ly_cai_dat') || perms.includes('ke_toan') || perms.includes('xem_tai_chinh');
}

// Tong hop: A(1)=ma_thuc, L(12)=sl_kha_dung ; TK: B(2)=ma_thue, C3=ten, D4=sl, F6=gia, G7=vat
function parseTongHop(raw: unknown[][]): { ma: string; sl: number }[] {
  const out: { ma: string; sl: number }[] = [];
  // header row 7 has "1,2,12" markers, data from row 9 (index 8) - be flexible: start at row 8 (1-indexed 9)
  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] as any[];
    if (!row) continue;
    // skip header rows where col A is like "'Mã số'" or "1" or empty
    const a = row[0] != null ? String(row[0]).replace(/^'/, '').trim() : '';
    if (!a || a === 'Mã số' || a === '1' || a === 'LIFE PRO' || a.toLowerCase().includes('tổng')) continue;
    // also skip row with col1 = null but row7 style
    if (r < 7) continue;
    const slRaw = row[11]; // L = index 11
    const sl = slRaw == null || slRaw === '' ? 0 : Number(String(slRaw).replace(/,/g, ''));
    if (!a) continue;
    out.push({ ma: a, sl: isNaN(sl) ? 0 : sl });
  }
  return out;
}

function parseTK(raw: unknown[][]): { ma: string; ten: string; sl: number; gia: number; vat: number }[] {
  const out: { ma: string; ten: string; sl: number; gia: number; vat: number }[] = [];
  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] as any[];
    if (!row) continue;
    if (r < 3) continue; // header rows 1-3
    const b = row[1] != null ? String(row[1]).replace(/^'/, '').trim() : '';
    if (!b || b === 'Mã') continue;
    const ten = row[2] != null ? String(row[2]).replace(/^'/, '').trim() : '';
    const sl = Number(row[3] ?? 0);
    const gia = Math.round(Number(row[5] ?? 0));
    const vatRaw = row[6] != null ? String(row[6]).replace(/^'/, '').trim() : '10';
    const vat = parseInt(vatRaw, 10);
    const vatNorm = [0, 5, 8, 10].includes(vat) ? vat : 10;
    out.push({ ma: b, ten, sl: isNaN(sl) ? 0 : sl, gia: isNaN(gia) ? 0 : gia, vat: vatNorm });
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!(await checkPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const kind = String(form.get('kind') ?? '').trim(); // 'thue' | 'thuc'
    const ngay = String(form.get('ngay') ?? new Date().toISOString().slice(0, 10)).trim();
    if (!file) return NextResponse.json({ error: 'Chưa có file' }, { status: 400 });
    if (!['thue', 'thuc'].includes(kind)) return NextResponse.json({ error: 'kind phải là thue/thuc' }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'File quá lớn (>15MB)' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    if (!buf.length) return NextResponse.json({ error: 'File rỗng' }, { status: 400 });
    let wb: XLSX.WorkBook;
    try { wb = XLSX.read(buf, { type: 'buffer' }); } catch { return NextResponse.json({ error: 'Không đọc được file Excel' }, { status: 400 }); }
    if (!wb.SheetNames.length) return NextResponse.json({ error: 'File không có sheet' }, { status: 400 });
    const sheetName = wb.SheetNames[0];
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
    if (!raw.length) return NextResponse.json({ error: 'Sheet rỗng' }, { status: 400 });
    const db = admin();

    if (kind === 'thue') {
      const rows = parseTK(raw);
      if (!rows.length) return NextResponse.json({ error: 'Không đọc được dòng nào từ file tồn thuế' }, { status: 400 });
      // upsert dm_thue (có rồi bỏ qua cap, cập nhật ten/gia/vat nếu trống)
      for (const r of rows) {
        const { data: ex } = await db.from('dm_thue').select('ma_thue').eq('ma_thue', r.ma).maybeSingle();
        if (!ex) await (db as any).from('dm_thue').insert({ ma_thue: r.ma, ten_thue: r.ten, gia_chua_vat: r.gia, vat: r.vat });
        else await (db as any).from('dm_thue').update({ ten_thue: r.ten, gia_chua_vat: r.gia, vat: r.vat, updated_at: new Date().toISOString() }).eq('ma_thue', r.ma);
      }
      await db.from('ton_thue_ngay').delete().eq('ngay', ngay);
      const toIns = rows.map((r) => ({ ngay, ma_thue: r.ma, sl_ton: r.sl, gia_chua_vat: r.gia, vat: r.vat }));
      for (let i = 0; i < toIns.length; i += 1000) {
        const { error } = await (db as any).from('ton_thue_ngay').insert(toIns.slice(i, i + 1000));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      // missing Cap1
      const { data: miss } = await db.from('dm_thue').select('ma_thue,ten_thue,cap1,cap2').or('cap1.is.null,cap1.eq.');
      const caps = await db.from('dm_thue').select('cap1,cap2');
      const capList = [...new Set(((caps.data ?? []) as any[]).flatMap((r) => [r.cap1, r.cap2]).filter(Boolean))].sort();
      return NextResponse.json({ ok: true, kind, ngay, soDong: rows.length, missing: (miss as any[])?.filter((r: any) => !String(r.cap1 ?? '').trim()) ?? [], capList });
    } else {
      const rows = parseTongHop(raw);
      if (!rows.length) return NextResponse.json({ error: 'Không đọc được dòng nào từ file tồn thực' }, { status: 400 });
      for (const r of rows) {
        const { data: ex } = await db.from('dm_thuc').select('ma_thuc').eq('ma_thuc', r.ma).maybeSingle();
        if (!ex) await (db as any).from('dm_thuc').insert({ ma_thuc: r.ma, ten_thuc: r.ma });
      }
      await db.from('ton_thuc_ngay').delete().eq('ngay', ngay);
      const toIns = rows.map((r) => ({ ngay, ma_thuc: r.ma, sl_kha_dung: r.sl }));
      for (let i = 0; i < toIns.length; i += 1000) {
        const { error } = await (db as any).from('ton_thuc_ngay').insert(toIns.slice(i, i + 1000));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: miss } = await db.from('dm_thuc').select('ma_thuc,ten_thuc,cap1,cap2').or('cap1.is.null,cap1.eq.');
      const caps = await db.from('dm_thue').select('cap1,cap2');
      const capList = [...new Set(((caps.data ?? []) as any[]).flatMap((r) => [r.cap1, r.cap2]).filter(Boolean))].sort();
      return NextResponse.json({ ok: true, kind, ngay, soDong: rows.length, missing: (miss as any[])?.filter((r: any) => !String(r.cap1 ?? '').trim()) ?? [], capList });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi' }, { status: 500 });
  }
}
