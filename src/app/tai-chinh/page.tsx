'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';
import { fmtDateVN } from '@/lib/time';
import { KeHoachPanel } from '@/components/KeHoachPanel';

type DebtRow = {
  ma_kh: string; ten_kh: string; nvkd: string; tinh: string;
  cong_no_dau_ky: number; con_no_hien_tai: number | null; doanh_thu: number; tra_lai: number; thu_tien: number;
  tong_giam_tru: number; con_thieu: number; qua_han: boolean;
};

type CollRow = { nvkd: string; doanh_so: number; thu_tien: number };
type PlanRow = { thang: string; ten: string; mien: string; kh_doanh_so: number; kh_thu_tien: number };

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN');
const pct = (thuc: number, ke: number) => (ke ? `${((thuc / ke) * 100).toFixed(1)}%` : '—');

function nowYM(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function DebtTable({ rows, han }: { rows: DebtRow[]; han: number }) {
  const [fState, setFState] = useState<'tat-ca' | 'qua-han' | 'dat'>('tat-ca');
  const [fNvkd, setFNvkd] = useState('');
  const [fQ, setFQ] = useState('');
  const [sortKey, setSortKey] = useState<'con_thieu' | 'con_no_hien_tai' | 'cong_no_dau_ky' | 'doanh_thu'>('con_no_hien_tai');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const nvkds = useMemo(() => [...new Set(rows.map((r) => r.nvkd).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [rows]);

  const filtered = useMemo(() => {
    let f = rows;
    if (fState === 'qua-han') f = f.filter((r) => r.qua_han);
    if (fState === 'dat') f = f.filter((r) => !r.qua_han);
    if (fNvkd) f = f.filter((r) => r.nvkd === fNvkd);
    const q = fQ.trim().toLowerCase();
    if (q) f = f.filter((r) => r.ten_kh.toLowerCase().includes(q) || r.ma_kh.toLowerCase().includes(q));
    return [...f].sort((a, b) => { const d = (sortDir === 'asc' ? 1 : -1); return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * d || a.ma_kh.localeCompare(b.ma_kh); });
  }, [rows, fState, fNvkd, fQ, sortKey, sortDir]);

  const totals = useMemo(() => filtered.reduce((t, r) => { t.cndk += r.cong_no_dau_ky; t.cnht += (r.con_no_hien_tai ?? 0); t.dt += r.doanh_thu; t.tl += r.tra_lai; t.tt += r.thu_tien; t.giam += r.tong_giam_tru; t.thieu += r.con_thieu; return t; }, { cndk: 0, cnht: 0, dt: 0, tl: 0, tt: 0, giam: 0, thieu: 0 }), [filtered]);

  const nQuaHan = rows.filter((r) => r.qua_han).length;

  function exportExcel() {
    const data = filtered.map((r, i) => ({
      'STT': i + 1, 'Mã KH': r.ma_kh, 'Tên KH': r.ten_kh, 'NVKD': r.nvkd, 'Tỉnh/TP': r.tinh,
      'Công nợ hiện tại': r.con_no_hien_tai ?? '', 'Công nợ đầu kỳ': r.cong_no_dau_ky, 'Doanh số phát sinh trong kỳ': r.doanh_thu,
      'Doanh số hàng trả lại': r.tra_lai, 'Doanh thu thu tiền': r.thu_tien,
      'Tổng giảm trừ': r.tong_giam_tru, 'Số còn thiếu': r.con_thieu,
      'Cảnh báo': r.qua_han ? 'QUÁ HẠN' : 'Đạt yêu cầu',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cong_no_khach_hang');
    XLSX.writeFile(wb, `Cong_no_khach_hang_${nowYM()}.xlsx`);
  }

  const W_MONEY = 116;

  return (
    <div>
      {/* Thanh lọc */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['tat-ca', 'qua-han', 'dat'] as const).map((s) => (
          <button key={s} onClick={() => setFState(s)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${fState === s ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {s === 'tat-ca' ? `Tất cả (${rows.length})` : s === 'qua-han' ? `⚠ QUÁ HẠN (${nQuaHan})` : `Đạt yêu cầu (${rows.length - nQuaHan})`}
          </button>
        ))}
        <select value={fNvkd} onChange={(e) => setFNvkd(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">Mọi kinh doanh</option>
          {nvkds.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="Tìm tên / mã khách…" className="w-full max-w-[260px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]" />
        <button onClick={exportExcel} className="rounded-md bg-[#1e3a8a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af]">Xuất Excel</button>
        <span className="text-xs text-slate-500">Lọc được {filtered.length} khách</span>
      </div>

      <div className="max-h-[640px] overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1300px] border-separate border-spacing-0 table-fixed text-[12.5px]">
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: W_MONEY }} />
            <col style={{ width: 112 }} />
          </colgroup>
          <thead>
            <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">STT</th>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Mã KH</th>
              <th className="border-b border-slate-200 px-3 py-2 font-bold">Tên KH</th>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">NVKD</th>
              <th className="border-b border-slate-200 bg-amber-50/60 px-3 py-2 align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>
                <button onClick={() => { if (sortKey === 'con_no_hien_tai') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey('con_no_hien_tai'); setSortDir('desc'); } }} className="flex w-full items-end justify-end gap-1 text-right font-bold leading-tight">
                  <span className="whitespace-normal break-words">Công nợ hiện tại</span>{sortKey === 'con_no_hien_tai' ? <span className="shrink-0">{sortDir === 'asc' ? '↑' : '↓'}</span> : <span className="shrink-0 text-slate-400">↕</span>}
                </button>
              </th>
              <th className="border-b border-slate-200 px-3 py-2 align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>
                <button onClick={() => { if (sortKey === 'cong_no_dau_ky') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey('cong_no_dau_ky'); setSortDir('desc'); } }} className="flex w-full items-end justify-end gap-1 text-right font-bold leading-tight">
                  <span className="whitespace-normal break-words">Công nợ đầu kỳ</span>{sortKey === 'cong_no_dau_ky' ? <span className="shrink-0">{sortDir === 'asc' ? '↑' : '↓'}</span> : <span className="shrink-0 text-slate-400">↕</span>}
                </button>
              </th>
              <th className="border-b border-slate-200 px-3 py-2 align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>
                <button onClick={() => { if (sortKey === 'doanh_thu') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey('doanh_thu'); setSortDir('desc'); } }} className="flex w-full items-end justify-end gap-1 text-right font-bold leading-tight">
                  <span className="whitespace-normal break-words">DS phát sinh trong kỳ</span>{sortKey === 'doanh_thu' ? <span className="shrink-0">{sortDir === 'asc' ? '↑' : '↓'}</span> : <span className="shrink-0 text-slate-400">↕</span>}
                </button>
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-bold leading-tight whitespace-normal break-words align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>Trả lại</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-bold leading-tight whitespace-normal break-words align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>Thu tiền</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right font-bold leading-tight whitespace-normal break-words align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>Tổng giảm trừ</th>
              <th className="border-b border-slate-200 px-3 py-2 align-bottom" style={{ width: W_MONEY, minWidth: W_MONEY, maxWidth: W_MONEY }}>
                <button onClick={() => { if (sortKey === 'con_thieu') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey('con_thieu'); setSortDir('desc'); } }} className="flex w-full items-end justify-end gap-1 text-right font-bold leading-tight">
                  <span className="whitespace-normal break-words">Số còn thiếu</span>{sortKey === 'con_thieu' ? <span className="shrink-0">{sortDir === 'asc' ? '↑' : '↓'}</span> : <span className="shrink-0 text-slate-400">↕</span>}
                </button>
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Cảnh báo</th>
            </tr>
            <tr className="bg-[#eef2f7] font-semibold" style={{ position: 'sticky', top: 40, zIndex: 15 }}>
              <td colSpan={4} className="border-b border-slate-200 px-3 py-2 text-right">Tổng cộng</td>
              <td className="whitespace-nowrap border-b border-slate-200 bg-amber-50/60 px-3 py-2 text-right font-bold tabular-nums">{fmt(totals.cnht)}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums">{fmt(totals.cndk)}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums">{fmt(totals.dt)}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums">{fmt(totals.tl)}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums">{fmt(totals.tt)}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums">{fmt(totals.giam)}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-3 py-2 text-right tabular-nums text-red-700">{fmt(totals.thieu)}</td>
              <td className="border-b border-slate-200"></td>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r, i) => (
              <tr key={r.ma_kh} className={r.qua_han ? 'bg-red-50' : 'hover:bg-slate-50'}>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{i + 1}</td>
                <td className="truncate px-3 py-2 font-semibold" title={r.ma_kh}>{r.ma_kh}</td>
                <td className="truncate px-3 py-2 font-semibold" title={r.ten_kh}>{r.ten_kh}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.nvkd || '—'}</td>
                <td className="whitespace-nowrap bg-amber-50/60 px-3 py-2 text-right font-bold tabular-nums">{r.con_no_hien_tai == null ? '—' : fmt(r.con_no_hien_tai)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.cong_no_dau_ky)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.doanh_thu)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.tra_lai)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.thu_tien)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.tong_giam_tru)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{fmt(r.con_thieu)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {r.qua_han
                    ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">⚠ QUÁ HẠN</span>
                    : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Đạt yêu cầu</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Hạn công nợ đang áp dụng: {han} ngày · Danh sách hiện toàn bộ khách hàng có số dư gốc, sắp xếp theo Số còn thiếu giảm dần.</p>
    </div>
  );
}

function CollectionsTable({ rows, plan, thang, tinhKhac, onTinhKhac }: { rows: CollRow[]; plan: PlanRow[]; thang: string; tinhKhac: boolean; onTinhKhac: (v: boolean) => void }) {
  const planThang = useMemo(() => plan.filter((p) => p.thang === thang), [plan, thang]);
  const miens = useMemo(() => [...new Set(planThang.map((p) => p.mien).filter(Boolean))], [planThang]);

  const byNvkd = useMemo(() => new Map(rows.map((r) => [r.nvkd, r])), [rows]);

  // gộp NVKD trong rows nhưng không có plan của tháng này → cột "Khác"
  const knownNames = new Set(planThang.map((p) => p.ten));
  const others = rows.filter((r) => !knownNames.has(r.nvkd));
  const [otherDetail, setOtherDetail] = useState(false);
  const rowsTinh = tinhKhac ? rows : rows.filter((r) => knownNames.has(r.nvkd));
  const totalDS = rowsTinh.reduce((a, r) => a + r.doanh_so, 0);
  const totalThu = rowsTinh.reduce((a, r) => a + r.thu_tien, 0);
  const dsKhac = others.reduce((a, r) => a + r.doanh_so, 0);
  const thuKhac = others.reduce((a, r) => a + r.thu_tien, 0);
  // Cột "Khác" chỉ hiện trên bảng khi bật "Tính Khác vào Tổng"; khi tắt thì ẩn hẳn khỏi báo cáo.
  const showKhac = others.length > 0 && tinhKhac;

  // Một khối chỉ tiêu (Doanh số bán hàng / Doanh thu thu tiền):
  // cột tên khối gộp dọc 3 dòng + cột chỉ tiêu con (Kế hoạch / Thực hiện / % thực hiện) — đúng mẫu Excel
  function renderBlock(title: string, key: 'doanh_so' | 'thu_tien') {
    const khField: 'kh_doanh_so' | 'kh_thu_tien' = key === 'doanh_so' ? 'kh_doanh_so' : 'kh_thu_tien';
    const sumKh = (list: PlanRow[]) => list.reduce((a, p) => a + p[khField], 0);
    const thucToanCty = rowsTinh.reduce((a, r) => a + r[key], 0);
    const NV = 'border-l border-slate-100 px-3 py-2 text-right text-xs tabular-nums';
    const NV_BOLD = `${NV} font-semibold text-[#0f2a4a]`;
    const TOT = 'px-3 py-2 text-right text-xs font-semibold tabular-nums';
    const TOT_BOLD = `${TOT} font-semibold text-[#0f2a4a]`;
    const GCT = 'border-l border-slate-100 px-3 py-2 text-right text-xs font-bold tabular-nums';
    const GCT_BOLD = `${GCT} font-bold text-[#0f2a4a]`;
    return [
      <tr key={`${key}-kh`}>
        <td rowSpan={3} className="whitespace-nowrap border-r border-slate-100 px-3 py-2 align-middle font-bold text-[#0f2a4a]">{title}</td>
        <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#0f2a4a]">Kế hoạch</td>
        {miens.map((m) => (
          <Fragment key={m}>
            {planThang.filter((p) => p.mien === m).map((p) => <td key={p.ten} className={NV_BOLD}>{fmt(p[khField])}</td>)}
            <td className={TOT_BOLD}>{fmt(sumKh(planThang.filter((p) => p.mien === m)))}</td>
          </Fragment>
        ))}
        {showKhac && <td className={NV_BOLD}>—</td>}
        <td className={GCT_BOLD}>{fmt(sumKh(planThang))}</td>
      </tr>,
      <tr key={`${key}-th`}>
        <td className="whitespace-nowrap px-3 py-2 text-slate-600">Thực hiện</td>
        {miens.map((m) => (
          <Fragment key={m}>
            {planThang.filter((p) => p.mien === m).map((p) => <td key={p.ten} className={NV}>{fmt(byNvkd.get(p.ten)?.[key] ?? 0)}</td>)}
            <td className={TOT}>{fmt(planThang.filter((p) => p.mien === m).reduce((a, p) => a + (byNvkd.get(p.ten)?.[key] ?? 0), 0))}</td>
          </Fragment>
        ))}
        {showKhac && <td className={NV}>{fmt(others.reduce((a, r) => a + r[key], 0))}</td>}
        <td className={GCT}>{fmt(thucToanCty)}</td>
      </tr>,
      <tr key={`${key}-pct`}>
        <td className="whitespace-nowrap px-3 py-2 text-slate-600">% thực hiện</td>
        {miens.map((m) => (
          <Fragment key={m}>
            {planThang.filter((p) => p.mien === m).map((p) => <td key={p.ten} className={NV}>{pct(byNvkd.get(p.ten)?.[key] ?? 0, p[khField])}</td>)}
            {(() => { const ke = sumKh(planThang.filter((p) => p.mien === m)); const th = planThang.filter((p) => p.mien === m).reduce((a, p) => a + (byNvkd.get(p.ten)?.[key] ?? 0), 0); return <td className={TOT}>{pct(th, ke)}</td>; })()}
          </Fragment>
        ))}
        {showKhac && <td className={NV}>—</td>}
        <td className={GCT}>{pct(thucToanCty, sumKh(planThang))}</td>
      </tr>,
    ];
  }

  // Chưa khai báo kế hoạch tháng này nhưng đã có dữ liệu thực hiện → hiện bảng theo NVKD
  if (planThang.length === 0 && rows.length > 0) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800">
          Số liệu lấy từ <b>Sổ TK131</b> đã import — không cần import thêm. Tháng này <b>chưa khai báo kế hoạch</b> nên chỉ hiện <b>Thực hiện</b>; vào <b>Kế hoạch bán hàng</b> (menu bên trái) hoặc bấm “Kế hoạch kỳ này” bên dưới để có dòng Kế hoạch và %.
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[#eff6ff] text-[#1e3a8a]">
                <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Kinh doanh</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Doanh số bán hàng</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Doanh thu thu tiền</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Còn phải thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.nvkd} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{r.nvkd}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.doanh_so)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.thu_tien)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{fmt(Math.max(r.doanh_so - r.thu_tien, 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right">Tổng công ty</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totalDS)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totalThu)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(Math.max(totalDS - totalThu, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {planThang.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chưa có dữ liệu cho tháng này. Kiểm tra đã import <b>Sổ TK131</b> cho tháng này chưa (nút <b>Import sổ 131</b> phía trên).
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-[#eff6ff] text-[#1e3a8a]">
              <th className="whitespace-nowrap px-3 py-2 text-left font-bold" colSpan={2} rowSpan={2}>Chỉ tiêu</th>
              {miens.map((m) => (
                <th key={m} colSpan={planThang.filter((p) => p.mien === m).length + 1} className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold">{m}</th>
              ))}
              {showKhac && <th className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold" rowSpan={2}>Khác</th>}
              <th className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold" rowSpan={2}>Tổng công ty</th>
            </tr>
            <tr className="bg-[#f8fafc] text-xs text-slate-600">
              {miens.map((m) => (
                <Fragment key={m}>
                  {planThang.filter((p) => p.mien === m).map((p) => <th key={p.ten} className="whitespace-nowrap border-l border-slate-200 px-3 py-1.5 text-center font-semibold">{p.ten}</th>)}
                  <th className="whitespace-nowrap px-3 py-1.5 text-center font-semibold">Tổng {m}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderBlock('Doanh số bán hàng', 'doanh_so')}
            {renderBlock('Doanh thu thu tiền', 'thu_tien')}
          </tbody>
        </table>
      </div>
      {others.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <button onClick={() => setOtherDetail((o) => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1e3a8a]">
              <span className="grid h-5 w-5 place-items-center rounded bg-[#eff6ff] text-[11px]">{others.length}</span>
              Khác — {others.map((r) => r.nvkd).join(', ')}<span className="ml-1 text-slate-400">{otherDetail ? '▲' : '▼'}</span>
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={tinhKhac} onChange={(e) => onTinhKhac(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
              Hiện &amp; tính “Khác” vào <span className="font-semibold">Tổng công ty</span>
            </label>
          </div>
          <p className="border-t border-slate-100 px-3 py-1 text-[11px] text-slate-500">Hàng “Khác” = {tinhKhac ? `đang hiện cột Khác và tính vào Tổng (${fmt(dsKhac)}/${fmt(thuKhac)})` : 'đang ẩn khỏi bảng và không tính vào Tổng — tích ô bên phải để hiện lại'}.</p>
          {otherDetail && (
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-[#eff6ff] text-left text-[#1e3a8a]"><th className="px-3 py-1.5">Kinh doanh</th><th className="px-3 py-1.5 text-right">Doanh số</th><th className="px-3 py-1.5 text-right">Thu tiền</th><th className="px-3 py-1.5 text-right">Còn phải thu</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {others.map((r) => (
                    <tr key={r.nvkd} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium">{r.nvkd}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.doanh_so)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.thu_tien)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fmt(Math.max(r.doanh_so - r.thu_tien, 0))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-slate-50 font-bold"><td className="px-3 py-1.5 text-right">Tổng Khác</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(dsKhac)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(thuKhac)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(Math.max(dsKhac - thuKhac, 0))}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Báo cáo lũy kế năm: dồn từ tháng 1 đến hết tháng đang chọn, thêm hàng "% Thu/Bán".
function YtdTable({ rows, plan, thang, tinhKhac, onTinhKhac }: { rows: CollRow[]; plan: PlanRow[]; thang: string; tinhKhac: boolean; onTinhKhac: (v: boolean) => void }) {
  // Các tháng thuộc năm của tháng đang chọn, từ 01 đến tháng đó
  const ytdMonths = useMemo(() => {
    const [y, m] = thang.split('-');
    const s = new Set<string>();
    for (let i = 1; i <= parseInt(m, 10); i++) s.add(`${y}-${String(i).padStart(2, '0')}`);
    return s;
  }, [thang]);
  const planYtd = useMemo(() => plan.filter((p) => ytdMonths.has(p.thang)), [plan, ytdMonths]);

  // Gom kế hoạch theo từng kinh doanh (cộng dồn các tháng trong năm), lấy miền mới nhất
  const byTen = useMemo(() => {
    const m = new Map<string, { mien: string; khDS: number; khThu: number }>();
    for (const p of [...planYtd].sort((a, b) => a.thang.localeCompare(b.thang))) {
      const cur = m.get(p.ten) ?? { mien: p.mien, khDS: 0, khThu: 0 };
      cur.mien = p.mien; cur.khDS += p.kh_doanh_so; cur.khThu += p.kh_thu_tien;
      m.set(p.ten, cur);
    }
    return m;
  }, [planYtd]);
  const miens = useMemo(() => [...new Set([...byTen.values()].map((v) => v.mien).filter(Boolean))], [byTen]);
  const byNvkd = useMemo(() => new Map(rows.map((r) => [r.nvkd, r])), [rows]);

  const knownNames = new Set([...byTen.keys()]);
  const others = rows.filter((r) => !knownNames.has(r.nvkd));
  const [otherDetail, setOtherDetail] = useState(false);
  const rowsTinh = tinhKhac ? rows : rows.filter((r) => knownNames.has(r.nvkd));

  const ratio = (thu: number, ban: number) => (ban ? `${((thu / ban) * 100).toFixed(1)}%` : '—');

  const showKhac = others.length > 0 && tinhKhac;
  const dsKhac = others.reduce((a, r) => a + r.doanh_so, 0);
  const thuKhac = others.reduce((a, r) => a + r.thu_tien, 0);

  function block(title: string, key: 'doanh_so' | 'thu_tien', khField: 'khDS' | 'khThu') {
    const NV = 'border-l border-slate-100 px-3 py-2 text-right text-xs tabular-nums';
    const NV_B = `${NV} font-semibold text-[#0f2a4a]`;
    const TOT = 'px-3 py-2 text-right text-xs font-semibold tabular-nums';
    const TOT_B = `${TOT} font-semibold text-[#0f2a4a]`;
    const GCT = 'border-l border-slate-100 px-3 py-2 text-right text-xs font-bold tabular-nums';
    const GCT_B = `${GCT} font-bold text-[#0f2a4a]`;
    const khOf = (ten: string) => byTen.get(ten)?.[khField] ?? 0;
    const thOf = (ten: string) => byNvkd.get(ten)?.[key] ?? 0;
    return [
      <tr key={`${key}-kh`}>
        <td rowSpan={3} className="whitespace-nowrap border-r border-slate-100 px-3 py-2 align-middle font-bold text-[#0f2a4a]">{title}</td>
        <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#0f2a4a]">Kế hoạch</td>
        {miens.map((m) => {
          const tens = [...byTen.keys()].filter((t) => byTen.get(t)!.mien === m);
          return (
            <Fragment key={m}>
              {tens.map((t) => <td key={t} className={NV_B}>{fmt(khOf(t))}</td>)}
              <td className={TOT_B}>{fmt(tens.reduce((a, t) => a + khOf(t), 0))}</td>
            </Fragment>
          );
        })}
        {showKhac && <td className={NV_B}>—</td>}
        <td className={GCT_B}>{fmt([...byTen.values()].reduce((a, v) => a + v[khField], 0))}</td>
      </tr>,
      <tr key={`${key}-th`}>
        <td className="whitespace-nowrap px-3 py-2 text-slate-600">Thực hiện</td>
        {miens.map((m) => {
          const tens = [...byTen.keys()].filter((t) => byTen.get(t)!.mien === m);
          return (
            <Fragment key={m}>
              {tens.map((t) => <td key={t} className={NV}>{fmt(thOf(t))}</td>)}
              <td className={TOT}>{fmt(tens.reduce((a, t) => a + thOf(t), 0))}</td>
            </Fragment>
          );
        })}
        {showKhac && <td className={NV}>{fmt(others.reduce((a, r) => a + r[key], 0))}</td>}
        <td className={GCT}>{fmt(rowsTinh.reduce((a, r) => a + r[key], 0))}</td>
      </tr>,
      <tr key={`${key}-pct`}>
        <td className="whitespace-nowrap px-3 py-2 text-slate-600">% thực hiện</td>
        {miens.map((m) => {
          const tens = [...byTen.keys()].filter((t) => byTen.get(t)!.mien === m);
          return (
            <Fragment key={m}>
              {tens.map((t) => <td key={t} className={NV}>{pct(thOf(t), khOf(t))}</td>)}
              <td className={TOT}>{pct(tens.reduce((a, t) => a + thOf(t), 0), tens.reduce((a, t) => a + khOf(t), 0))}</td>
            </Fragment>
          );
        })}
        {showKhac && <td className={NV}>—</td>}
        <td className={GCT}>{pct(rowsTinh.reduce((a, r) => a + r[key], 0), [...byTen.values()].reduce((a, v) => a + v[khField], 0))}</td>
      </tr>,
    ];
  }

  // Nếu chưa khai báo kế hoạch năm nhưng đã có số liệu → bảng gọn theo kinh doanh
  if (byTen.size === 0 && rows.length > 0) {
    const tDS = rowsTinh.reduce((a, r) => a + r.doanh_so, 0);
    const tThu = rowsTinh.reduce((a, r) => a + r.thu_tien, 0);
    return (
      <div className="mt-5">
        <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Báo cáo lũy kế năm {thang.split('-')[0]} (đến hết {thang})</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[#eff6ff] text-[#1e3a8a]">
                <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Kinh doanh</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Doanh số bán hàng</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Doanh thu thu tiền</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-bold">% Thu/Bán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.nvkd} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{r.nvkd}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.doanh_so)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(r.thu_tien)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{ratio(r.thu_tien, r.doanh_so)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right">Tổng công ty</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(tDS)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(tThu)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ratio(tThu, tDS)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }
  if (byTen.size === 0) return null;

  const tDS = rowsTinh.reduce((a, r) => a + r.doanh_so, 0);
  const tThu = rowsTinh.reduce((a, r) => a + r.thu_tien, 0);

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#1e3a8a]">Báo cáo lũy kế năm {thang.split('-')[0]} (đến hết tháng {thang.split('-')[1]})</h2>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-[#eff6ff] text-[#1e3a8a]">
              <th className="whitespace-nowrap px-3 py-2 text-left font-bold" colSpan={2} rowSpan={2}>Chỉ tiêu</th>
              {miens.map((m) => {
                const n = [...byTen.keys()].filter((t) => byTen.get(t)!.mien === m).length;
                return <th key={m} colSpan={n + 1} className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold">{m}</th>;
              })}
              {showKhac && <th className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold" rowSpan={2}>Khác</th>}
              <th className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold" rowSpan={2}>Tổng công ty</th>
            </tr>
            <tr className="bg-[#f8fafc] text-xs text-slate-600">
              {miens.map((m) => (
                <Fragment key={m}>
                  {[...byTen.keys()].filter((t) => byTen.get(t)!.mien === m).map((t) => <th key={t} className="whitespace-nowrap border-l border-slate-200 px-3 py-1.5 text-center font-semibold">{t}</th>)}
                  <th className="whitespace-nowrap px-3 py-1.5 text-center font-semibold">Tổng {m}</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {block('Doanh số bán hàng', 'doanh_so', 'khDS')}
            {block('Doanh thu thu tiền', 'thu_tien', 'khThu')}
            {/* Hàng % Thu/Bán: tổng thu chia tổng bán (lũy kế) */}
            <tr>
              <td colSpan={2} className="whitespace-nowrap border-r border-slate-100 px-3 py-2 font-bold text-[#0f2a4a]">% Thu/Bán</td>
              {miens.map((m) => {
                const tens = [...byTen.keys()].filter((t) => byTen.get(t)!.mien === m);
                const ban = tens.reduce((a, t) => a + (byNvkd.get(t)?.doanh_so ?? 0), 0);
                const thu = tens.reduce((a, t) => a + (byNvkd.get(t)?.thu_tien ?? 0), 0);
                return (
                  <Fragment key={m}>
                    {tens.map((t) => <td key={t} className="border-l border-slate-100 px-3 py-2 text-right text-xs font-semibold tabular-nums text-[#0f2a4a]">{ratio(byNvkd.get(t)?.thu_tien ?? 0, byNvkd.get(t)?.doanh_so ?? 0)}</td>)}
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-[#0f2a4a]">{ratio(thu, ban)}</td>
                  </Fragment>
                );
              })}
              {showKhac && <td className="border-l border-slate-100 px-3 py-2 text-right text-xs font-semibold tabular-nums">{ratio(thuKhac, dsKhac)}</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right text-xs font-bold tabular-nums text-[#0f2a4a]">{ratio(tThu, tDS)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {others.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <button onClick={() => setOtherDetail((o) => !o)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1e3a8a]">
              <span className="grid h-5 w-5 place-items-center rounded bg-[#eff6ff] text-[11px]">{others.length}</span>
              Khác — {others.map((r) => r.nvkd).join(', ')}<span className="ml-1 text-slate-400">{otherDetail ? '▲' : '▼'}</span>
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={tinhKhac} onChange={(e) => onTinhKhac(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
              Hiện &amp; tính “Khác” vào <span className="font-semibold">Tổng công ty</span>
            </label>
          </div>
          {otherDetail && (
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-[#eff6ff] text-left text-[#1e3a8a]"><th className="px-3 py-1.5">Kinh doanh</th><th className="px-3 py-1.5 text-right">Doanh số</th><th className="px-3 py-1.5 text-right">Thu tiền</th><th className="px-3 py-1.5 text-right">% Thu/Bán</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {others.map((r) => (
                    <tr key={r.nvkd} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium">{r.nvkd}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.doanh_so)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.thu_tien)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{ratio(r.thu_tien, r.doanh_so)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-slate-50 font-bold"><td className="px-3 py-1.5 text-right">Tổng Khác</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(dsKhac)}</td><td className="px-3 py-1.5 text-right tabular-nums">{fmt(thuKhac)}</td><td className="px-3 py-1.5 text-right tabular-nums">{ratio(thuKhac, dsKhac)}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type UnmatchedRow = { ma_so: string; ten_so: string; ma_chuan: string | null; ten_chuan: string | null; doanh_thu: number; tra_lai: number; thu_tien: number; so_dong: number; chua_gan_kd: boolean };
function UnmatchedPanel({ thang, refreshKey }: { thang: string; refreshKey: number }) {
  const [rows, setRows] = useState<UnmatchedRow[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/finance/unmatched?thang=${thang}`);
        const j = await r.json();
        setRows(j?.rows ?? []);
      } catch { setRows([]); }
    })();
  }, [thang, refreshKey]);
  if (!rows) return null;
  const chuaKhop = rows.filter((r) => !r.ma_chuan);
  const chuaGan = rows.filter((r) => r.ma_chuan && r.chua_gan_kd);
  if (!chuaKhop.length && !chuaGan.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-amber-900">
        <span>Khách trong sổ 131 chưa khớp danh mục ({rows.length}) — bấm vào để xem &amp; xử lý</span>
        <span className="text-xs text-amber-700">{open ? 'Thu gọn ▲' : 'Mở ra ▼'}</span>
      </button>
      {open && (
        <div className="border-t border-amber-200 bg-white p-3 text-xs">
          <p className="mb-2 text-slate-600">
            Các khách này phát sinh trong sổ công nợ nhưng <b>chưa có trong Danh mục khách hàng</b> (hoặc có rồi nhưng chưa gán kinh doanh phụ trách), nên bị xếp vào cột <b>Khác</b>.
            Bấm <b>Thêm vào danh mục</b> để tạo khách và gán người phụ trách — sau đó quay lại đây bấm <b>Chạy báo cáo</b> là số sẽ chuyển về đúng kinh doanh.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-xs">
              <thead><tr className="bg-slate-50 text-left text-slate-700">
                <th className="px-2 py-1.5 font-semibold">Mã trong sổ</th>
                <th className="px-2 py-1.5 font-semibold">Tên trong sổ</th>
                <th className="px-2 py-1.5 text-right font-semibold">Doanh số</th>
                <th className="px-2 py-1.5 text-right font-semibold">Trả lại</th>
                <th className="px-2 py-1.5 text-right font-semibold">Thu tiền</th>
                <th className="px-2 py-1.5 font-semibold">Tình trạng</th>
                <th className="px-2 py-1.5 font-semibold">Xử lý</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ma_so} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 font-mono">{r.ma_so}</td>
                    <td className="px-2 py-1.5">{r.ten_so || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.doanh_thu)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.tra_lai)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.thu_tien)}</td>
                    <td className="px-2 py-1.5">
                      {r.ma_chuan ? <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">Có trong DM, chưa gán KD</span>
                        : <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Chưa có trong DM</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.ma_chuan
                        ? <a href={`/khach-hang?q=${encodeURIComponent(r.ma_chuan)}`} className="font-semibold text-[#1e3a8a] hover:underline">Gán kinh doanh</a>
                        : <a href={`/khach-hang/moi?ma=${encodeURIComponent(r.ma_so)}&ten=${encodeURIComponent(r.ten_so ?? '')}`} className="font-semibold text-[#1e3a8a] hover:underline">Thêm vào danh mục</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KeHoachBox({ thang, onSaved }: { thang: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-[#1e3a8a]">
        <span>Kế hoạch kỳ này ({thang})</span>
        <span className="text-xs font-medium text-slate-500">{open ? 'Thu gọn ▲' : 'Sửa / khai báo ▼'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <KeHoachPanel thang={thang} embed="tab" onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}

function Screen() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'cong-no' | 'thu-tien'>('cong-no');
  const [thang, setThang] = useState(nowYM());
  const [han, setHan] = useState(90);
  const [debt, setDebt] = useState<{ D: string; E: string; rows: DebtRow[] } | null>(null);
  const [coll, setColl] = useState<{ plan: PlanRow[]; rows: CollRow[] } | null>(null);
  const [ytd, setYtd] = useState<{ plan: PlanRow[]; rows: CollRow[] } | null>(null);
  const [ytdErr, setYtdErr] = useState('');
  const [tinhKhac, setTinhKhac] = useState<boolean>(() => {
    try { return localStorage.getItem('fin_tinh_khac') !== '0'; } catch { return true; }
  });
  function onTinhKhac(v: boolean) {
    setTinhKhac(v);
    try { localStorage.setItem('fin_tinh_khac', v ? '1' : '0'); } catch {}
  }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // import
  const [impOpen, setImpOpen] = useState(false);
  const [impFile, setImpFile] = useState<File | null>(null);
  const [impPreview, setImpPreview] = useState<any>(null);
  const [impBusy, setImpBusy] = useState(false);
  const [impMsg, setImpMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [impExclude, setImpExclude] = useState<Set<string>>(new Set());
  const [impMerge, setImpMerge] = useState<Map<string, string>>(new Map());

  const canImport = can('quan_ly_cai_dat') || can('import_tai_chinh');

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const q = new URLSearchParams({ thang });
        const r = await fetch(`/api/finance/debt?${q}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? 'Lỗi tải báo cáo');
        setDebt(j); setHan(j.han ?? 90);
      } catch (e: any) { setErr(e?.message ?? 'Lỗi'); setDebt(null); }
      finally { setLoading(false); }
    })();
  }, [thang, refreshKey]);

  useEffect(() => {
    if (tab !== 'thu-tien') return;
    (async () => {
      setLoading(true); setErr(''); setYtdErr('');
      try {
        const [rColl, rYtd] = await Promise.all([
          fetch(`/api/finance/collections?thang=${thang}`),
          fetch(`/api/finance/collections-ytd?thang=${thang}`),
        ]);
        const j = await rColl.json();
        if (!rColl.ok) throw new Error(j?.error ?? 'Lỗi tải báo cáo');
        setColl(j);
        if (rYtd.ok) { setYtd(await rYtd.json()); setYtdErr(''); }
        else { setYtd(null); try { const e = await rYtd.json(); setYtdErr(e?.error ?? rYtd.statusText); } catch { setYtdErr('Báo cáo lũy kế năm chưa tải được — hãy chạy migration 0034_collections_ytd trong Supabase trước.'); } }
      } catch (e: any) { setErr(e?.message ?? 'Lỗi'); setColl(null); setYtd(null); }
      finally { setLoading(false); }
    })();
  }, [tab, thang, refreshKey]);

  async function previewImport() {
    if (!impFile) { setImpMsg('Chọn file trước.'); return; }
    setImpBusy(true); setImpMsg(''); setImpPreview(null);
    setImpExclude(new Set()); setImpMerge(new Map());
    try {
      const { data } = await supabase.auth.getSession();
      const tok = data.session?.access_token ?? '';
      const fd = new FormData(); fd.append('file', impFile); fd.append('mode', 'preview');
      const r = await fetch('/api/finance/import-131', { method: 'POST', headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: fd });
      const j = await r.json();
      setImpPreview(j);
      if (j.error) setImpMsg(j.error);
    } catch (e: any) { setImpMsg(e?.message ?? 'Lỗi'); }
    finally { setImpBusy(false); }
  }

  async function commitImport() {
    if (!impFile) return;
    setImpBusy(true); setImpMsg('');
    try {
      const { data } = await supabase.auth.getSession();
      const tok = data.session?.access_token ?? '';
      const fd = new FormData(); fd.append('file', impFile); fd.append('mode', 'commit');
      fd.append('exclude', JSON.stringify([...impExclude]));
      fd.append('merge', JSON.stringify(Object.fromEntries(impMerge)));
      const r = await fetch('/api/finance/import-131', { method: 'POST', headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: fd });
      const j = await r.json();
      setImpPreview(j);
      if (j.error) { setImpMsg(j.error); return; }
      setImpMsg(`Đã lưu ${j.soDong.toLocaleString('vi-VN')} dòng (${fmtDateVN(j.tuNgay)} → ${fmtDateVN(j.denNgay)}). Đang tải lại báo cáo…`);
      if (!j.preview) { setImpExclude(new Set()); setImpMerge(new Map()); }
      setRefreshKey((k) => k + 1);
    } catch (e: any) { setImpMsg(e?.message ?? 'Lỗi'); }
    finally { setImpBusy(false); }
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Tài chính</h1>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Kỳ báo cáo:</label>
            <input type="month" value={thang} onChange={(e) => setThang(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]" />
            <button onClick={() => setRefreshKey((k) => k + 1)} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af]">Chạy báo cáo</button>
            {canImport && <button onClick={() => setImpOpen(true)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold hover:border-[#1e3a8a]">Import sổ 131</button>}
          </div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-slate-200">
          {([['cong-no', 'Công nợ khách hàng'], ['thu-tien', 'Bán hàng thu tiền']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? 'border border-b-0 border-slate-200 bg-white text-[#1e3a8a]' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
          ))}
        </div>

        {err && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
        {loading && <div className="py-10 text-center text-sm text-slate-600">Đang tải…</div>}

        {!loading && tab === 'cong-no' && debt && (
          <>
            <p className="mb-2 text-sm text-slate-700">
              Mốc kiểm tra: <b>{fmtDateVN(debt.D)}</b> → Ngày lập: <b>{fmtDateVN(debt.E)}</b> · Hạn cho phép: <b>{han} ngày</b>
            </p>
            <DebtTable rows={debt.rows ?? []} han={han} />
            <UnmatchedPanel thang={thang} refreshKey={refreshKey} />
          </>
        )}
        {!loading && tab === 'thu-tien' && coll && (
          <>
            <KeHoachBox thang={thang} onSaved={() => setRefreshKey((k) => k + 1)} />
            <CollectionsTable rows={coll.rows ?? []} plan={coll.plan ?? []} thang={thang} tinhKhac={tinhKhac} onTinhKhac={onTinhKhac} />
            {ytd && <YtdTable rows={ytd.rows ?? []} plan={ytd.plan ?? []} thang={thang} tinhKhac={tinhKhac} onTinhKhac={onTinhKhac} />}
            {ytdErr && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Báo cáo lũy kế năm chưa tải được — báo cáo tháng vẫn chạy bình thường. Nếu hệ thống vừa cập nhật, hãy chạy <b>migration 0034_collections_ytd</b> trong Supabase rồi bấm <b>Chạy báo cáo</b>. <span className="text-amber-600">({ytdErr})</span>
              </div>
            )}
            <UnmatchedPanel thang={thang} refreshKey={refreshKey} />
          </>
        )}

        {/* Dialog import */}
        {impOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <button aria-label="Đóng" onClick={() => { setImpOpen(false); setImpPreview(null); setImpFile(null); setImpMsg(''); setImpExclude(new Set()); setImpMerge(new Map()); }} className="absolute inset-0 bg-black/40" />
            <div role="dialog" className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Import sổ 131</h2>
                <button onClick={() => { setImpOpen(false); setImpPreview(null); setImpFile(null); setImpMsg(''); setImpExclude(new Set()); setImpMerge(new Map()); }} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100" aria-label="Đóng">×</button>
              </div>
              <p className="mb-3 text-xs text-slate-500">Chọn file Excel do MISA xuất (sheet TK131, hoặc bản có kèm DataKH để nạp số dư gốc). Lần sau chỉ cần sheet TK131.</p>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => { setImpFile(e.target.files?.[0] ?? null); setImpPreview(null); setImpMsg(''); setImpExclude(new Set()); setImpMerge(new Map()); }} className="mb-3 w-full text-sm" />
              <div className="flex gap-2">
                <button onClick={previewImport} disabled={impBusy || !impFile} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-[#1e3a8a] disabled:opacity-60">{impBusy ? 'Đang xử lý…' : 'Kiểm tra trước'}</button>
                <button onClick={commitImport} disabled={impBusy || !impPreview || impPreview.blocked || !!impPreview.error} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">Lưu vào hệ thống</button>
              </div>
              {impMsg && <p className="mt-2 text-sm text-red-600">{impMsg}</p>}
              {impPreview && (
                <div className="mt-3 space-y-2 text-sm">
                  <p>File: <b>{impFile?.name}</b> · {impPreview.soDong?.toLocaleString('vi-VN')} dòng ({fmtDateVN(impPreview.tuNgay)} → {fmtDateVN(impPreview.denNgay)})</p>
                  {(impPreview.kiemTra ?? []).map((k: any, i: number) => (
                    <div key={i} className={`rounded-md px-3 py-2 ${k.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                      {k.ok ? '✓' : '✗'} {k.ten}: {k.chiTiet}
                    </div>
                  ))}
                  {(impPreview.canhBao ?? []).map((c: string, i: number) => (
                    <div key={i} className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">⚠ {c}</div>
                  ))}
                  {(impPreview.khLa ?? []).length > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                        <p className="text-xs font-bold text-slate-800">Khách chưa có trong danh mục ({impPreview.khLa.length}) — chọn Thêm / Gộp / Bỏ qua cho từng mã:</p>
                        <button onClick={() => setImpExclude(new Set((impPreview.khLa as any[]).map((c: any) => c.ma_kh)))} className="text-xs text-slate-500 hover:underline">Bỏ qua tất cả</button>
                      </div>
                      <div className="max-h-[260px] overflow-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-amber-50 text-left text-slate-700"><th className="px-2 py-1">Mã KH</th><th className="px-2 py-1">Tên KH</th><th className="px-2 py-1">KD trong file</th><th className="px-2 py-1">Số dư cuối</th><th className="px-2 py-1">Xử lý</th></tr></thead>
                          <tbody>
                            {impPreview.khLa.map((c: any) => {
                              const isExcluded = impExclude.has(c.ma_kh);
                              const isMerged = impMerge.has(c.ma_kh);
                              const dup = !!c.mergeTo;
                              return (
                                <tr key={c.ma_kh} className={`border-t border-slate-100 ${isExcluded ? 'bg-slate-100 opacity-60' : isMerged ? 'bg-emerald-50' : dup ? 'bg-amber-50' : ''}`}>
                                  <td className="px-2 py-1 font-mono">{c.ma_kh}</td>
                                  <td className="px-2 py-1">
                                    <span>{c.ten_kh || '—'}</span>
                                    {isMerged && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">→ {impMerge.get(c.ma_kh)}</span>}
                                    {!isMerged && dup && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Trùng tên ({c.mergeTo})</span>}
                                    {isExcluded && <span className="ml-2 text-[10px] text-slate-500">(sẽ bỏ qua)</span>}
                                  </td>
                                  <td className="px-2 py-1">{c.nvkd || '—'}</td>
                                  <td className="px-2 py-1 text-right tabular-nums">{c.du_cuoi != null ? c.du_cuoi.toLocaleString('vi-VN') : '—'}</td>
                                  <td className="px-2 py-1">
                                    <select value={isExcluded ? 'bo-qua' : isMerged ? c.mergeTo : 'them'} onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'bo-qua') {
                                        setImpMerge((prev) => { const n = new Map(prev); n.delete(c.ma_kh); return n; });
                                        setImpExclude((prev) => new Set(prev).add(c.ma_kh));
                                      } else if (val === 'them') {
                                        setImpExclude((prev) => { const n = new Set(prev); n.delete(c.ma_kh); return n; });
                                        setImpMerge((prev) => { const n = new Map(prev); n.delete(c.ma_kh); return n; });
                                      } else {
                                        setImpExclude((prev) => { const n = new Set(prev); n.delete(c.ma_kh); return n; });
                                        setImpMerge((prev) => new Map(prev).set(c.ma_kh, val));
                                      }
                                    }} className="rounded border border-slate-200 px-1 py-1 text-xs">
                                      <option value="them">Thêm mới</option>
                                      {c.mergeTo && <option value={c.mergeTo}>Gộp → {c.mergeTo}</option>}
                                      <option value="bo-qua">Bỏ qua</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {impExclude.size > 0 && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">Đã bỏ qua {impExclude.size} khách — sẽ chỉ tạo {impPreview.khLa.length - impExclude.size - impMerge.size} khách mới + gộp {impMerge.size}.</p>}
                      {impMerge.size > 0 && <p className="border-t border-slate-100 px-3 py-2 text-xs text-emerald-700">Sẽ gộp {impMerge.size} khách vào mã đã có — doanh số vẫn tính đủ, dùng mã cũ.</p>}
                    </div>
                  )}
                  {impPreview.blocked && <p className="font-semibold text-red-600">Không cho lưu — sửa các lỗi ở trên rồi import lại.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
