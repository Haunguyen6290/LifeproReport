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
    let baseRows: { ma: string; ten: string; duNo: number }[] = [];
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

    // Cảnh báo mềm (preview hiện luôn): mã lạ, tên trùng nhiều mã
    const db = admin();
    const { data: kh } = await db.from('customers').select('ma_kh, ten_kh');
    const maSet = new Set((kh ?? []).map((r: any) => String(r.ma_kh ?? '').trim()));
    const laTrongSo = [...new Set(rows.map((r) => r.ma_kh).filter(Boolean))].filter((m) => !maSet.has(m));
    if (laTrongSo.length) canhBao.push(`${laTrongSo.length} mã KH trong sổ chưa có trong danh mục: ${laTrongSo.slice(0, 10).join(', ')}${laTrongSo.length > 10 ? '…' : ''}`);
    const byName = new Map<string, Set<string>>();
    for (const r of rows) { if (!r.ma_kh) continue; const k = r.ten_kh.toLowerCase(); if (!byName.has(k)) byName.set(k, new Set()); byName.get(k)!.add(r.ma_kh); }
    const trungTen = [...byName.values()].filter((x) => x.size > 1).length;
    if (trungTen) canhBao.push(`${trungTen} tên KH xuất hiện với nhiều mã khác nhau trong sổ — kiểm tra danh mục`);

    if (mode !== 'commit') {
      return NextResponse.json({ preview: true, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao });
    }

    // ===== COMMIT =====
    const batch = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

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

    // Ghi theo vùng [minNgay, maxNgay]: xóa rồi chèn lại
    await db.from('receivable_rows').delete().gte('ngay', minNgay).lte('ngay', maxNgay);
    const CHUNK = 2000;
    const insertRows = rows.map((r) => ({ ...r, import_batch: batch }));
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

    try {
      const auth = await db.auth.getUser((req.headers.get('authorization') ?? '').replace(/^Bearer /i, '').trim() || 'x');
      const uid = auth.data.user?.id;
      if (uid) {
        const { data: me } = await db.from('profiles').select('full_name').eq('id', uid).single();
        await db.from('audit_logs').insert({ actor_id: uid, action: 'Import sổ 131', entity_type: 'receivable', entity_id: null, details: { soDong: rows.length, tu: minNgay, den: maxNgay, batch, full_name: (me as any)?.full_name ?? '' } });
      }
    } catch {}

    return NextResponse.json({ preview: false, soDong: rows.length, tuNgay: minNgay, denNgay: maxNgay, kiemTra, canhBao });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Lỗi không xác định' }, { status: 500 });
  }
}
