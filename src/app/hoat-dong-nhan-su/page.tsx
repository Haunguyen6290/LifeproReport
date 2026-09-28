'use client';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';
import { fmtDateTimeVN } from '@/lib/time';

type Item = { loai: string; thoi_gian: string; tieu_de: string; noi_dung: string };
type Row = { user_id: string; ho_ten: string; vai_tro: string; cols: Record<string, Item[]>; tong: number };

const COLS: { key: string; label: string }[] = [
  { key: 'ke_hoach_tuan', label: 'Kế hoạch tuần' },
  { key: 'bao_cao_tuan', label: 'Báo cáo tuần' },
  { key: 'tuong_tac', label: 'Tương tác KH' },
  { key: 'khach_moi', label: 'Khách mới' },
  { key: 'cap_nhat_kh', label: 'Cập nhật KH' },
  { key: 'okr', label: 'OKR' },
  { key: 'bao_cao_kho', label: 'Báo cáo kho' },
  { key: 'chien_dich', label: 'Chiến dịch' },
  { key: 'bang_tin', label: 'Bảng tin' },
  { key: 'hoa_don', label: 'Hóa đơn' },
  { key: 'tai_chinh', label: 'Tài chính' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeOf(kieu: string): [string, string] {
  const n = new Date();
  if (kieu === 'tuan') {
    const d = new Date(n); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w);
    const e = new Date(d); e.setDate(d.getDate() + 6); return [iso(d), iso(e)];
  }
  if (kieu === 'thang') return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0))];
  if (kieu === 'quy') { const q = Math.floor(n.getMonth() / 3) * 3; return [iso(new Date(n.getFullYear(), q, 1)), iso(new Date(n.getFullYear(), q + 3, 0))]; }
  if (kieu === 'nam') return [`${n.getFullYear()}-01-01`, `${n.getFullYear()}-12-31`];
  return [iso(n), iso(n)];
}

function Screen() {
  const { can } = useAuth();
  const [kieu, setKieu] = useState('thang');
  const [[tu, den], setRange] = useState<[string, string]>(rangeOf('thang'));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [chon, setChon] = useState<string>('');
  const [xem, setXem] = useState<null | { ten: string; label: string; items: Item[] }>(null);

  async function load() {
    setLoading(true); setErr('');
    try {
      const { data } = await supabase.auth.getSession();
      const tok = data.session?.access_token ?? '';
      const r = await fetch(`/api/hoat-dong-nhan-su?tu=${tu}&den=${den}`, { headers: { Authorization: `Bearer ${tok}` } });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Lỗi'); setRows([]); } else setRows(j.rows ?? []);
    } catch (e: any) { setErr(e?.message ?? 'Lỗi kết nối'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (chon ? rows.filter((r) => r.user_id === chon) : rows), [rows, chon]);
  const tongCot = useMemo(() => Object.fromEntries(COLS.map((c) => [c.key, shown.reduce((s, r) => s + (r.cols[c.key]?.length ?? 0), 0)])), [shown]);

  function exportExcel() {
    const data = shown.map((r) => ({ 'Nhân sự': r.ho_ten, 'Vai trò': r.vai_tro, ...Object.fromEntries(COLS.map((c) => [c.label, r.cols[c.key]?.length ?? 0])), 'Tổng': r.tong }));
    const chiTiet = shown.flatMap((r) => COLS.flatMap((c) => (r.cols[c.key] ?? []).map((it) => ({ 'Nhân sự': r.ho_ten, 'Loại': it.loai, 'Thời gian': fmtDateTimeVN(it.thoi_gian), 'Đối tượng': it.tieu_de, 'Nội dung': it.noi_dung }))));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Tong_hop');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chiTiet), 'Chi_tiet');
    XLSX.writeFile(wb, `Hoat_dong_nhan_su_${tu}_${den}.xlsx`);
  }

  if (!can('xem_hoat_dong_ns')) {
    return <AppSidebar><main className="p-6 text-sm text-slate-600">Không có quyền xem.</main></AppSidebar>;
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-lg font-bold text-[#0f2a4a]">Hoạt động nhân sự</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
          {[['tuan', 'Tuần'], ['thang', 'Tháng'], ['quy', 'Quý'], ['nam', 'Năm'], ['tuy', 'Tùy chọn']].map(([k, l]) => (
            <button key={k} onClick={() => { setKieu(k); if (k !== 'tuy') setRange(rangeOf(k)); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${kieu === k ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>{l}</button>
          ))}
          <input type="date" value={tu} onChange={(e) => { setKieu('tuy'); setRange([e.target.value, den]); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
          <span className="text-xs text-slate-500">→</span>
          <input type="date" value={den} onChange={(e) => { setKieu('tuy'); setRange([tu, e.target.value]); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
          <select value={chon} onChange={(e) => setChon(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-xs">
            <option value="">Tất cả nhân sự</option>
            {rows.map((r) => <option key={r.user_id} value={r.user_id}>{r.ho_ten}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Đang tải…' : 'Xem báo cáo'}</button>
          <button onClick={exportExcel} disabled={!shown.length} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold disabled:opacity-50">Xuất Excel</button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>

        <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1100px] text-xs">
            <thead className="sticky top-0 bg-[#eff6ff] text-[#1e3a8a]">
              <tr>
                <th className="px-2 py-2 text-left">Nhân sự</th>
                {COLS.map((c) => <th key={c.key} className="px-2 py-2 text-right">{c.label}</th>)}
                <th className="px-2 py-2 text-right">Tổng</th>
              </tr>
              <tr className="bg-slate-50 text-slate-600">
                <td className="px-2 py-1 font-semibold">Tổng cộng</td>
                {COLS.map((c) => <td key={c.key} className="px-2 py-1 text-right font-semibold tabular-nums">{tongCot[c.key] || ''}</td>)}
                <td className="px-2 py-1 text-right font-bold tabular-nums">{shown.reduce((s, r) => s + r.tong, 0)}</td>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.user_id} className={`border-t border-slate-100 hover:bg-slate-50 ${r.tong === 0 ? 'bg-red-50/40' : ''}`}>
                  <td className="px-2 py-1.5"><div className="font-semibold">{r.ho_ten}</div><div className="text-[10px] text-slate-500">{r.vai_tro}</div></td>
                  {COLS.map((c) => {
                    const n = r.cols[c.key]?.length ?? 0;
                    return <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">
                      {n ? <button onClick={() => setXem({ ten: r.ho_ten, label: c.label, items: r.cols[c.key] })} className="font-semibold text-[#1e3a8a] underline-offset-2 hover:underline">{n}</button> : <span className="text-slate-300">0</span>}
                    </td>;
                  })}
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums">
                    {r.tong ? <button onClick={() => setXem({ ten: r.ho_ten, label: 'Tất cả', items: COLS.flatMap((c) => r.cols[c.key] ?? []).sort((a, b) => String(b.thoi_gian).localeCompare(String(a.thoi_gian))) })} className="text-[#1e3a8a] hover:underline">{r.tong}</button> : <span className="text-red-500">0</span>}
                  </td>
                </tr>
              ))}
              {!shown.length && !loading && <tr><td colSpan={COLS.length + 2} className="px-3 py-6 text-center text-slate-500">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>

        {xem && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setXem(null)}>
            <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <b className="text-sm text-[#0f2a4a]">{xem.ten} — {xem.label} ({xem.items.length})</b>
                <button onClick={() => setXem(null)} aria-label="Đóng" className="text-lg text-slate-500 hover:text-slate-800">×</button>
              </div>
              <div className="max-h-[70vh] space-y-2 overflow-auto p-4">
                {xem.items.map((it, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 font-semibold text-[#1e3a8a]">{it.loai}</span>
                      <span>{fmtDateTimeVN(it.thoi_gian)}</span>
                    </div>
                    {it.tieu_de && <div className="mt-1 text-xs font-semibold text-slate-800">{it.tieu_de}</div>}
                    {it.noi_dung && <div className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{it.noi_dung}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
