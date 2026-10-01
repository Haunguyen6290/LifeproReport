import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = () => createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

const norm = (t: unknown) => String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Chi tiết Mã - Tên từng khách trong nhóm "Khác" (tab Bán hàng thu tiền),
// gom theo đúng tên KD quản lý của từng bảng tổng hợp (tháng và lũy kế
// ghép khác nhau nên phải truyền ytd để ghép đúng). ytd=true: 01/01→hết tháng,
// ngược lại chỉ đúng tháng p_thang.
export async function GET(req: NextRequest) {
  const thang = req.nextUrl.searchParams.get('thang') ?? '';
  const ytd = req.nextUrl.searchParams.get('ytd') === '1';
  if (!/^\d{4}-\d{2}$/.test(thang)) return NextResponse.json({ error: 'Thiếu tháng (YYYY-MM)' }, { status: 400 });
  const db = admin();
  const tu = ytd ? `${thang.slice(0, 4)}-01-01` : `${thang}-01`;
  const d = new Date(`${thang}-01T00:00:00`);
  const den = `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, '0')}-01`;

  // 1) Tên KD từng mã KH trong sổ: ưu tiên ghép đúng logic báo cáo tổng hợp
  // (CTE cust của finance_collections_report 0033: group by norm + tên KD),
  // nên tên KD bên dưới khớp 100% với tên dòng Khác bên trên.
  const [{ data: custs }, { data: profs }, { data: mapRow }] = await Promise.all([
    db.from('customers').select('ma_kh, assigned_to'),
    db.from('profiles').select('id, full_name'),
    db.from('settings').select('value').eq('key', 'RECEIVABLE_TK_MAP').single(),
  ]);
  const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? '']));
  // Ghép tên KD đúng logic từng báo cáo tổng hợp (tháng và lũy kế ghép khác nhau):
  // - Tháng (finance_collections_report 0032): ghép trực tiếp mã sổ = mã danh mục.
  // - Lũy kế (finance_collections_ytd 0034, theo 0033): ghép theo mã chuẩn hóa,
  //   mỗi cặp (norm, tên KD) một dòng — mã sổ join norm nào thì lấy tên dòng đó.
  const nvkdDirect = new Map<string, string>();
  for (const c of (custs ?? []) as any[]) {
    if (!nvkdDirect.has(c.ma_kh)) nvkdDirect.set(c.ma_kh, nameById.get(c.assigned_to) ?? '');
  }
  const nvkdByNorm = new Map<string, { nvkd: string; ma: string }>();
  for (const c of (custs ?? []) as any[]) {
    const k = `${norm(c.ma_kh)}|${nameById.get(c.assigned_to) ?? ''}`;
    if (!nvkdByNorm.has(k)) nvkdByNorm.set(k, { nvkd: nameById.get(c.assigned_to) ?? '', ma: c.ma_kh });
  }
  const nvkdOf = (maSo: string): string[] => {
    if (!ytd) return [nvkdDirect.get(maSo) ?? ''];
    const n = norm(maSo);
    const out: string[] = [];
    for (const [k, v] of nvkdByNorm) {
      if (k.split('|')[0] !== n) continue;
      if (v.ma === maSo) return [v.nvkd];
      out.push(v.nvkd);
    }
    return out.length ? [...new Set(out)] : [''];
  };

  // 2) Phân loại TK đối ứng: tiền tố dài nhất thắng (như fn_tk_nhom)
  const map = JSON.parse((mapRow as any)?.value ?? '[]') as { ma: string; nhom: string }[];
  const nhom = (tk: string) => {
    let best = '';
    for (const e of map) if (tk.startsWith(e.ma) && e.ma.length > best.length) best = e.ma;
    return map.find((e) => e.ma === best)?.nhom ?? '';
  };

  // 3) Quét chứng từ trong kỳ, gom theo (tên KD × mã KH trong sổ) — đúng join
  // của báo cáo tổng hợp: cùng 1 mã sổ có thể sinh nhiều dòng KD khác nhau.
  type Agg = { nvkd: string; ma: string; ten: string; doanh_so: number; thu_tien: number };
  const g = new Map<string, Agg & { tra: number }>();
  const keyOf = (nvkd: string, ma: string) => `${nvkd}|${ma}`;
  const chunk = 5000;
  let from = 0;
  for (;;) {
    const { data, error } = await db.from('receivable_rows')
      .select('ma_kh, ten_kh, tk_doi_ung, so_no, so_co')
      .gte('ngay', tu).lt('ngay', den)
      .order('ma_kh').range(from, from + chunk - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of (data ?? []) as any[]) {
      const n = nhom(r.tk_doi_ung ?? '');
      if (n !== 'Doanh thu' && n !== 'Trả lại' && n !== 'Thu tiền') continue;
      for (const nvRaw of nvkdOf(r.ma_kh)) {
        const nv = nvRaw || 'Khác';
        const key = keyOf(nv, r.ma_kh);
        let cur = g.get(key);
        if (!cur) {
          cur = { nvkd: nv, ma: r.ma_kh, ten: r.ten_kh ?? '', doanh_so: 0, thu_tien: 0, tra: 0 };
          g.set(key, cur);
        }
        if (r.ten_kh && !cur.ten) cur.ten = r.ten_kh;
        if (n === 'Doanh thu') cur.doanh_so += Number(r.so_no) - Number(r.so_co);
        else if (n === 'Trả lại') cur.tra += Number(r.so_co) - Number(r.so_no);
        else cur.thu_tien += Number(r.so_co) - Number(r.so_no);
      }
    }
    if (!data || data.length < chunk) break;
    from += chunk;
    if (from > 300000) break;
  }
  const rows: Agg[] = [...g.values()]
    .map((r) => ({ nvkd: r.nvkd, ma: r.ma, ten: r.ten, doanh_so: r.doanh_so - r.tra, thu_tien: r.thu_tien }))
    .sort((a, b) => b.doanh_so - a.doanh_so);
  return NextResponse.json({ thang, ytd, rows });
}
