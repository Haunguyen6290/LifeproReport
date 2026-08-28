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

  // Fetch all rows (paginated, but for now limit 10000)
  async function load() {
    setLoading(true); setErr('');
    const { data, error } = await supabase.from('sales_rows').select('*').order('ngay', { ascending: false }).limit(10000);
    if (error) {
      if (String(error.message).includes('not find') || String((error as any).code) === 'PGRST205') {
        setErr('Bảng sales_rows chưa tồn tại — vui lòng chạy migration 0019_sales_rows.sql trong Supabase Dashboard > SQL Editor.');
      } else setErr(error.message);
      setRows([]);
    } else {
      const list = (data ?? []) as Row[];
      setRows(list);
      // Tự chọn tháng mới nhất có dữ liệu nếu tháng hiện tại chưa có
      if (list.length > 0) {
        const months = [...new Set(list.map((r) => r.sale_month).filter(Boolean))].sort().reverse();
        const curDefault = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        // pickMonth hiện tại được khởi tạo = curDefault; nếu curDefault không có dữ liệu thì nhảy về tháng mới nhất có dữ liệu
        if (months.length > 0 && !months.includes(curDefault)) {
          setPickMonth(months[0]);
        }
      }
    }
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

        {/* Filters — dropdowns */}
        <div className={`${card} mb-4 flex flex-wrap gap-2`}>
          <FilterDropdown label="Nhân viên" options={allKd} selected={selKd} onChange={setSelKd} />
          <FilterDropdown label="Tỉnh" options={allVung} selected={selVung} onChange={setSelVung} />
          <FilterDropdown label="Nhóm hàng" options={allNhom} selected={selNhom} onChange={setSelNhom} />
          <FilterDropdown label="Khách hàng" options={allKh} selected={selKh} onChange={setSelKh} searchable />
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
