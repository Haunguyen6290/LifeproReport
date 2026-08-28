'use client';
import { useEffect, useRef, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import * as echarts from 'echarts';

// ── theme ──
const COLORS = ['#16A97B', '#6B60E8', '#F59E0B', '#3B82F6', '#EC4899', '#EF4444', '#0891B2', '#8B5CF6', '#F97316', '#10B981', '#7C3AED', '#DC2626'];
const PRIMARY = '#16A97B';
const EC_BG = '#F0F4F8';

// ── helpers ──
function fmtMoney(n: number) {
  if (!n) return '0 đ';
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
function fmtFull(n: number) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ'; }
function fmts(n: number) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + ' k';
  return String(Math.round(n));
}
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function monthRange(y: number, m: number) { return { from: `${String(y)}-${String(m).padStart(2, '0')}-01`, to: `${String(y)}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}` }; }
function quarterRange(y: number, q: number) { const m1 = (q - 1) * 3 + 1, m2 = q * 3; return { from: `${String(y)}-${String(m1).padStart(2, '0')}-01`, to: `${String(y)}-${String(m2).padStart(2, '0')}-${String(daysInMonth(y, m2)).padStart(2, '0')}` }; }
function yearRange(y: number) { return { from: `${String(y)}-01-01`, to: `${String(y)}-12-31` }; }
function inferPeriod(from: string, to: string): { mode: PeriodMode; y?: number; m?: number; q?: number } {
  if (!from || !to) return { mode: 'custom' };
  const parse = (d: string) => { const [yy, mm, dd] = d.split('-').map(Number); return { y: yy, m: mm, d: dd }; };
  const a = parse(from), b = parse(to);
  if (isNaN(a.y) || isNaN(b.y)) return { mode: 'custom' };
  if (a.m === 1 && a.d === 1 && b.m === 12 && b.d === 31 && a.y === b.y) return { mode: 'year', y: a.y };
  if (a.m % 3 === 1 && a.d === 1 && b.d === daysInMonth(b.y, b.m) && a.y === b.y) {
    const qA = Math.ceil(a.m / 3), qB = Math.ceil(b.m / 3);
    if (qA === qB) return { mode: 'quarter', y: a.y, q: qA };
  }
  if (a.y === b.y && a.m === b.m && a.d === 1 && b.d === daysInMonth(b.y, b.m)) return { mode: 'month', y: a.y, m: a.m };
  return { mode: 'custom' };
}

type PeriodMode = 'month' | 'quarter' | 'year' | 'custom';
type QueryResult = {
  total: number; totalQty: number; count: number; soHoaDon: number; soKhachHang: number; avgValue: number;
  byKd: { label: string; value: number }[];
  byVung: { label: string; value: number }[];
  byNhom: { label: string; value: number }[];
  byHang: { label: string; value: number }[];
  byKh: { label: string; value: number }[];
  byMonth: { m: string; dt: number; hd: number }[];
  topSp: { label: string; total: number; qty: number; count: number }[];
  topSpQty: { label: string; total: number; qty: number; count: number }[];
  options: { kd: string[]; vung: string[]; nhom: string[]; kh: string[] };
  meta: { scanned: number; filtered: number };
};

function useChart(ref: React.RefObject<HTMLDivElement | null>, option: echarts.EChartsOption | null) {
  const inst = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current || !option) return;
    if (!inst.current) inst.current = echarts.init(ref.current);
    inst.current.setOption(option, true as any);
    const onResize = () => inst.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [option]);
  useEffect(() => () => { inst.current?.dispose(); inst.current = null; }, []);
}

function FilterDropdown({ label, options, selected, onChange, searchable }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; searchable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (options.length === 0) return null;
  const filtered = searchable && q.trim() ? options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40) : options.slice(0, searchable ? 50 : 200);
  const labelText = selected.length === 0 ? 'Tất cả' : selected.length === 1 ? selected[0] : `${selected.length} mục`;
  const toggle = (o: string) => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs hover:border-[#16A97B]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">{label}:</span>
        <span className="max-w-[130px] truncate font-medium text-[#1e293b]">{labelText}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-[#64748b] transition ${open ? 'rotate-180' : ''}`} aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg">
          {searchable && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm..." className="mb-2 w-full rounded border border-[#e2e8f0] px-2 py-1.5 text-sm outline-none focus:border-[#16A97B]" />}
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f0f4f8]">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
            Tất cả
          </label>
          {filtered.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f0f4f8]">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
              <span className="min-w-0 flex-1 truncate">{o}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1 text-xs text-[#64748b]">Không tìm thấy</p>}
        </div>
      )}
    </div>
  );
}

function DashboardInner() {
  const [mode, setMode] = useState<PeriodMode>('month');
  const [selYear, setSelYear] = useState<number>(() => new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selQuarter, setSelQuarter] = useState<number>(() => Math.ceil((new Date().getMonth() + 1) / 3));
  const nowRef = useRef(new Date());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [availableYears, setAvailableYears] = useState<number[]>(() => {
    const y = nowRef.current.getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3, y - 4].filter((v) => v >= 2020);
  });
  const [selKd, setSelKd] = useState<string[]>([]);
  const [selVung, setSelVung] = useState<string[]>([]);
  const [selNhom, setSelNhom] = useState<string[]>([]);
  const [selKh, setSelKh] = useState<string[]>([]);
  const [filterOpts, setFilterOpts] = useState<{ kd: string[]; vung: string[]; nhom: string[]; kh: string[] }>({ kd: [], vung: [], nhom: [], kh: [] });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [err, setErr] = useState('');

  // chart refs
  const cMonthlyRef = useRef<HTMLDivElement>(null);
  const cNhomRef = useRef<HTMLDivElement>(null);
  const cStaffRef = useRef<HTMLDivElement>(null);
  const cHangRef = useRef<HTMLDivElement>(null);

  // insight
  const insight = (() => {
    if (!result || result.total === 0) return null;
    const topKd = result.byKd[0];
    const topNhom = result.byNhom[0];
    const topSp = result.topSp[0];
    const maxMonth = result.byMonth.reduce((best, cur) => (cur.dt > (best?.dt ?? -1) ? cur : best), null as any);
    const totalStr = fmtFull(result.total);
    const t1 = `Tổng doanh thu ${fromDate.slice(0, 7)}–${toDate.slice(0, 7)} đạt ${fmtMoney(result.total)}. ${maxMonth ? `Tháng cao nhất: ${maxMonth.m} (${fmtMoney(maxMonth.dt)}).` : ''}`;
    const t2 = topKd ? `NV ${topKd.label} dẫn đầu với ${fmtMoney(topKd.value)} — chiếm ${((topKd.value / result.total) * 100).toFixed(0)}% tổng.` : '';
    const t3 = topNhom ? `Nhóm hàng lớn nhất: ${topNhom.label} chiếm ${((topNhom.value / result.total) * 100).toFixed(0)}% (${fmtMoney(topNhom.value)}).` : '';
    const t4 = topSp ? `Sản phẩm top: ${topSp.label.slice(0, 40)} với ${fmtMoney(topSp.total)}.` : '';
    return { t1, t2, t3, t4 };
  })();

  // chart options
  const monthlyOpt = (() => {
    if (!result) return null;
    const byMonth = result.byMonth;
    if (byMonth.length === 0) return null;
    const labels = byMonth.map((b) => b.m.replace('2026-', 'T').replace('2025-', 'T'));
    const vals = byMonth.map((b) => b.dt);
    const hds = byMonth.map((b) => b.hd);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.filter((v) => v > 0).length : 0;
    return {
      tooltip: { trigger: 'axis' as const, formatter: (p: any) => `${p[0].name}<br/>Doanh thu: ${fmtFull(p[0].value)}<br/>Số HĐ: ${p[1]?.value ?? 0}` },
      legend: { data: ['Doanh thu', 'Số HĐ'], bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 55, right: 55, top: 20, bottom: 35 },
      xAxis: { type: 'category' as const, data: labels },
      yAxis: [
        { type: 'value' as const, axisLabel: { formatter: (v: number) => fmts(v), fontSize: 10 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
        { type: 'value' as const, axisLabel: { fontSize: 10 }, splitLine: { show: false } },
      ],
      series: [
        { name: 'Doanh thu', type: 'bar' as const, data: vals, yAxisIndex: 0, itemStyle: { color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#16A97B' }, { offset: 1, color: '#6ee7b7' }]), borderRadius: [5, 5, 0, 0] }, label: { show: true, position: 'top' as const, formatter: (p: any) => fmts(p.value), fontSize: 10 } },
        { name: 'Số HĐ', type: 'line' as const, data: hds, yAxisIndex: 1, lineStyle: { color: '#6B60E8', width: 2 }, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#6B60E8' } },
        { name: 'Trung bình', type: 'line' as const, data: byMonth.map(() => avg), yAxisIndex: 0, lineStyle: { color: '#EF4444', type: 'dashed', width: 1.5 }, symbol: 'none' as const, tooltip: { show: false } as any },
      ],
    } as echarts.EChartsOption;
  })();

  const nhomOpt = (() => {
    if (!result) return null;
    const top8 = result.byNhom.slice(0, 8);
    if (top8.length === 0) return null;
    const other = result.byNhom.slice(8).reduce((s, x) => s + x.value, 0);
    const data = [...top8.map((x, i) => ({ name: x.label, value: x.value, itemStyle: { color: COLORS[i] } }))];
    if (other > 0) data.push({ name: 'Khác', value: other, itemStyle: { color: '#94a3b8' } } as any);
    return {
      tooltip: { trigger: 'item' as const, formatter: (p: any) => p.name + '<br/>' + fmtFull(p.value) + ' (' + p.percent + '%)' },
      legend: { bottom: 0, textStyle: { fontSize: 10 }, type: 'scroll' as const },
      series: [{ type: 'pie' as const, radius: ['38%', '65%'], center: ['50%', '44%'], data, label: { formatter: (p: any) => p.percent + '%', fontSize: 11 } }],
    } as echarts.EChartsOption;
  })();

  const staffOpt = (() => {
    if (!result) return null;
    const staff = result.byKd.filter((x) => x.value > 0);
    if (staff.length === 0) return null;
    return {
      tooltip: { trigger: 'axis' as const, formatter: (p: any) => p[0].name + '<br/>' + fmtFull(p[0].value), axisPointer: { type: 'shadow' as const } },
      grid: { left: 145, right: 60, top: 10, bottom: 30 },
      xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => fmts(v), fontSize: 10 } },
      yAxis: { type: 'category' as const, data: staff.map((e) => e.label).reverse(), axisLabel: { fontSize: 11, width: 135, overflow: 'truncate' as const } },
      series: [{ type: 'bar' as const, data: staff.map((e, i) => ({ value: e.value, itemStyle: { color: COLORS[staff.length - 1 - i] || COLORS[0], borderRadius: [0, 5, 5, 0] } })).reverse(), label: { show: true, position: 'right' as const, formatter: (p: any) => fmts(p.value), fontSize: 10 } }],
    } as echarts.EChartsOption;
  })();

  const hangOpt = (() => {
    if (!result) return null;
    const top6 = result.byHang.slice(0, 6);
    if (top6.length === 0) return null;
    const other = result.byHang.slice(6).reduce((s, x) => s + x.value, 0);
    const hData = [...top6.map((x, i) => ({ name: x.label, value: x.value, itemStyle: { color: [COLORS[1], COLORS[0], COLORS[2], COLORS[3], COLORS[4], COLORS[5]][i] } }))];
    if (other > 0) hData.push({ name: 'Khác', value: other, itemStyle: { color: '#94a3b8' } } as any);
    return {
      tooltip: { trigger: 'item' as const, formatter: (p: any) => p.name + '<br/>' + fmtFull(p.value) + ' (' + p.percent + '%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{ type: 'pie' as const, radius: ['38%', '65%'], center: ['50%', '44%'], data: hData, label: { formatter: (p: any) => p.percent + '%', fontSize: 11 } }],
    } as echarts.EChartsOption;
  })();

  useChart(cMonthlyRef, monthlyOpt);
  useChart(cNhomRef, nhomOpt);
  useChart(cStaffRef, staffOpt);
  useChart(cHangRef, hangOpt);

  async function fetchMeta() {
    try {
      const res = await fetch('/api/sales/meta');
      const j = await res.json();
      let didInit = false;
      if (j.months && Array.isArray(j.months) && j.months.length > 0) {
        const inf = j.months[0] as string;
        if (inf && /^\d{4}-\d{2}$/.test(inf)) {
          const [yStr, mStr] = inf.split('-');
          const y = Number(yStr), m = Number(mStr);
          if (!isNaN(y) && !isNaN(m)) {
            setSelYear(y); setSelMonth(m); setSelQuarter(Math.ceil(m / 3));
            const { from, to } = monthRange(y, m);
            setFromDate(from); setToDate(to);
            if (Array.isArray(j.years) && j.years.length > 0) {
              const ys = (j.years as string[]).map(Number).filter((n) => !isNaN(n)).sort((a, b) => b - a);
              if (ys.length) setAvailableYears(ys);
            }
            setMode('month');
            setInitializing(false);
            runQuery({ from, to, kd: [], vung: [], nhom: [], kh: [] });
            didInit = true;
          }
        }
      }
      if (didInit) return;
      if (Array.isArray(j.years) && j.years.length > 0) {
        const ys = (j.years as string[]).map(Number).filter((n) => !isNaN(n)).sort((a, b) => b - a);
        if (ys.length) setAvailableYears(ys);
      }
      const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
      const { from, to } = monthRange(y, m);
      setFromDate(from); setToDate(to);
      setInitializing(false);
      runQuery({ from, to, kd: [], vung: [], nhom: [], kh: [] });
    } catch {
      const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
      const { from, to } = monthRange(y, m);
      setFromDate(from); setToDate(to);
      setInitializing(false);
      runQuery({ from, to, kd: [], vung: [], nhom: [], kh: [] });
    }
  }

  useEffect(() => { fetchMeta(); }, []);

  async function runQuery(opts?: { from: string; to: string; kd: string[]; vung: string[]; nhom: string[]; kh: string[] }) {
    const f = opts?.from ?? fromDate;
    const t = opts?.to ?? toDate;
    if (!f || !t) { setErr('Vui lòng chọn Từ ngày và Đến ngày'); return; }
    if (f > t) { setErr('Từ ngày phải ≤ Đến ngày'); return; }
    setErr(''); setLoading(true);
    try {
      const body: any = { from: f, to: t };
      const kd = opts ? opts.kd : selKd;
      const vg = opts ? opts.vung : selVung;
      const nh = opts ? opts.nhom : selNhom;
      const khf = opts ? opts.kh : selKh;
      if (kd.length) body.kd = kd;
      if (vg.length) body.vung = vg;
      if (nh.length) body.nhom = nh;
      if (khf.length) body.kh = khf;
      const res = await fetch('/api/sales/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? 'Lỗi query');
      setResult(j);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }

  function onPickMode(next: PeriodMode) {
    setMode(next);
    if (next === 'month') { const { from, to } = monthRange(selYear, selMonth); setFromDate(from); setToDate(to); }
    else if (next === 'quarter') { const { from, to } = quarterRange(selYear, selQuarter); setFromDate(from); setToDate(to); }
    else if (next === 'year') { const { from, to } = yearRange(selYear); setFromDate(from); setToDate(to); }
  }
  function onChangeMonth(m: number) { setSelMonth(m); setSelQuarter(Math.ceil(m / 3)); const { from, to } = monthRange(selYear, m); setFromDate(from); setToDate(to); }
  function onChangeQuarter(q: number) { setSelQuarter(q); const { from, to } = quarterRange(selYear, q); setFromDate(from); setToDate(to); }
  function onChangeYear(y: number) {
    setSelYear(y);
    if (mode === 'month') { const { from, to } = monthRange(y, selMonth); setFromDate(from); setToDate(to); }
    else if (mode === 'quarter') { const { from, to } = quarterRange(y, selQuarter); setFromDate(from); setToDate(to); }
    else if (mode === 'year') { const { from, to } = yearRange(y); setFromDate(from); setToDate(to); }
  }
  function onChangeFrom(v: string) {
    setFromDate(v);
    if (v && toDate) {
      const inf = inferPeriod(v, toDate);
      if (inf.mode !== 'custom') { setMode(inf.mode); if (inf.y != null) setSelYear(inf.y); if (inf.m != null) { setSelMonth(inf.m); setSelQuarter(Math.ceil(inf.m / 3)); } if (inf.q != null) setSelQuarter(inf.q); }
      else setMode('custom');
    }
  }
  function onChangeTo(v: string) {
    setToDate(v);
    if (fromDate && v) {
      const inf = inferPeriod(fromDate, v);
      if (inf.mode !== 'custom') { setMode(inf.mode); if (inf.y != null) setSelYear(inf.y); if (inf.m != null) { setSelMonth(inf.m); setSelQuarter(Math.ceil(inf.m / 3)); } if (inf.q != null) setSelQuarter(inf.q); }
      else setMode('custom');
    }
  }

  const sel = 'rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#16A97B] focus:ring-1 focus:ring-[#16A97B]/20';

  if (initializing) return <AppSidebar><main className="px-6 py-10 text-sm text-[#64748b]">Đang tải...</main></AppSidebar>;

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6" style={{ background: EC_BG, minHeight: '100vh' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[#0f2a4a]">Báo cáo bán hàng</h1>
          <a href="/bao-cao-ban-hang/import" className="rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Import Excel</a>
        </div>

        {/* Kỳ — dòng 1 gọn 1 dòng: tabs + pickers + từ→đến + Chạy */}
        <div className="mb-3 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          {/* Dòng trên: Kỳ + pickers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Kỳ:</span>
            {(['month', 'quarter', 'year', 'custom'] as PeriodMode[]).map((m) => (
              <button key={m} onClick={() => onPickMode(m)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${mode === m ? 'bg-[#0f2a4a] text-white' : 'bg-white ring-1 ring-[#e2e8f0] text-[#334155] hover:bg-slate-50'}`}>
                {m === 'month' ? 'Tháng' : m === 'quarter' ? 'Quý' : m === 'year' ? 'Năm' : 'Tùy chọn'}
              </button>
            ))}
            <span className="mx-2 h-4 w-px bg-[#e2e8f0]" aria-hidden />
            {mode === 'month' && (
              <>
                <select value={selMonth} onChange={(e) => onChangeMonth(Number(e.target.value))} className={sel}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>Tháng {m}</option>)}
                </select>
                <select value={selYear} onChange={(e) => onChangeYear(Number(e.target.value))} className={sel}>
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {mode === 'quarter' && (
              <>
                <select value={selQuarter} onChange={(e) => onChangeQuarter(Number(e.target.value))} className={sel}>
                  {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                </select>
                <select value={selYear} onChange={(e) => onChangeYear(Number(e.target.value))} className={sel}>
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {mode === 'year' && (
              <select value={selYear} onChange={(e) => onChangeYear(Number(e.target.value))} className={sel}>
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {mode === 'custom' && <span className="text-xs text-[#64748b]">Chọn khoảng ngày bên dưới</span>}
            {/* Dòng dưới gộp cùng dòng: Từ → Đến + Chạy */}
            <span className="mx-2 h-4 w-px bg-[#e2e8f0]" aria-hidden />
            <span className="text-xs font-semibold text-[#64748b]">Từ</span>
            <input type="date" value={fromDate} onChange={(e) => onChangeFrom(e.target.value)} className={sel} />
            <span className="text-[#64748b]">→</span>
            <span className="text-xs font-semibold text-[#64748b]">Đến</span>
            <input type="date" value={toDate} onChange={(e) => onChangeTo(e.target.value)} className={sel} />
            <button onClick={() => runQuery()} disabled={loading || !fromDate || !toDate} className="rounded-lg bg-[#0d6efd] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#0f2a4a] disabled:opacity-60">
              {loading ? 'Đang chạy…' : 'Chạy báo cáo'}
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>

        {/* Dòng 2 — Bộ lọc */}
        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <span className="self-center text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Lọc:</span>
          <FilterDropdown label="NV" options={result?.options?.kd ?? filterOpts.kd} selected={selKd} onChange={setSelKd} />
          <FilterDropdown label="Tỉnh" options={result?.options?.vung ?? filterOpts.vung} selected={selVung} onChange={setSelVung} />
          <FilterDropdown label="Nhóm hàng" options={result?.options?.nhom ?? filterOpts.nhom} selected={selNhom} onChange={setSelNhom} />
          <FilterDropdown label="Khách hàng" options={result?.options?.kh ?? filterOpts.kh} selected={selKh} onChange={setSelKh} searchable />
        </div>

        {!result ? (
          <p className="py-10 text-center text-sm text-[#64748b]">Chọn kỳ và bấm Chạy báo cáo để xem dữ liệu.</p>
        ) : (
          <>
            {/* Insights */}
            {(() => {
              if (!insight || result.total === 0) return null;
              return (
                <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-[#6ee7b7] bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] px-4 py-3">
                  <div className="flex min-w-[200px] flex-1 items-start gap-2 text-xs leading-relaxed text-[#065f46]"><span>💰</span><span dangerouslySetInnerHTML={{ __html: insight.t1.replace(/<strong>(.*?)<\/strong>/g, '<strong style="font-weight:700">$1</strong>') }} /></div>
                  <div className="flex min-w-[200px] flex-1 items-start gap-2 text-xs leading-relaxed text-[#065f46]"><span>🏆</span><span>{insight.t2}</span></div>
                  <div className="flex min-w-[200px] flex-1 items-start gap-2 text-xs leading-relaxed text-[#065f46]"><span>📦</span><span>{insight.t3}</span></div>
                  <div className="flex min-w-[200px] flex-1 items-start gap-2 text-xs leading-relaxed text-[#065f46]"><span>🎯</span><span>{insight.t4}</span></div>
                </div>
              );
            })()}

            {/* 5 KPI */}
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { cls: 'kpi-g', lbl: 'Tổng doanh thu', val: fmtMoney(result.total), sub: `TB/tháng: ${result.byMonth.length ? fmtMoney(result.total / result.byMonth.length) : '–'}` },
                { cls: 'kpi-p', lbl: 'Tổng số lượng', val: result.totalQty.toLocaleString('vi-VN') + ' sp', sub: `TB/đơn: ${result.soHoaDon ? (result.totalQty / result.soHoaDon).toFixed(1) : 0} sp` },
                { cls: 'kpi-a', lbl: 'Số hóa đơn', val: result.soHoaDon.toLocaleString('vi-VN'), sub: `${result.byMonth.length} tháng` },
                { cls: 'kpi-b', lbl: 'Số khách hàng', val: result.soKhachHang.toLocaleString('vi-VN'), sub: `${result.byKd.length} nhân viên KD` },
                { cls: 'kpi-k', lbl: 'Giá trị TB/đơn', val: fmtMoney(result.avgValue), sub: `${(() => { const s = new Set(result.byNhom.map((x) => x.label)); return s.size; })()} nhóm hàng` },
              ].map((k) => (
                <div key={k.lbl} className={`kpi-card ${k.cls} relative overflow-hidden rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]`} style={{ borderTop: `3px solid ${k.cls === 'kpi-g' ? '#16A97B' : k.cls === 'kpi-p' ? '#6B60E8' : k.cls === 'kpi-a' ? '#F59E0B' : k.cls === 'kpi-b' ? '#3B82F6' : '#EC4899'}` }}>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-[#64748b]">{k.lbl}</div>
                  <div className="mt-1 text-[20px] font-bold tracking-tight text-[#1e293b]">{k.val}</div>
                  <div className="mt-1 text-[11px] text-[#64748b]">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* 4 charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: PRIMARY }} />Doanh thu theo tháng</div>
                <div ref={cMonthlyRef} style={{ width: '100%', height: 280 }} />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#6B60E8' }} />Cơ cấu nhóm hàng (Top 8)</div>
                <div ref={cNhomRef} style={{ width: '100%', height: 280 }} />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#3B82F6' }} />Doanh thu theo nhân viên</div>
                <div ref={cStaffRef} style={{ width: '100%', height: 280 }} />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />Cơ cấu hãng sản xuất</div>
                <div ref={cHangRef} style={{ width: '100%', height: 280 }} />
              </div>
            </div>

            {/* Top SP */}
            <div className="mt-4 rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />Top sản phẩm — doanh thu</div>
              {result.topSp.length === 0 ? <p className="py-4 text-center text-sm text-[#64748b]">Chưa có dữ liệu</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#e2e8f0] text-left text-xs font-bold text-[#64748b]"><th className="py-2">#</th><th className="py-2">Sản phẩm</th><th className="py-2 text-right">SL</th><th className="py-2 text-right">Doanh số</th></tr></thead>
                    <tbody>
                      {result.topSp.slice(0, 10).map((r, i) => (
                        <tr key={r.label} className="border-t border-[#f1f5f9]">
                          <td className="py-2 text-[#64748b]">{i + 1}</td>
                          <td className="py-2 font-medium text-[#1e293b] line-clamp-1">{r.label}</td>
                          <td className="py-2 text-right">{r.qty.toLocaleString('vi-VN')}</td>
                          <td className="py-2 text-right font-semibold text-[#0d7a59]">{fmtFull(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {result.count === 0 && <p className="mt-4 rounded-lg bg-amber-50 p-4 text-center text-sm text-amber-800">Không có dữ liệu trong kỳ/bộ lọc này.</p>}
          </>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><DashboardInner /></RequireAuth>; }
