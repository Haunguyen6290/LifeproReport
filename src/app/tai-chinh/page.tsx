'use client';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { fmtDateVN } from '@/lib/time';

type DebtRow = {
  ma_kh: string; ten_kh: string; nvkd: string; tinh: string;
  cong_no_dau_ky: number; doanh_thu: number; tra_lai: number; thu_tien: number;
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
  const [sortKey, setSortKey] = useState<'con_thieu' | 'cong_no_dau_ky' | 'doanh_thu'>('con_thieu');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const nvkds = useMemo(() => [...new Set(rows.map((r) => r.nvkd).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [rows]);

  const filtered = useMemo(() => {
    let f = rows;
    if (fState === 'qua-han') f = f.filter((r) => r.qua_han);
    if (fState === 'dat') f = f.filter((r) => !r.qua_han);
    if (fNvkd) f = f.filter((r) => r.nvkd === fNvkd);
    const q = fQ.trim().toLowerCase();
    if (q) f = f.filter((r) => r.ten_kh.toLowerCase().includes(q) || r.ma_kh.toLowerCase().includes(q));
    return [...f].sort((a, b) => { const d = (sortDir === 'asc' ? 1 : -1); return (a[sortKey] - b[sortKey]) * d || a.ma_kh.localeCompare(b.ma_kh); });
  }, [rows, fState, fNvkd, fQ, sortKey, sortDir]);

  const totals = useMemo(() => filtered.reduce((t, r) => { t.cndk += r.cong_no_dau_ky; t.dt += r.doanh_thu; t.tl += r.tra_lai; t.tt += r.thu_tien; t.giam += r.tong_giam_tru; t.thieu += r.con_thieu; return t; }, { cndk: 0, dt: 0, tl: 0, tt: 0, giam: 0, thieu: 0 }), [filtered]);

  const nQuaHan = rows.filter((r) => r.qua_han).length;

  function exportExcel() {
    const data = filtered.map((r, i) => ({
      'STT': i + 1, 'Mã KH': r.ma_kh, 'Tên KH': r.ten_kh, 'NVKD': r.nvkd, 'Tỉnh/TP': r.tinh,
      'Công nợ đầu kỳ': r.cong_no_dau_ky, 'Doanh số phát sinh trong kỳ': r.doanh_thu,
      'Doanh số hàng trả lại': r.tra_lai, 'Doanh thu thu tiền': r.thu_tien,
      'Tổng giảm trừ': r.tong_giam_tru, 'Số còn thiếu': r.con_thieu,
      'Cảnh báo': r.qua_han ? 'QUÁ HẠN' : 'Đạt yêu cầu',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cong_no_qua_han');
    XLSX.writeFile(wb, `Cong_no_qua_han_${nowYM()}.xlsx`);
  }

  const thBtn = (key: typeof sortKey, label: string) => (
    <th className="whitespace-nowrap px-3 py-2">
      <button onClick={() => { if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('desc'); } }} className="flex w-full items-center justify-end gap-1 text-right font-bold">
        {label}{sortKey === key ? <span>{sortDir === 'asc' ? '↑' : '↓'}</span> : <span className="text-slate-400">↕</span>}
      </button>
    </th>
  );

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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
              <th className="whitespace-nowrap px-3 py-2 font-bold">STT</th>
              <th className="whitespace-nowrap px-3 py-2 font-bold">Mã KH</th>
              <th className="px-3 py-2 font-bold">Tên KH</th>
              <th className="whitespace-nowrap px-3 py-2 font-bold">NVKD</th>
              {thBtn('cong_no_dau_ky', 'Công nợ đầu kỳ')}
              {thBtn('doanh_thu', 'DS phát sinh trong kỳ')}
              <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Trả lại</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Thu tiền</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Tổng giảm trừ</th>
              {thBtn('con_thieu', 'Số còn thiếu')}
              <th className="whitespace-nowrap px-3 py-2 font-bold">Cảnh báo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r, i) => (
              <tr key={r.ma_kh} className={r.qua_han ? 'bg-red-50' : 'hover:bg-slate-50'}>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{i + 1}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.ma_kh}</td>
                <td className="px-3 py-2">{r.ten_kh}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.nvkd || '—'}</td>
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
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td colSpan={4} className="px-3 py-2 text-right">Tổng cộng</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totals.cndk)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totals.dt)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totals.tl)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totals.tt)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(totals.giam)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-red-700">{fmt(totals.thieu)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Hạn công nợ đang áp dụng: {han} ngày · Danh sách hiện toàn bộ khách hàng có số dư gốc, sắp xếp theo Số còn thiếu giảm dần.</p>
    </div>
  );
}

function CollectionsTable({ rows, plan, thang }: { rows: CollRow[]; plan: PlanRow[]; thang: string }) {
  const planThang = useMemo(() => plan.filter((p) => p.thang === thang), [plan, thang]);
  const miens = useMemo(() => [...new Set(planThang.map((p) => p.mien).filter(Boolean))], [planThang]);

  const byNvkd = useMemo(() => new Map(rows.map((r) => [r.nvkd, r])), [rows]);
  const totalDS = rows.reduce((a, r) => a + r.doanh_so, 0);
  const totalThu = rows.reduce((a, r) => a + r.thu_tien, 0);

  // gộp NVKD trong rows nhưng không có plan của tháng này → cột "Khác"
  const knownNames = new Set(planThang.map((p) => p.ten));
  const others = rows.filter((r) => !knownNames.has(r.nvkd));

  return (
    <div className="space-y-4">
      {planThang.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Chưa có kế hoạch cho tháng này. Vào <b>Cài đặt chung → Công nợ &amp; Tài chính → Kế hoạch NVKD theo tháng</b> để khai báo.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-[#eff6ff] text-[#1e3a8a]">
              <th className="whitespace-nowrap px-3 py-2 text-left font-bold" rowSpan={2}>Chỉ tiêu</th>
              {miens.map((m) => (
                <th key={m} colSpan={planThang.filter((p) => p.mien === m).length + 1} className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold">{m}</th>
              ))}
              {others.length > 0 && <th className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold" rowSpan={2}>Khác</th>}
              <th className="whitespace-nowrap border-l border-slate-200 px-3 py-2 text-center font-bold" rowSpan={2}>Tổng công ty</th>
            </tr>
            <tr className="bg-[#f8fafc] text-xs text-slate-600">
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => <th key={p.ten} className="whitespace-nowrap border-l border-slate-200 px-3 py-1.5 text-center font-semibold">{p.ten}</th>))}
              {miens.map((m) => <th key={m} className="whitespace-nowrap px-3 py-1.5 text-center font-semibold">Tổng {m}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Doanh số bán hàng */}
            <tr><td className="px-3 py-2 font-bold text-[#0f2a4a]">Doanh số bán hàng</td></tr>
            <tr>
              <td className="px-3 py-2 text-slate-600">Kế hoạch</td>
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => <td key={p.ten} className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{fmt(p.kh_doanh_so)}</td>))}
              {miens.map((m) => { const s = planThang.filter((p) => p.mien === m).reduce((a, p) => a + p.kh_doanh_so, 0); return <td key={m} className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(s)}</td>; })}
              {others.length > 0 && <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">—</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{fmt(planThang.reduce((a, p) => a + p.kh_doanh_so, 0))}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-600">Thực hiện</td>
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => { const r = byNvkd.get(p.ten); return <td key={p.ten} className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{fmt(r?.doanh_so ?? 0)}</td>; }))}
              {miens.map((m) => { const s = planThang.filter((p) => p.mien === m).reduce((a, p) => a + (byNvkd.get(p.ten)?.doanh_so ?? 0), 0); return <td key={m} className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(s)}</td>; })}
              {others.length > 0 && <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{fmt(others.reduce((a, r) => a + r.doanh_so, 0))}</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{fmt(totalDS)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-600">% thực hiện</td>
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => { const r = byNvkd.get(p.ten); return <td key={p.ten} className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{pct(r?.doanh_so ?? 0, p.kh_doanh_so)}</td>; }))}
              {miens.map((m) => { const ke = planThang.filter((p) => p.mien === m).reduce((a, p) => a + p.kh_doanh_so, 0); const th = planThang.filter((p) => p.mien === m).reduce((a, p) => a + (byNvkd.get(p.ten)?.doanh_so ?? 0), 0); return <td key={m} className="px-3 py-2 text-right font-semibold tabular-nums">{pct(th, ke)}</td>; })}
              {others.length > 0 && <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">—</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{pct(totalDS, planThang.reduce((a, p) => a + p.kh_doanh_so, 0))}</td>
            </tr>

            {/* Doanh thu thu tiền */}
            <tr><td className="px-3 py-2 font-bold text-[#0f2a4a]">Doanh thu thu tiền</td></tr>
            <tr>
              <td className="px-3 py-2 text-slate-600">Kế hoạch</td>
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => <td key={p.ten} className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{fmt(p.kh_thu_tien)}</td>))}
              {miens.map((m) => { const s = planThang.filter((p) => p.mien === m).reduce((a, p) => a + p.kh_thu_tien, 0); return <td key={m} className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(s)}</td>; })}
              {others.length > 0 && <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">—</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{fmt(planThang.reduce((a, p) => a + p.kh_thu_tien, 0))}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-600">Thực hiện</td>
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => { const r = byNvkd.get(p.ten); return <td key={p.ten} className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{fmt(r?.thu_tien ?? 0)}</td>; }))}
              {miens.map((m) => { const s = planThang.filter((p) => p.mien === m).reduce((a, p) => a + (byNvkd.get(p.ten)?.thu_tien ?? 0), 0); return <td key={m} className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(s)}</td>; })}
              {others.length > 0 && <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{fmt(others.reduce((a, r) => a + r.thu_tien, 0))}</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{fmt(totalThu)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-600">% thực hiện</td>
              {miens.map((m) => planThang.filter((p) => p.mien === m).map((p) => { const r = byNvkd.get(p.ten); return <td key={p.ten} className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">{pct(r?.thu_tien ?? 0, p.kh_thu_tien)}</td>; }))}
              {miens.map((m) => { const ke = planThang.filter((p) => p.mien === m).reduce((a, p) => a + p.kh_thu_tien, 0); const th = planThang.filter((p) => p.mien === m).reduce((a, p) => a + (byNvkd.get(p.ten)?.thu_tien ?? 0), 0); return <td key={m} className="px-3 py-2 text-right font-semibold tabular-nums">{pct(th, ke)}</td>; })}
              {others.length > 0 && <td className="border-l border-slate-100 px-3 py-2 text-right tabular-nums">—</td>}
              <td className="border-l border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{pct(totalThu, planThang.reduce((a, p) => a + p.kh_thu_tien, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {others.length > 0 && (
        <p className="text-xs text-slate-500">Cột "Khác": doanh số/thu tiền của kinh doanh chưa có kế hoạch tháng này — {others.map((r) => r.nvkd).join(', ')}.</p>
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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // import
  const [impOpen, setImpOpen] = useState(false);
  const [impFile, setImpFile] = useState<File | null>(null);
  const [impPreview, setImpPreview] = useState<any>(null);
  const [impBusy, setImpBusy] = useState(false);
  const [impMsg, setImpMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const canImport = can('quan_ly_cai_dat');

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
      setLoading(true); setErr('');
      try {
        const r = await fetch(`/api/finance/collections?thang=${thang}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? 'Lỗi tải báo cáo');
        setColl(j);
      } catch (e: any) { setErr(e?.message ?? 'Lỗi'); setColl(null); }
      finally { setLoading(false); }
    })();
  }, [tab, thang, refreshKey]);

  async function previewImport() {
    if (!impFile) { setImpMsg('Chọn file trước.'); return; }
    setImpBusy(true); setImpMsg(''); setImpPreview(null);
    try {
      const fd = new FormData(); fd.append('file', impFile); fd.append('mode', 'preview');
      const r = await fetch('/api/finance/import-131', { method: 'POST', body: fd });
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
      const fd = new FormData(); fd.append('file', impFile); fd.append('mode', 'commit');
      const r = await fetch('/api/finance/import-131', { method: 'POST', body: fd });
      const j = await r.json();
      setImpPreview(j);
      if (j.error) { setImpMsg(j.error); return; }
      setImpMsg(`Đã lưu ${j.soDong.toLocaleString('vi-VN')} dòng (${fmtDateVN(j.tuNgay)} → ${fmtDateVN(j.denNgay)}). Đang tải lại báo cáo…`);
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
            <input type="month" value={thang} onChange={(e) => setThang(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]" />
            {canImport && <button onClick={() => setImpOpen(true)} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Import sổ 131</button>}
          </div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-slate-200">
          {([['cong-no', 'Công nợ quá hạn'], ['thu-tien', 'Bán hàng thu tiền']] as const).map(([k, label]) => (
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
          </>
        )}
        {!loading && tab === 'thu-tien' && coll && <CollectionsTable rows={coll.rows ?? []} plan={coll.plan ?? []} thang={thang} />}

        {/* Dialog import */}
        {impOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <button aria-label="Đóng" onClick={() => { setImpOpen(false); setImpPreview(null); setImpFile(null); setImpMsg(''); }} className="absolute inset-0 bg-black/40" />
            <div role="dialog" className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Import sổ 131</h2>
                <button onClick={() => { setImpOpen(false); setImpPreview(null); setImpFile(null); setImpMsg(''); }} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100" aria-label="Đóng">×</button>
              </div>
              <p className="mb-3 text-xs text-slate-500">Chọn file Excel do MISA xuất (sheet TK131, hoặc bản có kèm DataKH để nạp số dư gốc). Lần sau chỉ cần sheet TK131.</p>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => { setImpFile(e.target.files?.[0] ?? null); setImpPreview(null); setImpMsg(''); }} className="mb-3 w-full text-sm" />
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
