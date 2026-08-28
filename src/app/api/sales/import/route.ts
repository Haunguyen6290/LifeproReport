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

type SalesRec = Record<string, unknown> & { sale_month: string };
type NewCust = { ma_kh: string; ten_kh: string; kinh_doanh: string; vung: string; dupNote: string };

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
  const seenMonths = new Set<string>();
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
    if (!isAllowedName(rawKd, allowed)) { skipped++; continue; }
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
    seenMonths.add(saleMonth);
    const maKh = String(rec.ma_kh ?? '');
    if (maKh && !khInFile.has(maKh)) khInFile.set(maKh, { ma_kh: maKh, ten_kh: String(rec.ten_kh ?? ''), kinh_doanh: kinhDoanh, vung: String(rec.vung ?? '') });
  }

  return { toInsert, skipped, months: [...seenMonths].sort(), khInFile };
}

export async function POST(req: NextRequest) {
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

    const { toInsert, skipped, months, khInFile } = prepareInsert(parsed.header, parsed.rows, allowed, nameMap);

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
        if (existingByName.has(nn)) dupNote = `Trùng tên khách đã có (${existingByName.get(nn)})`;
        else if ((nameCount.get(nn) ?? 0) > 1) dupNote = 'Trùng tên với khách khác trong file';
        const row: NewCust = { ma_kh: c.ma_kh, ten_kh: c.ten_kh, kinh_doanh: c.kinh_doanh, vung: c.vung, dupNote };
        newCustomers.push(row);
        toCreateCustomersAll.push(row);
      }
    } catch {}

    // PREVIEW: return summary without writing anything
    if (mode !== 'commit') {
      const byMonth: Record<string, number> = {};
      for (const r of toInsert) byMonth[r.sale_month] = (byMonth[r.sale_month] ?? 0) + 1;
      return NextResponse.json({
        preview: true,
        imported: toInsert.length,
        skipped,
        months,
        byMonth,
        newCustomers,
      });
    }

    // COMMIT: delete old rows for months, then insert
    for (const m of months) {
      const { error } = await admin.from('sales_rows').delete().eq('sale_month', m);
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

    // Auto-create missing customers (respect exclude list from UI preview)
    let createdCustomers = 0;
    try {
      const excludeRaw = String(form.get('exclude') ?? '[]');
      let excludeMa = new Set<string>();
      try { const arr = JSON.parse(excludeRaw); if (Array.isArray(arr)) excludeMa = new Set(arr.map((v: unknown) => String(v))); } catch {}
      const toCreateFiltered = toCreateCustomersAll.filter((c) => !excludeMa.has(c.ma_kh));
      if (toCreateFiltered.length > 0) {
        const { data: profiles } = await admin.from('profiles').select('id, full_name');
        const nameToId = new Map<string, string>();
        for (const p of (profiles ?? []) as { id: string; full_name: string }[]) {
          nameToId.set(p.full_name.trim().toLowerCase(), p.id);
        }
        for (const c of toCreateFiltered) {
          const pid = nameToId.get(c.kinh_doanh.trim().toLowerCase());
          if (!pid) continue;
          const { error: insErr } = await admin.from('customers').insert({
            ma_kh: c.ma_kh,
            ten_kh: c.ten_kh,
            assigned_to: pid,
            tinh_thanh: c.vung || '',
          } as any);
          if (!insErr) createdCustomers++;
        }
      }
    } catch {}

    return NextResponse.json({ imported: toInsert.length, skipped, months, newCustomers, createdCustomers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi import' }, { status: 500 });
  }
}
