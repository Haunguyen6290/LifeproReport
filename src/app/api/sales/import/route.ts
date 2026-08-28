import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { isAllowedName, mapSalesName, parseNumber, parseSalesSheet, saleMonthFromDate } from '@/lib/sales';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Chưa có file' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File quá lớn (tối đa 5MB)' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    let wb: XLSX.WorkBook;
    try { wb = XLSX.read(buf, { type: 'buffer' }); } catch { return NextResponse.json({ error: 'Không đọc được file Excel' }, { status: 400 }); }
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: 'File không có sheet' }, { status: 400 });
    const ws = wb.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }) as string[][];
    if (rows.length < 2) return NextResponse.json({ error: 'File trống' }, { status: 400 });

    let header: { headerRow: number; col: Record<string, number>; dataStart: number };
    try { header = parseSalesSheet(rows as any); } catch (e: any) { return NextResponse.json({ error: e?.message ?? 'Không tìm thấy tiêu đề' }, { status: 400 }); }

    const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: settingsRows } = await admin.from('settings').select('key, value').in('key', ['SALES_ALLOWED_NAMES', 'SALES_NAME_MAP']);
    const { allowed, nameMap } = parseSettings((settingsRows ?? []) as any);
    if (allowed.length === 0) return NextResponse.json({ error: 'Chưa cấu hình danh sách nhân viên được tính (SALES_ALLOWED_NAMES)' }, { status: 400 });

    const col = header.col;
    const dataRows = rows.slice(header.dataStart);
    let imported = 0;
    let skipped = 0;
    const toInsert: Record<string, unknown>[] = [];
    const seenMonths = new Set<string>();
    const khInFile = new Map<string, { ma_kh: string; ten_kh: string }>(); // dedup by ma_kh

    for (const r of dataRows) {
      const get = (k: string) => String(r[col[k]] ?? '').trim();
      const soCt = get('so_ct');
      const ngayRaw = get('ngay');
      // Skip empty rows (no so_ct and no ngay)
      if (!soCt && !ngayRaw) { skipped++; continue; }
      // Parse ngay: Excel may store as number (serial) or string
      let ngayStr = ngayRaw;
      const ngayCell = r[col['ngay']];
      if (typeof ngayCell === 'number' && ngayCell > 30000) {
        // Excel serial date
        const d = new Date(Math.round((ngayCell - 25569) * 86400 * 1000));
        ngayStr = d.toISOString().slice(0, 10);
      }
      // Validate date
      const d = new Date(ngayStr);
      if (isNaN(d.getTime())) { skipped++; continue; }
      const ngay = d.toISOString().slice(0, 10);

      const rawKd = col['kinh_doanh'] != null ? String(r[col['kinh_doanh']] ?? '').trim() : '';
      if (!isAllowedName(rawKd, allowed)) { skipped++; continue; }
      const kinhDoanh = mapSalesName(rawKd, nameMap);
      const saleMonth = saleMonthFromDate(ngay);
      if (!saleMonth) { skipped++; continue; }

      const rec = {
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
      seenMonths.add(saleMonth);
      const maKh = rec.ma_kh;
      if (maKh && !khInFile.has(maKh)) khInFile.set(maKh, { ma_kh: maKh, ten_kh: rec.ten_kh });
      imported++;
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ imported: 0, skipped, months: [], newCustomers: [], message: 'Không có dòng nào hợp lệ (đã lọc theo danh sách nhân viên)' });
    }

    const months = [...seenMonths].sort();

    // Delete old rows for those months, then insert
    for (const m of months) {
      const { error } = await admin.from('sales_rows').delete().eq('sale_month', m);
      if (error && !String(error.message).includes('not find')) {
        // If table doesn't exist, return clear error
        if (String(error.message).includes('not find') || String(error.code) === 'PGRST205') {
          return NextResponse.json({ error: 'Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase SQL Editor.' }, { status: 500 });
        }
      }
    }

    // Bulk insert in chunks
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

    // New customers warning: those ma_kh not in customers table
    let newCustomers: { ma_kh: string; ten_kh: string }[] = [];
    try {
      const { data: existing } = await admin.from('customers').select('ma_kh').limit(10000);
      const existingSet = new Set((existing ?? []).map((r: any) => String(r.ma_kh ?? '').trim()));
      for (const [maKh, info] of khInFile) {
        if (!existingSet.has(maKh)) newCustomers.push(info);
      }
    } catch {}

    return NextResponse.json({ imported, skipped, months, newCustomers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi import' }, { status: 500 });
  }
}
