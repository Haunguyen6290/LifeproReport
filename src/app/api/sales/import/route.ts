import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { isAllowedNameWithMap, mapSalesName, parseNumber, parseSalesSheet, saleMonthFromDate } from '@/lib/sales';

// Cho phép tiến trình kéo dài tới 60s (import + ghi nhiều tháng + tạo khách mới)
export const maxDuration = 60;

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
async function checkImportPerm(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
  if (!token) return false;
  const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: u } = await anon.auth.getUser(token);
  if (!u.user) return false;
  const { data: prof } = await admin().from('profiles').select('roles!inner(permissions)').eq('id', u.user.id).single();
  const perms = ((prof as any)?.roles?.permissions ?? []) as string[];
  return perms.includes('import_tai_chinh') || perms.includes('quan_ly_cai_dat') || perms.includes('import_khach');
}

function parseSettings(settings: { key: string; value: string }[]) {
  const map: Record<string, string> = {};
  for (const r of settings) map[r.key] = r.value;
  let allowed: string[] = [];
  let nameMap: Record<string, string> = {};
  try { allowed = JSON.parse(map.SALES_ALLOWED_NAMES ?? '[]'); } catch {}
  try { nameMap = JSON.parse(map.SALES_NAME_MAP ?? '{}'); } catch {}
  if (!Array.isArray(allowed)) allowed = [];
  if (typeof nameMap !== 'object' || Array.isArray(nameMap)) nameMap = {};
  return { allowed, nameMap };
}

type SalesRec = Record<string, unknown> & { sale_month: string };
type NewCust = { ma_kh: string; ten_kh: string; kinh_doanh: string; vung: string; dupNote: string; mergeTo?: string };

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

async function parseFile(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('File không có sheet');
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }) as string[][];
  if (rows.length < 2) throw new Error('File trống');
  const header = parseSalesSheet(rows as any);
  return { header, rows };
}

function prepareInsert(header: { col: Record<string, number>; dataStart: number }, rows: string[][], allowed: string[], nameMap: Record<string, string>) {
  const col = header.col;
  const dataRows = rows.slice(header.dataStart);
  let skipped = 0;
  const toInsert: SalesRec[] = [];
  // Theo khoảng ngày (min→max) của TỪNG tháng có trong file: khi ghi sẽ chỉ xóa đúng khoảng này,
  // nhờ vậy 1 tháng tách 2 file (nửa đầu / nửa cuối) không xóa mất dữ liệu của file kia.
  const monthInfo = new Map<string, { min: string; max: string; count: number }>();
  const khInFile = new Map<string, { ma_kh: string; ten_kh: string; kinh_doanh: string; vung: string }>();

  for (const r of dataRows) {
    const get = (k: string) => String(r[col[k]] ?? '').trim();
    const soCt = get('so_ct');
    const ngayRaw = get('ngay');
    if (!soCt && !ngayRaw) { skipped++; continue; }
    let ngayStr = ngayRaw;
    const ngayCell = r[col['ngay']];
    if (typeof ngayCell === 'number' && ngayCell > 30000) {
      const d = new Date(Math.round((ngayCell - 25569) * 86400 * 1000));
      ngayStr = d.toISOString().slice(0, 10);
    }
    const d = new Date(ngayStr);
    if (isNaN(d.getTime())) { skipped++; continue; }
    const ngay = d.toISOString().slice(0, 10);

    const rawKd = col['kinh_doanh'] != null ? String(r[col['kinh_doanh']] ?? '').trim() : '';
    if (!isAllowedNameWithMap(rawKd, allowed, nameMap)) { skipped++; continue; }
    const kinhDoanh = mapSalesName(rawKd, nameMap);
    const saleMonth = saleMonthFromDate(ngay);
    if (!saleMonth) { skipped++; continue; }

    const rec: SalesRec = {
      so_ct: soCt,
      ngay,
      sale_month: saleMonth,
      ma_vt: get('ma_vt'),
      ten_vt: get('ten_vt'),
      ma_kh: get('ma_kh'),
      ten_kh: get('ten_kh'),
      kinh_doanh_raw: rawKd,
      kinh_doanh: kinhDoanh,
      so_luong: col['so_luong'] != null ? parseNumber(r[col['so_luong']]) : null,
      don_gia: col['don_gia'] != null ? parseNumber(r[col['don_gia']]) : null,
      thanh_tien: col['thanh_tien'] != null ? parseNumber(r[col['thanh_tien']]) : 0,
      vung: get('vung'),
      hang_sx: get('hang_sx'),
      nhom_hang: get('nhom_hang'),
      ma_nv: get('ma_nv'),
    };
    toInsert.push(rec);
    const mi = monthInfo.get(saleMonth);
    if (!mi) monthInfo.set(saleMonth, { min: ngay, max: ngay, count: 1 });
    else { mi.count++; if (ngay < mi.min) mi.min = ngay; if (ngay > mi.max) mi.max = ngay; }
    const maKh = String(rec.ma_kh ?? '');
    if (maKh && !khInFile.has(maKh)) khInFile.set(maKh, { ma_kh: maKh, ten_kh: String(rec.ten_kh ?? ''), kinh_doanh: kinhDoanh, vung: String(rec.vung ?? '') });
  }

  return { toInsert, skipped, months: [...monthInfo.keys()].sort(), monthInfo, khInFile };
}

export async function POST(req: NextRequest) {
  if (!(await checkImportPerm(req))) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
  try {
    const form = await req.formData();
    const mode = String(form.get('mode') ?? 'preview'); // 'preview' | 'commit'
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Chưa có file' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File quá lớn (tối đa 5MB)' }, { status: 400 });

    let parsed;
    try { parsed = await parseFile(file); } catch (e: any) { return NextResponse.json({ error: e?.message ?? 'Không đọc được file' }, { status: 400 }); }

    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: settingsRows } = await admin.from('settings').select('key, value').in('key', ['SALES_ALLOWED_NAMES', 'SALES_NAME_MAP']);
    const { allowed, nameMap } = parseSettings((settingsRows ?? []) as any);
    if (allowed.length === 0) return NextResponse.json({ error: 'Chưa cấu hình danh sách nhân viên được tính (SALES_ALLOWED_NAMES)' }, { status: 400 });

    const { toInsert, skipped, months, monthInfo, khInFile } = prepareInsert(parsed.header, parsed.rows, allowed, nameMap);

    if (toInsert.length === 0) {
      return NextResponse.json({ preview: true, imported: 0, skipped, months: [], newCustomers: [], message: 'Không có dòng nào hợp lệ (đã lọc theo danh sách nhân viên)' });
    }

    // Compute new customers + duplicate-by-name warning (needed in both preview and commit)
    let newCustomers: NewCust[] = [];
    let toCreateCustomersAll: NewCust[] = [];
    try {
      const { data: existing } = await admin.from('customers').select('ma_kh, ten_kh').limit(10000);
      const existingSet = new Set((existing ?? []).map((r: any) => String(r.ma_kh ?? '').trim()));
      const existingByName = new Map<string, string>(); // norm ten_kh -> ma_kh
      for (const r of (existing ?? []) as { ma_kh: string; ten_kh: string }[]) {
        const nn = normName(String(r.ten_kh ?? ''));
        if (nn && !existingByName.has(nn)) existingByName.set(nn, r.ma_kh);
      }
      // Count normalized names among new customers (in-file duplicates)
      const nameCount = new Map<string, number>();
      const candidates: { ma_kh: string; ten_kh: string; kinh_doanh: string; vung: string }[] = [];
      for (const [maKh, info] of khInFile) {
        if (!existingSet.has(maKh)) {
          candidates.push(info);
          const nn = normName(info.ten_kh);
          nameCount.set(nn, (nameCount.get(nn) ?? 0) + 1);
        }
      }
      for (const c of candidates) {
        const nn = normName(c.ten_kh);
        let dupNote = '';
        let mergeTo: string | undefined;
        if (existingByName.has(nn)) { dupNote = `Trùng tên khách đã có (${existingByName.get(nn)})`; mergeTo = existingByName.get(nn)!; }
        else if ((nameCount.get(nn) ?? 0) > 1) dupNote = 'Trùng tên với khách khác trong file';
        const row: NewCust = { ma_kh: c.ma_kh, ten_kh: c.ten_kh, kinh_doanh: c.kinh_doanh, vung: c.vung, dupNote, mergeTo };
        newCustomers.push(row);
        toCreateCustomersAll.push(row);
      }
    } catch {}

    // PREVIEW: return summary without writing anything
    if (mode !== 'commit') {
      const byMonth: Record<string, number> = {};
      for (const r of toInsert) byMonth[r.sale_month] = (byMonth[r.sale_month] ?? 0) + 1;
      const monthRanges: Record<string, { min: string; max: string }> = {};
      for (const [m, v] of monthInfo) monthRanges[m] = { min: v.min, max: v.max };
      return NextResponse.json({
        preview: true,
        imported: toInsert.length,
        skipped,
        months,
        monthRanges,
        byMonth,
        newCustomers,
      });
    }

    // ===== COMMIT =====
    // Đọc lựa chọn của ông từ UI TRƯỚC: exclude (bỏ qua khách trùng) + merge (gộp mã lạ -> mã cũ)
    let excludeMa = new Set<string>();
    try { const arr = JSON.parse(String(form.get('exclude') ?? '[]')); if (Array.isArray(arr)) excludeMa = new Set(arr.map((v: unknown) => String(v))); } catch {}
    let mergeMap = new Map<string, string>();
    try { const obj = JSON.parse(String(form.get('merge') ?? '{}')); if (obj && typeof obj === 'object' && !Array.isArray(obj)) mergeMap = new Map(Object.entries(obj).map(([k, v]) => [String(k), String(v)])); } catch {}

    // Áp gộp mã KH vào dữ liệu TRƯỚC khi ghi (để sales_rows lưu đúng mã đã gộp)
    let mergedCustomers = 0;
    if (mergeMap.size > 0) {
      for (const rec of toInsert) {
        const mk = String((rec as any).ma_kh ?? '');
        if (mergeMap.has(mk)) { (rec as any).ma_kh = mergeMap.get(mk)!; mergedCustomers++; }
      }
    }

    // Chỉ xóa dữ liệu đúng khoảng ngày có trong file cho từng tháng — nhờ vậy 1 tháng tách 2 file không xóa mất dữ liệu của file kia.
    for (const m of months) {
      const mi = monthInfo.get(m)!;
      const { error } = await admin.from('sales_rows').delete().eq('sale_month', m).gte('ngay', mi.min).lte('ngay', mi.max);
      if (error) {
        if (String(error.message).includes('not find') || String(error.code) === 'PGRST205') {
          return NextResponse.json({ error: 'Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase SQL Editor.' }, { status: 500 });
        }
      }
    }

    const chunk = 500;
    for (let i = 0; i < toInsert.length; i += chunk) {
      const part = toInsert.slice(i, i + chunk);
      const { error } = await admin.from('sales_rows').insert(part as any);
      if (error) {
        if (String(error.message).includes('not find') || String(error.code) === 'PGRST205') {
          return NextResponse.json({ error: 'Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase SQL Editor.' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Lỗi ghi DB: ' + error.message }, { status: 500 });
      }
    }

    // Tự tạo khách mới (bỏ qua khách đã loại/đã gộp) — ghi THEO LÔ để nhanh, tránh hết thời gian chờ
    let createdCustomers = 0;
    try {
      const toCreateFiltered = toCreateCustomersAll.filter((c) => !excludeMa.has(c.ma_kh) && !mergeMap.has(c.ma_kh));
      if (toCreateFiltered.length > 0) {
        const { data: profiles } = await admin.from('profiles').select('id, full_name');
        const nameToId = new Map<string, string>();
        for (const p of (profiles ?? []) as { id: string; full_name: string }[]) {
          nameToId.set(p.full_name.trim().toLowerCase(), p.id);
        }
        const rows = toCreateFiltered
          .map((c) => {
            const pid = nameToId.get(c.kinh_doanh.trim().toLowerCase());
            if (!pid) return null;
            return { ma_kh: c.ma_kh, ten_kh: c.ten_kh, assigned_to: pid, tinh_thanh: c.vung || '' };
          })
          .filter(Boolean) as { ma_kh: string; ten_kh: string; assigned_to: string; tinh_thanh: string }[];
        if (rows.length > 0) {
          const { error } = await admin.from('customers').insert(rows as any);
          if (!error) {
            createdCustomers = rows.length;
          } else {
            // Fallback: nếu ghi lô lỗi (vd trùng mã), thử từng dòng để không mất toàn bộ
            for (const row of rows) {
              const { error: e2 } = await admin.from('customers').insert(row as any);
              if (!e2) createdCustomers++;
            }
          }
        }
      }
    } catch {}

    const monthRanges: Record<string, { min: string; max: string }> = {};
    for (const [m, v] of monthInfo) monthRanges[m] = { min: v.min, max: v.max };
    return NextResponse.json({ imported: toInsert.length, skipped, months, monthRanges, newCustomers, createdCustomers, mergedCustomers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi import' }, { status: 500 });
  }
}
