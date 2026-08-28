'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { fmtDateVN } from '@/lib/time';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

type Row = {
  id: string; ngay: string; sale_month: string; ma_vt: string; ten_vt: string;
  ma_kh: string; ten_kh: string; kinh_doanh: string; kinh_doanh_raw: string;
  so_luong: number | null; don_gia: number | null; thanh_tien: number;
  vung: string; hang_sx: string; nhom_hang: string; ma_nv: string;
};

type PeriodMode = 'month' | 'quarter' | 'year' | 'custom';

function fmtMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}

function getMonthOptions(rows: Row[]) {
  const set = new Set(rows.map((r) => r.sale_month).filter(Boolean));
  return [...set].sort().reverse();
}

function getQuarters(from: string, to: string) {
  // from/to are YYYY-MM-DD
  const s = new Date(from), e = new Date(to);
  const out: { label: string; from: string; to: string }[] = [];
  let cur = new Date(s.getFullYear(), Math.floor(s.getMonth() / 3) * 3, 1);
  while (cur <= e) {
    const q = Math.floor(cur.getMonth() / 3) + 1;
    const qStart = new Date(cur.getFullYear(), (q - 1) * 3, 1);
    const qEnd = new Date(cur.getFullYear(), q * 3, 0);
    const fromStr = qStart.toISOString().slice(0, 10);
    const toStr = qEnd.toISOString().slice(0, 10);
    // only include if overlaps with [from,to]
    if (toStr >= from && fromStr <= to) out.push({ label: `Q${q} ${cur.getFullYear()}`, from: fromStr, to: toStr });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
  }
  return out;
}

function BarChart({ labels, data, title }: { labels: string[]; data: number[]; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (labels.length === 0) return;
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title,
          data,
          backgroundColor: '#0d6efd',
          borderRadius: 6 as any,
          barThickness: labels.length > 10 ? 18 : 28,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => ` ${fmtMoney(ctx.parsed.y)}` } },
        },
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

function ChipFilter({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}:</span>
      <button
        onClick={() => onToggle('__all__')}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.length === 0 ? 'bg-[#0f2a4a] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}
      >
        Tất cả
      </button>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onToggle(o)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.includes(o) ? 'bg-[#0d6efd] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function DashboardInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Period
  const [mode, setMode] = useState<PeriodMode>('month');
  const now = useMemo(() => new Date(), []);
  const defaultMonth = useMemo(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, [now]);
  const [pickMonth, setPickMonth] = useState(defaultMonth);
  const [pickQuarter, setPickQuarter] = useState('');
  const [pickYear, setPickYear] = useState(String(now.getFullYear()));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Multi filters
  const [selKd, setSelKd] = useState<string[]>([]);
  const [selVung, setSelVung] = useState<string[]>([]);
  const [selNhom, setSelNhom] = useState<string[]>([]);
  const [selKh, setSelKh] = useState<string[]>([]);
  const [khSearch, setKhSearch] = useState('');

  // Fetch all rows (paginated, but for now limit 10000)
  async function load() {
    setLoading(true); setErr('');
    const { data, error } = await supabase.from('sales_rows').select('*').order('ngay', { ascending: false }).limit(10000);
    if (error) {
      if (String(error.message).includes('not find') || String((error as any).code) === 'PGRST205') {
        setErr('Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase Dashboard > SQL Editor.');
      } else setErr(error.message);
      setRows([]);
    } else setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Derive available filter options from rows
  const allKd = useMemo(() => [...new Set(rows.map((r) => r.kinh_doanh).filter(Boolean))].sort(), [rows]);
  const allVung = useMemo(() => [...new Set(rows.map((r) => r.vung).filter(Boolean))].sort(), [rows]);
  const allNhom = useMemo(() => [...new Set(rows.map((r) => r.nhom_hang).filter(Boolean))].sort(), [rows]);
  const allKh = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.ten_kh) m.set(r.ten_kh, r.ten_kh);
    return [...m.keys()].sort();
  }, [rows]);
  const filteredKhOptions = useMemo(() => {
    if (!khSearch.trim()) return allKh.slice(0, 30);
    const q = khSearch.trim().toLowerCase();
    return allKh.filter((k) => k.toLowerCase().includes(q)).slice(0, 30);
  }, [allKh, khSearch]);

  // Compute date range from period mode
  const range = useMemo(() => {
    if (mode === 'month') {
      const [y, m] = pickMonth.split('-').map(Number);
      const from = `${pickMonth}-01`;
      const to = new Date(y, m, 0).toISOString().slice(0, 10);
      return { from, to };
    }
    if (mode === 'quarter' && pickQuarter) {
      const [qStr, yStr] = pickQuarter.split(' ');
      const q = Number(qStr.replace('Q', ''));
      const y = Number(yStr);
      const from = new Date(y, (q - 1) * 3, 1).toISOString().slice(0, 10);
      const to = new Date(y, q * 3, 0).toISOString().slice(0, 10);
      return { from, to };
    }
    if (mode === 'year') {
      return { from: `${pickYear}-01-01`, to: `${pickYear}-12-31` };
    }
    if (mode === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    // fallback: current month
    const [y, m] = defaultMonth.split('-').map(Number);
    return { from: `${defaultMonth}-01`, to: new Date(y, m, 0).toISOString().slice(0, 10) };
  }, [mode, pickMonth, pickQuarter, pickYear, customFrom, customTo, defaultMonth]);

  const monthOptions = useMemo(() => getMonthOptions(rows), [rows]);
  const quarterOptions = useMemo(() => {
    if (rows.length === 0) return [];
    const minDate = rows.reduce((a, r) => (r.ngay < a ? r.ngay : a), rows[0].ngay);
    const maxDate = rows.reduce((a, r) => (r.ngay > a ? r.ngay : a), rows[0].ngay);
    return getQuarters(minDate, maxDate);
  }, [rows]);
  const yearOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.ngay.slice(0, 4)));
    return [...set].sort().reverse();
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.ngay < range.from || r.ngay > range.to) return false;
      if (selKd.length > 0 && !selKd.includes(r.kinh_doanh)) return false;
      if (selVung.length > 0 && !selVung.includes(r.vung)) return false;
      if (selNhom.length > 0 && !selNhom.includes(r.nhom_hang)) return false;
      if (selKh.length > 0 && !selKh.includes(r.ten_kh)) return false;
      return true;
    });
  }, [rows, range, selKd, selVung, selNhom, selKh]);

  const toggle = ( Setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) => {
    if (v === '__all__') Setter([]);
    else Setter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  // Aggregations
  const total = useMemo(() => filtered.reduce((s, r) => s + Number(r.thanh_tien ?? 0), 0), [filtered]);
  const totalRows = filtered.length;

  const byKd = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.kinh_doanh, (m.get(r.kinh_doanh) ?? 0) + Number(r.thanh_tien ?? 0));
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: arr.map(([k]) => k || '(trống)'), data: arr.map(([, v]) => v) };
  }, [filtered]);

  const byVung = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.vung || '(không rõ)', (m.get(r.vung || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: arr.map(([k]) => k), data: arr.map(([, v]) => v) };
  }, [filtered]);

  const byNhom = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.nhom_hang || '(không rõ)', (m.get(r.nhom_hang || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { labels: arr.map(([k]) => k), data: arr.map(([, v]) => v) };
  }, [filtered]);

  const topSp = useMemo(() => {
    const m = new Map<string, { ten: string; total: number; count: number }>();
    for (const r of filtered) {
      const k = r.ten_vt || r.ma_vt || '(không rõ)';
      const cur = m.get(k) ?? { ten: k, total: 0, count: 0 };
      cur.total += Number(r.thanh_tien ?? 0);
      cur.count += 1;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filtered]);

  const byKh = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.ten_kh || r.ma_kh || '(không rõ)', (m.get(r.ten_kh || r.ma_kh || '(không rõ)') ?? 0) + Number(r.thanh_tien ?? 0));
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { labels: arr.map(([k]) => k), data: arr.map(([, v]) => v) };
  }, [filtered]);

  if (loading) return <AppSidebar><main className="px-6 py-10 text-slate-600">Đang tải dữ liệu bán hàng...</main></AppSidebar>;
  if (err) return <AppSidebar><main className="px-6 py-10"><p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{err}</p><p className="mt-2 text-xs text-slate-600">File: <code>supabase/migrations/0019_sales_rows.sql</code> — copy toàn bộ vào Supabase Dashboard &gt; SQL Editor và bấm Run.</p></main></AppSidebar>;

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';
  const sel = 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Báo cáo bán hàng</h1>
          <a href="/bao-cao-ban-hang/import" className="rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Import Excel</a>
        </div>

        {/* Period */}
        <div className={`${card} mb-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Kỳ báo cáo:</span>
            {(['month', 'quarter', 'year', 'custom'] as PeriodMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m ? 'bg-[#0f2a4a] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {m === 'month' ? 'Tháng' : m === 'quarter' ? 'Quý' : m === 'year' ? 'Năm' : 'Tùy chọn'}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mode === 'month' && (
              <select value={pickMonth} onChange={(e) => setPickMonth(e.target.value)} className={sel}>
                {monthOptions.length === 0 ? <option value={defaultMonth}>{defaultMonth}</option> : monthOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {mode === 'quarter' && (
              <select value={pickQuarter} onChange={(e) => setPickQuarter(e.target.value)} className={sel}>
                <option value="">Chọn quý</option>
                {quarterOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
              </select>
            )}
            {mode === 'year' && (
              <select value={pickYear} onChange={(e) => setPickYear(e.target.value)} className={sel}>
                {yearOptions.length === 0 ? <option value={pickYear}>{pickYear}</option> : yearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {mode === 'custom' && (
              <>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={sel} />
                <span className="text-slate-500">→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={sel} />
              </>
            )}
            <span className="text-xs text-slate-500">{range.from} → {range.to} · {filtered.length} dòng</span>
          </div>
        </div>

        {/* Filters */}
        <div className={`${card} mb-4 space-y-3`}>
          <ChipFilter label="Nhân viên" options={allKd} selected={selKd} onToggle={(v) => toggle(setSelKd, v)} />
          <ChipFilter label="Tỉnh" options={allVung} selected={selVung} onToggle={(v) => toggle(setSelVung, v)} />
          <ChipFilter label="Nhóm hàng" options={allNhom} selected={selNhom} onToggle={(v) => toggle(setSelNhom, v)} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Khách hàng:</span>
            <input value={khSearch} onChange={(e) => setKhSearch(e.target.value)} placeholder="Tìm khách hàng..." className={`${sel} w-[200px]`} />
            {selKh.length > 0 && <button onClick={() => setSelKh([])} className="text-xs text-[#0d6efd] hover:underline">Bỏ lọc ({selKh.length})</button>}
          </div>
          {(khSearch.trim() || selKh.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {(selKh.length > 0 ? selKh : filteredKhOptions).map((k) => (
                <button key={k} onClick={() => toggle(setSelKh, k)} className={`rounded-full px-3 py-1 text-xs ${selKh.includes(k) ? 'bg-[#0d6efd] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {k}
                </button>
              ))}
            </div>
          )}
          {filteredKhOptions.length === 0 && khSearch.trim() && <p className="text-xs text-slate-500">Không tìm thấy khách hàng</p>}
        </div>

        {/* KPI */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div className={`${card} bg-gradient-to-br from-[#0f2a4a] to-[#1e40af] text-white border-0`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Tổng doanh số</p>
            <p className="mt-1 text-2xl font-black">{fmtMoney(total)}</p>
            <p className="mt-1 text-xs text-blue-200">{range.from} → {range.to}</p>
          </div>
          <div className={card}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Tổng số dòng</p>
            <p className="mt-1 text-2xl font-black text-[#0f2a4a]">{totalRows}</p>
            <p className="mt-1 text-xs text-slate-500">Đã lọc từ {rows.length} dòng đã import</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Doanh số theo nhân viên</h2>
            <BarChart labels={byKd.labels} data={byKd.data} title="Doanh số" />
          </div>
          <div className={card}>
            <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Doanh số theo tỉnh</h2>
            <BarChart labels={byVung.labels} data={byVung.data} title="Doanh số" />
          </div>
          <div className={card}>
            <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Doanh số theo nhóm hàng</h2>
            <BarChart labels={byNhom.labels} data={byNhom.data} title="Doanh số" />
          </div>
          <div className={card}>
            <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Top khách hàng (theo doanh số)</h2>
            <BarChart labels={byKh.labels} data={byKh.data} title="Doanh số" />
          </div>
        </div>

        {/* Top products */}
        <div className={`${card} mt-4`}>
          <h2 className="mb-3 text-sm font-bold text-[#1e3a8a]">Top sản phẩm bán chạy</h2>
          {topSp.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">Chưa có dữ liệu</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-600"><th className="py-2">#</th><th className="py-2">Sản phẩm</th><th className="py-2 text-right">Số dòng</th><th className="py-2 text-right">Doanh số</th></tr></thead>
                <tbody>
                  {topSp.map((r, i) => (
                    <tr key={r.ten} className="border-t border-slate-100">
                      <td className="py-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 font-medium text-slate-900 line-clamp-1">{r.ten}</td>
                      <td className="py-2 text-right">{r.count}</td>
                      <td className="py-2 text-right font-semibold">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtered.length === 0 && rows.length > 0 && (
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-center text-sm text-amber-800">Không có dữ liệu trong kỳ/bộ lọc này — thử đổi kỳ hoặc bỏ bớt bộ lọc.</p>
        )}
        {rows.length === 0 && !err && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">Chưa có dữ liệu bán hàng. Hãy import file Excel Odoo.</p>
            <a href="/bao-cao-ban-hang/import" className="mt-3 inline-block rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white">Đi tới Import →</a>
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><DashboardInner /></RequireAuth>; }
