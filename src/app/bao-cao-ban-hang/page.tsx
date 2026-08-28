'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// ── helpers ──
function fmtMoney(n: number) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ'; }
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); } // m 1-12
function monthRange(y: number, m: number) { return { from: `${String(y)}-${String(m).padStart(2, '0')}-01` as string, to: `${String(y)}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}` as string }; }
function quarterRange(y: number, q: number) { const m1 = (q - 1) * 3 + 1, m2 = q * 3; return { from: `${String(y)}-${String(m1).padStart(2, '0')}-01`, to: `${String(y)}-${String(m2).padStart(2, '0')}-${String(daysInMonth(y, m2)).padStart(2, '0')}` }; }
function yearRange(y: number) { return { from: `${String(y)}-01-01`, to: `${String(y)}-12-31` }; }

function inferPeriod(from: string, to: string): { mode: PeriodMode; y?: number; m?: number; q?: number } {
  if (!from || !to) return { mode: 'custom' };
  const parse = (d: string) => { const [yy, mm, dd] = d.split('-').map(Number); return { y: yy, m: mm, d: dd }; };
  const a = parse(from), b = parse(to);
  if (isNaN(a.y) || isNaN(b.y)) return { mode: 'custom' };
  // full year?
  if (a.m === 1 && a.d === 1 && b.m === 12 && b.d === 31 && a.y === b.y) return { mode: 'year', y: a.y };
  // full quarter?
  if (a.m % 3 === 1 && a.d === 1 && b.d === daysInMonth(b.y, b.m) && a.y === b.y) {
    const qA = Math.ceil(a.m / 3), qB = Math.ceil(b.m / 3);
    if (qA === qB) return { mode: 'quarter', y: a.y, q: qA };
  }
  // full month?
  if (a.y === b.y && a.m === b.m && a.d === 1 && b.d === daysInMonth(b.y, b.m)) return { mode: 'month', y: a.y, m: a.m };
  return { mode: 'custom' };
}

type PeriodMode = 'month' | 'quarter' | 'year' | 'custom';

function BarChart({ labels, data, title }: { labels: string[]; data: number[]; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (labels.length === 0) return;
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: { labels, datasets: [{ label: title, data, backgroundColor: '#0d6efd', borderRadius: 6 as any, barThickness: labels.length > 10 ? 18 : 28 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` ${fmtMoney(ctx.parsed.y)}` } } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v: any) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(Number(v)) } },
          x: { ticks: { maxRotation: 30 } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [labels, data, title]);
  if (labels.length === 0) return <p className="py-6 text-center text-sm text-slate-500">Chưa có dữ liệu</p>;
  return <div className="h-[280px]"><canvas ref={ref} /></div>;
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
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:border-[#1e3a8a]">
        <span className="text-xs font-semibold text-slate-600">{label}:</span>
        <span className="max-w-[160px] truncate font-medium text-slate-900">{labelText}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {searchable && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm..." className="mb-2 w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-[#1e3a8a]" />}
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} />
            Tất cả
          </label>
          {filtered.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
              <span className="min-w-0 flex-1 truncate">{o}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1 text-xs text-slate-500">Không tìm thấy</p>}
        </div>
      )}
    </div>
  );
}

type QueryResult = {
  total: number; count: number;
  byKd: { label: string; value: number }[];
  byVung: { label: string; value: number }[];
  byNhom: { label: string; value: number }[];
  byKh: { label: string; value: number }[];
  topSp: { label: string; total: number; count: number }[];
  options: { kd: string[]; vung: string[]; nhom: string[]; kh: string[] };
  meta: { scanned: number; filtered: number };
};

function DashboardInner() {
  // period — dòng trên (tabs) + dòng dưới (từ → đến)
  const [mode, setMode] = useState<PeriodMode>('month');
  const [selYear, setSelYear] = useState<number>(() => new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selQuarter, setSelQuarter] = useState<number>(() => Math.ceil((new Date().getMonth() + 1) / 3));
  const nowRef = useRef(new Date());

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // derive years available from meta, fallback to current year ±5
  const [availableYears, setAvailableYears] = useState<number[]>(() => {
    const y = nowRef.current.getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3, y - 4].filter((v) => v >= 2020);
  });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // filters
  const [selKd, setSelKd] = useState<string[]>([]);
  const [selVung, setSelVung] = useState<string[]>([]);
  const [selNhom, setSelNhom] = useState<string[]>([]);
  const [selKh, setSelKh] = useState<string[]>([]);
  const [filterOpts, setFilterOpts] = useState<{ kd: string[]; vung: string[]; nhom: string[]; kh: string[] }>({ kd: [], vung: [], nhom: [], kh: [] });

  // result
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [err, setErr] = useState('');
  const [hasRun, setHasRun] = useState(false);

  async function fetchMeta() {
    try {
      const res = await fetch('/api/sales/meta');
      const j = await res.json();
      if (j.months && Array.isArray(j.months) && j.months.length > 0) {
        setAvailableMonths(j.months);
        const inf = j.months[0] as string; // YYYY-MM latest
        if (inf && /^\d{4}-\d{2}$/.test(inf)) {
          const [yStr, mStr] = inf.split('-');
          const y = Number(yStr), m = Number(mStr);
          if (!isNaN(y) && !isNaN(m)) {
            setSelYear(y); setSelMonth(m); selQuarter; // keep quarter consistent
            const q = Math.ceil(m / 3);
            setSelQuarter(q);
            const { from, to } = monthRange(y, m);
            setFromDate(from); setToDate(to);
            // also set years from meta
            if (Array.isArray(j.years) && j.years.length > 0) {
              const ys = (j.years as string[]).map(Number).filter((n) => !isNaN(n)).sort((a, b) => b - a);
              if (ys.length) setAvailableYears(ys);
            }
            setMode('month');
            setInitializing(false);
            // auto-run once with latest month
            runQuery({ from, to, kd: [], vung: [], nhom: [], kh: [] });
            return;
          }
        }
      }
      if (Array.isArray(j.years) && j.years.length > 0) {
        const ys = (j.years as string[]).map(Number).filter((n) => !isNaN(n)).sort((a, b) => b - a);
        if (ys.length) setAvailableYears(ys);
      }
      if (Array.isArray(j.kd)) setFilterOpts((p) => ({ ...p, kd: j.kd }));
      if (Array.isArray(j.vung)) setFilterOpts((p) => ({ ...p, vung: j.vung }));
      if (Array.isArray(j.nhom)) setFilterOpts((p) => ({ ...p, nhom: j.nhom }));
      if (Array.isArray(j.kh)) setFilterOpts((p) => ({ ...p, kh: j.kh }));
      // fallback: current month
      const y = nowRef.current.getFullYear(), m = nowRef.current.getMonth() + 1;
      const { from, to } = monthRange(y, m);
      setFromDate(from); setToDate(to);
      setInitializing(false);
      runQuery({ from, to, kd: [], vung: [], nhom: [], kh: [] });
    } catch {
      const y = nowRef.current.getFullYear(), m = nowRef.current.getMonth() + 1;
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
      setFilterOpts({ kd: j.options?.kd ?? [], vung: j.options?.vung ?? [], nhom: j.options?.nhom ?? [], kh: j.options?.kh ?? [] });
      // update derived years from meta if needed (keep availableYears for picker)
      if (Array.isArray(j.meta?.months) && j.meta.months.length === 0 && (j.options?.kd?.length ?? 0) === 0) {
        // empty — keep previous
      }
      setHasRun(true);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }

  // Khi đổi mode tab — điền từ/đến theo năm/tháng/quý hiện chọn; không tự chạy
  function onPickMode(next: PeriodMode) {
    setMode(next);
    if (next === 'month') {
      const { from, to } = monthRange(selYear, selMonth);
      setFromDate(from); setToDate(to);
    } else if (next === 'quarter') {
      const { from, to } = quarterRange(selYear, selQuarter);
      setFromDate(from); setToDate(to);
    } else if (next === 'year') {
      const { from, to } = yearRange(selYear);
      setFromDate(from); setToDate(to);
    }
    // custom: giữ from/to hiện tại
  }

  function onChangeMonth(m: number) {
    setSelMonth(m);
    setSelQuarter(Math.ceil(m / 3));
    const { from, to } = monthRange(selYear, m);
    setFromDate(from); setToDate(to);
  }
  function onChangeQuarter(q: number) {
    setSelQuarter(q);
    const { from, to } = quarterRange(selYear, q);
    setFromDate(from); setToDate(to);
  }
  function onChangeYear(y: number) {
    setSelYear(y);
    if (mode === 'month') { const { from, to } = monthRange(y, selMonth); setFromDate(from); setToDate(to); }
    else if (mode === 'quarter') { const { from, to } = quarterRange(y, selQuarter); setFromDate(from); setToDate(to); }
    else if (mode === 'year') { const { from, to } = yearRange(y); setFromDate(from); setToDate(to); }
  }

  // Khi gõ tay từ/đến — tự suy ra mode + năm/tháng/quý tương ứng
  function onChangeFrom(v: string) {
    setFromDate(v);
    if (v && toDate) {
      const inf = inferPeriod(v, toDate);
      if (inf.mode !== 'custom') {
        setMode(inf.mode);
        if (inf.y != null) setSelYear(inf.y);
        if (inf.m != null) { setSelMonth(inf.m); setSelQuarter(Math.ceil(inf.m / 3)); }
        if (inf.q != null) setSelQuarter(inf.q);
      } else {
        // keep mode? show derived hint instead of switching to custom immediately — but spec says auto-jump
        // We'll keep mode as 'custom' only if user clearly types a non-aligned range
        // To avoid jumpy, only switch when truly custom
        setMode('custom');
      }
    }
  }
  function onChangeTo(v: string) {
    setToDate(v);
    if (fromDate && v) {
      const inf = inferPeriod(fromDate, v);
      if (inf.mode !== 'custom') {
        setMode(inf.mode);
        if (inf.y != null) setSelYear(inf.y);
        if (inf.m != null) { setSelMonth(inf.m); setSelQuarter(Math.ceil(inf.m / 3)); }
        if (inf.q != null) setSelQuarter(inf.q);
      } else {
        setMode('custom');
      }
    }
  }

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';
  const sel = 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]';

  // Derive hint text for current from/to
  const inferred = useMemo(() => inferPeriod(fromDate, toDate), [fromDate, toDate]);

  if (initializing) return <AppSidebar><main className="px-6 py-10 text-slate-600">Đang tải...</main></AppSidebar>;

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Báo cáo bán hàng</h1>
          <a href="/bao-cao-ban-hang/import" className="rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Import Excel</a>
        </div>

        {/* Kỳ — dòng trên: Tháng/Quý/Năm/Tùy chọn + pickers */}
        <div className={`${card} mb-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Kỳ:</span>
            {(['month', 'quarter', 'year', 'custom'] as PeriodMode[]).map((m) => (
              <button key={m} onClick={() => onPickMode(m)} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m ? 'bg-[#0f2a4a] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {m === 'month' ? 'Tháng' : m === 'quarter' ? 'Quý' : m === 'year' ? 'Năm' : 'Tùy chọn'}
              </button>
            ))}
          </div>

          {/* Pickers theo mode */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            {mode === 'custom' && (
              <span className="text-xs text-slate-500">Chọn khoảng ngày bên dưới</span>
            )}
            {inferred.mode !== 'custom' && inferred.mode !== mode && (
              <span className="text-xs text-amber-600">→ Đang khớp: {inferred.mode === 'month' ? `Tháng ${inferred.m}/${inferred.y}` : inferred.mode === 'quarter' ? `Q${inferred.q} ${inferred.y}` : `${inferred.y}`}</span>
            )}
          </div>

          {/* Dòng dưới: Từ ngày → Đến ngày (luôn hiện) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Từ ngày</label>
            <input type="date" value={fromDate} onChange={(e) => onChangeFrom(e.target.value)} className={sel} />
            <span className="text-slate-500">→</span>
            <label className="text-xs font-semibold text-slate-600">Đến ngày</label>
            <input type="date" value={toDate} onChange={(e) => onChangeTo(e.target.value)} className={sel} />
            <button
              onClick={() => runQuery()}
              disabled={loading || !fromDate || !toDate}
              className="ml-2 rounded-lg bg-[#0d6efd] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#0f2a4a] disabled:opacity-60"
            >
              {loading ? 'Đang chạy…' : 'Chạy báo cáo'}
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>

        {/* Filters — dropdowns */}
        <div className={`${card} mb-4 flex flex-wrap gap-2`}>
          <FilterDropdown label="Nhân viên" options={filterOpts.kd} selected={selKd} onChange={setSelKd} />
          <FilterDropdown label="Tỉnh" options={filterOpts.vung} selected={selVung} onChange={setSelVung} />
          <FilterDropdown label="Nhóm hàng" options={filterOpts.nhom} selected={selNhom} onChange={setSelNhom} />
          <FilterDropdown label="Khách hàng" options={filterOpts.kh} selected={selKh} onChange={setSelKh} searchable />
        </div>

        {/* KPI — chỉ hiện sau khi Chạy */}
        {result ? (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div className={`${card} bg-gradient-to-br from-[#0f2a4a] to-[#1e40af] text-white border-0`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Tổng doanh số</p>
                <p className="mt-1 text-2xl font-black">{fmtMoney(result.total)}</p>
                <p className="mt-1 text-xs text-blue-200">{fromDate} → {toDate} · {result.meta.filtered} dòng / {result.meta.scanned} dòng quét</p>
              </div>
              <div className={card}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Tổng số dòng</p>
                <p className="mt-1 text-2xl font-black text-[#0f2a4a]">{result.count}</p>
                <p className="mt-1 text-xs text-slate-500">Đã lọc từ {result.meta.scanned} dòng</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className={card}>
                <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Doanh số theo nhân viên</h2>
                <BarChart labels={result.byKd.map((x) => x.label)} data={result.byKd.map((x) => x.value)} title="Doanh số" />
              </div>
              <div className={card}>
                <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Doanh số theo tỉnh</h2>
                <BarChart labels={result.byVung.map((x) => x.label)} data={result.byVung.map((x) => x.value)} title="Doanh số" />
              </div>
              <div className={card}>
                <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Doanh số theo nhóm hàng</h2>
                <BarChart labels={result.byNhom.map((x) => x.label)} data={result.byNhom.map((x) => x.value)} title="Doanh số" />
              </div>
              <div className={card}>
                <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Top khách hàng (theo doanh số)</h2>
                <BarChart labels={result.byKh.map((x) => x.label)} data={result.byKh.map((x) => x.value)} title="Doanh số" />
              </div>
            </div>

            <div className={`${card} mt-4`}>
              <h2 className="mb-3 text-sm font-bold text-[#1e3a8a]">Top sản phẩm bán chạy</h2>
              {result.topSp.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Chưa có dữ liệu</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-600"><th className="py-2">#</th><th className="py-2">Sản phẩm</th><th className="py-2 text-right">Số dòng</th><th className="py-2 text-right">Doanh số</th></tr></thead>
                    <tbody>
                      {result.topSp.map((r, i) => (
                        <tr key={r.label} className="border-t border-slate-100">
                          <td className="py-2 text-slate-500">{i + 1}</td>
                          <td className="py-2 font-medium text-slate-900 line-clamp-1">{r.label}</td>
                          <td className="py-2 text-right">{r.count}</td>
                          <td className="py-2 text-right font-semibold">{fmtMoney(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {result.count === 0 && (
              <p className="mt-4 rounded-lg bg-amber-50 p-4 text-center text-sm text-amber-800">Không có dữ liệu trong kỳ/bộ lọc này — thử đổi kỳ hoặc bỏ bớt bộ lọc, rồi bấm Chạy báo cáo.</p>
            )}
          </>
        ) : (
          hasRun ? <p className="py-6 text-center text-sm text-slate-500">Không có dữ liệu trong kỳ/bộ lọc này.</p> : <p className="py-6 text-center text-sm text-slate-500">Chọn kỳ và bấm Chạy báo cáo để xem dữ liệu.</p>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><DashboardInner /></RequireAuth>; }
