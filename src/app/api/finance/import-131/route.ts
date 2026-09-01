import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parseTk131Sheet, parseDataKHSheet, type RcvRow } from '@/lib/receivable-import';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

function findSheet(names: string[]): string | null {
  const cands = names.filter((n) => /131|tai_khoan/i.test(n) && !/helper/i.test(n));
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) return cands.sort((a, b) => b.length - a.length)[0]; // ưu tiên "Tai_khoan_131" hơn "131"
  return null; // không tự đoán sheet khác — bắt ông chủ biết rõ đang import gì
}

function kiemTraCanDoi(rows: RcvRow[], soDuDauKy: number, coDauKy: boolean) {
  const sumNo = rows.reduce((a, r) => a + r.so_no, 0);
  const sumCo = rows.reduce((a, r) => a + r.so_co, 0);
  const duCuoi = rows[rows.length - 1].du_dong;
  if (!coDauKy || duCuoi == null) return { ok: true, chiTiet: 'Thiếu mốc đối chiếu (không có dòng số dư đầu kỳ / cuối sổ) — bỏ qua' };
  const tinhRa = soDuDauKy + sumNo - sumCo;
  const ok = Math.abs(tinhRa - duCuoi) < 1;
  return {
    ok,
    chiTiet: `Đầu kỳ ${soDuDauKy.toLocaleString('vi-VN')} + Nợ ${sumNo.toLocaleString('vi-VN')} − Có ${sumCo.toLocaleString('vi-VN')} = ${tinhRa.toLocaleString('vi-VN')}${ok ? '' : ` (cuối sổ ${duCuoi.toLocaleString('vi-VN')})`}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const mode = String(form.get('mode') ?? 'preview');
    if (!file) return NextResponse.json({ error: 'Chưa có file' }, { status: 400 });

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const sheetName = findSheet(wb.SheetNames);
    if (!sheetName) return NextResponse.json({ error: `Không tìm thấy sheet TK131 trong file (có: ${wb.SheetNames.join(', ')})` }, { status: 400 });
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
    const { header, rows } = parseTk131Sheet(raw);
    if (rows.length === 0) return NextResponse.json({ error: 'Không đọc được dòng phát sinh nào — kiểm tra file có phải sổ chi tiết TK131 không' }, { status: 400 });

    const minNgay = header.tuNgay || rows.reduce((m, r) => (r.ngay < m ? r.ngay : m), rows[0].ngay);
    const maxNgay = header.denNgay || rows.reduce((m, r) => (r.ngay > m ? r.ngay : m), rows[rows.length - 1].ngay);

    const kiemTra: { ten: string; ok: boolean; chiTiet: string }[] = [];
    const canhBao: string[] = [];

    // K1: cân đối nội bộ vùng trong file
    const k1 = kiemTraCanDoi(rows, header.soDuDauKy, header.coDauKy);
    kiemTra.push({ ten: 'Cân đối nội bộ sổ', ok: k1.ok, chiTiet: k1.chiTiet });

    // K3: nếu file có DataKH kèm dư nợ đầu kỳ → tổng theo khách phải bằng đầu kỳ toàn công ty
    const dkhSheet = wb.SheetNames.find((n) => /datakh|data kh/i.test(n));
    let baseRows = [] as { ma: string; ten: string; nvkd: string; duNo: number }[];
    if (dkhSheet) {
      baseRows = parseDataKHSheet(XLSX.utils.sheet_to_json(wb.Sheets[dkhSheet], { header: 1, defval: null }) as unknown[][]);
    }
    if (baseRows.length && header.coDauKy) {
      const sumBase = baseRows.reduce((a, b) => a + b.duNo, 0);
      kiemTra.push({ ten: 'Tổng đầu kỳ theo khách = đầu kỳ sổ', ok: Math.abs(sumBase - header.soDuDauKy) < 1, chiTiet: `Σ ${baseRows.length} khách: ${sumBase.toLocaleString('vi-VN')} so với sổ ${header.soDuDauKy.toLocaleString('vi-VN')}` });
    } else if (baseRows.length) {
      kiemTra.push({ ten: 'Tổng đầu kỳ theo khách', ok: false, chiTiet: 'File có DataKH nhưng không đọc được dòng "Số dư đầu kỳ" của sổ — không đối chiếu được, kiểm tra lại file' });
    }

    if (!kiemTra.every((k) => k.ok)) {
      return NextResponse.json({ preview: true, blocked: true, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao });
    }

    // ===== Phân tích mã KH lạ + tên trùng nhiều mã (để UI cho ông quyết định Thêm/Gộp/Bỏ qua) =====
    const db = admin();
    const { data: kh } = await db.from('customers').select('ma_kh, ten_kh');
    const dsKh = ((kh ?? []) as any[]).map((r) => ({ ma_kh: String(r.ma_kh ?? '').trim(), ten_kh: String(r.ten_kh ?? '').trim() }));
    const maSet = new Set(dsKh.map((r) => r.ma_kh));
    const tenKhCu = new Map<string, string>(); // ten_kh (thường) -> ma_kh đầu tiên
    for (const r of dsKh) { const k = r.ten_kh.toLowerCase(); if (!tenKhCu.has(k)) tenKhCu.set(k, r.ma_kh); }

    // nvkd từ DataKH (nếu file có) — map ma -> nvkd
    const nvkdMap = new Map<string, string>();
    for (const b of baseRows) if (b.nvkd) nvkdMap.set(b.ma, b.nvkd);

    // thống kê theo mã trong sổ
    const agg = new Map<string, { ten_kh: string; so_dong: number; tong_no: number; tong_co: number; du_cuoi: number | null }>();
    for (const r of rows) {
      if (!r.ma_kh) continue;
      let a = agg.get(r.ma_kh);
      if (!a) { a = { ten_kh: r.ten_kh, so_dong: 0, tong_no: 0, tong_co: 0, du_cuoi: null }; agg.set(r.ma_kh, a); }
      a.so_dong++; a.tong_no += r.so_no; a.tong_co += r.so_co; if (r.du_dong != null) a.du_cuoi = r.du_dong;
      if (r.ten_kh && !a.ten_kh) a.ten_kh = r.ten_kh;
    }
    const laTrongSo = [...agg.keys()].filter((m) => !maSet.has(m));
    const khLa = laTrongSo
      .map((m) => {
        const a = agg.get(m)!;
        const tenLower = a.ten_kh.toLowerCase();
        const mergeTo = tenKhCu.get(tenLower) ?? '';
        return { ma_kh: m, ten_kh: a.ten_kh, nvkd: nvkdMap.get(m) ?? '', so_dong: a.so_dong, tong_no: a.tong_no, tong_co: a.tong_co, du_cuoi: a.du_cuoi, mergeTo };
      })
      .sort((x, y) => (y.du_cuoi ?? 0) - (x.du_cuoi ?? 0));

    const byName = new Map<string, Set<string>>();
    for (const r of rows) { if (!r.ma_kh) continue; const k = r.ten_kh.toLowerCase(); if (!byName.has(k)) byName.set(k, new Set()); byName.get(k)!.add(r.ma_kh); }
    const trungTen = [...byName.values()].filter((x) => x.size > 1).length;
    if (khLa.length) canhBao.push(`${khLa.length} mã KH trong sổ chưa có trong danh mục — xem bảng bên dưới để Thêm / Gộp / Bỏ qua.`);
    if (trungTen) canhBao.push(`${trungTen} tên KH xuất hiện với nhiều mã khác nhau trong sổ — kiểm tra danh mục`);

    if (mode !== 'commit') {
      return NextResponse.json({ preview: true, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao, khLa, dsKh });
    }

    // ===== COMMIT =====
    const batch = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    // Đọc lựa chọn của ông chủ từ UI: exclude (bỏ qua) + merge (mã lạ -> mã cũ)
    let excludeMa = new Set<string>();
    try { const arr = JSON.parse(String(form.get('exclude') ?? '[]')); if (Array.isArray(arr)) excludeMa = new Set(arr.map((v) => String(v))); } catch {}
    let mergeMap = new Map<string, string>();
    try { const o = JSON.parse(String(form.get('merge') ?? '{}')); if (o && typeof o === 'object') mergeMap = new Map(Object.entries(o).map(([k, v]) => [String(k), String(v)])); } catch {}

    // K2: liền mạch — đầu kỳ của file phải bằng hệ thống tính tại minNgay (chỉ khi đã có dữ liệu cũ TRƯỚC đó)
    const { count: soDongCuoiTruoc } = await db.from('receivable_rows').select('id', { count: 'exact', head: true }).lt('ngay', minNgay);
    if ((soDongCuoiTruoc ?? 0) > 0) {
      if (!header.coDauKy) {
        return NextResponse.json({ blocked: true, preview: true, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao, error: 'File không có dòng "Số dư đầu kỳ" để đối chiếu liền mạch — xuất lại file đủ dòng đầu kỳ' });
      }
      const { data: baseBal } = await db.from('customer_base_balance').select('du_no');
      const { data: prior } = await db.from('receivable_rows').select('so_no, so_co').lt('ngay', minNgay);
      const heThong = (baseBal ?? []).reduce((a: number, r: any) => a + Number(r.du_no || 0), 0)
        + (prior ?? []).reduce((a: number, r: any) => a + Number(r.so_no) - Number(r.so_co), 0);
      if (Math.abs(heThong - header.soDuDauKy) >= 1) {
        kiemTra.push({ ten: 'Liền mạch dòng thời gian', ok: false, chiTiet: `Hệ thống tính dư tại ${minNgay}: ${heThong.toLocaleString('vi-VN')} — file khai đầu kỳ ${header.soDuDauKy.toLocaleString('vi-VN')}. Có bút toán điều chỉnh lùi quá khứ? Chạy lại file phủ từ thời điểm điều chỉnh.` });
        return NextResponse.json({ blocked: true, preview: true, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao });
      }
      kiemTra.push({ ten: 'Liền mạch dòng thời gian', ok: true, chiTiet: `Khớp tại ${minNgay} (${header.soDuDauKy.toLocaleString('vi-VN')}đ)` });
    } else {
      kiemTra.push({ ten: 'Liền mạch dòng thời gian', ok: true, chiTiet: 'Chưa có dữ liệu trước vùng này — bỏ qua đối chiếu' });
    }

    // Ghi theo vùng [minNgay, maxNgay]: xóa rồi chèn lại (đổi mã gộp trước khi lưu)
    await db.from('receivable_rows').delete().gte('ngay', minNgay).lte('ngay', maxNgay);
    let rowsToInsert = rows;
    if (mergeMap.size > 0) {
      rowsToInsert = rows.map((r) => (r.ma_kh && mergeMap.has(r.ma_kh) ? { ...r, ma_kh: mergeMap.get(r.ma_kh)! } : r));
    }
    const CHUNK = 2000;
    const insertRows = rowsToInsert.map((r) => ({ ...r, import_batch: batch }));
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const { error } = await db.from('receivable_rows').insert(insertRows.slice(i, i + CHUNK));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ghi số dư gốc nếu file kèm DataKH có cột dư nợ đầu kỳ
    if (baseRows.length) {
      const { data: sBase } = await db.from('settings').select('value').eq('key', 'DEBT_BASE_DATE').maybeSingle();
      const baseDate = (sBase as any)?.value ?? '2026-01-01';
      const upserts = baseRows.map((b) => ({ ma_kh: b.ma, ten_kh: b.ten, du_no: b.duNo, ngay_moc: baseDate, updated_at: new Date().toISOString() }));
      for (let i = 0; i < upserts.length; i += CHUNK) {
        const { error } = await db.from('customer_base_balance').upsert(upserts.slice(i, i + CHUNK), { onConflict: 'ma_kh' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // ===== Tạo khách mới cho mã lạ (theo lựa chọn Thêm/Gộp/Bỏ qua của ông chủ) =====
    let createdCustomers = 0;
    let mergedCustomers = mergeMap.size;
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim();
    let uid = '';
    try { const auth = await db.auth.getUser(token || 'x'); uid = auth.data.user?.id ?? ''; } catch {}

    const toCreate = khLa.filter((c) => !excludeMa.has(c.ma_kh) && !mergeMap.has(c.ma_kh));
    if (toCreate.length > 0 && uid) {
      for (const c of toCreate) {
        const { error: insErr } = await db.from('customers').insert({
          ma_kh: c.ma_kh,
          ten_kh: c.ten_kh || c.ma_kh,
          assigned_to: uid, // người import phụ trách tạm — ông sửa KD trong Khách hàng sau
          tinh_thanh: '',
        } as any);
        if (!insErr) createdCustomers++;
      }
    }

    try {
      if (uid) {
        const { data: me } = await db.from('profiles').select('full_name').eq('id', uid).single();
        await db.from('audit_logs').insert({ actor_id: uid, action: 'Import sổ 131', entity_type: 'receivable', entity_id: null, details: { soDong: rows.length, tu: minNgay, den: maxNgay, batch, taoKhach: createdCustomers, gop: mergedCustomers, full_name: (me as any)?.full_name ?? '' } });
      }
    } catch {}

    return NextResponse.json({ preview: false, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao, createdCustomers, mergedCustomers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi không xác định' }, { status: 500 });
  }
}
