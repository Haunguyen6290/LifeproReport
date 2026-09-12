'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { normMa } from '@/lib/norm-ma';

const COLORS = ['#16A97B', '#6B60E8', '#F59E0B', '#3B82F6', '#EC4899', '#EF4444', '#0891B2', '#8B5CF6', '#F97316', '#10B981', '#7C3AED', '#DC2626'];

function fmtMoney(n: number) {
  if (!n) return '0 đ';
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}
function fmtFull(n: number) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ'; }
function fmtDot(n: number) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)); }
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

type PeriodMode = 'month' | 'quarter' | 'year' | 'custom';
type QueryResult = {
  total: number; totalQty: number; count: number; soHoaDon: number; soKhachHang: number; avgValue: number;
  byKd: { label: string; value: number }[];
  byVung: { label: string; value: number }[];
  byNhom: { label: string; value: number }[];
  byHang: { label: string; value: number }[];
  byKh: { label: string; value: number }[];
  byMonth: { m: string; dt: number; hd: number }[];
  nhomMonth?: { nhom: string; m: string; value: number }[];
  khachMonth?: { ma_kh: string; ten_kh: string; kd: string; m: string; value: number }[];
  spMonth?: { sp: string; m: string; value: number }[];
  topSp: { label: string; total: number; qty: number; count: number }[];
  topSpQty: { label: string; total: number; qty: number; count: number }[];
  options: { kd: string[]; vung: string[]; nhom: string[]; kh: string[]; sp: string[] };
  meta: { scanned: number; filtered: number };
};

function Chart({ option, height = 280 }: { option: echarts.EChartsOption | null; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const instRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    instRef.current = echarts.init(ref.current);
    const onResize = () => instRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); instRef.current?.dispose(); instRef.current = null; };
  }, []);
  useEffect(() => { if (instRef.current && option) instRef.current.setOption(option as any, true as any); }, [option]);
  return <div ref={ref} style={{ width: '100%', height }} />;
}

function DebtCard({ maKh }: { maKh: string }) {
  const [val, setVal] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    const norm = normMa(maKh);
    if (!norm) { setLoading(false); return; }
    const now = new Date();
    const thang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    (async () => {
      try {
        // 1) Ưu tiên snapshot (chốt 22:00 đêm qua) — nhanh, không quét TK131.
        try {
          const rs = await fetch(`/api/sales/customer-snapshot?ma_norm=${encodeURIComponent(norm)}&loai=debt&ky=debt`);
          const js = await rs.json();
          if (js && js.data && js.data.con_thieu != null) {
            setVal(Number(js.data.con_thieu) || 0);
            if (js.data.as_of) setAsOf(String(js.data.as_of));
            return;
          }
        } catch {}
        // 2) Fallback: tính trực tiếp từ báo cáo công nợ.
        const r = await fetch(`/api/finance/debt?thang=${thang}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? 'Lỗi công nợ');
        const rows: any[] = Array.isArray(j?.rows) ? j.rows : [];
        const hit = rows.find((x) => normMa(x.ma_kh) === norm);
        setVal(hit ? Number(hit.con_thieu ?? 0) : 0);
        if (j?.E) setAsOf(String(j.E));
      } catch (e: any) { setErr(e?.message ?? 'Không tải được công nợ'); setVal(null); }
      finally { setLoading(false); }
    })();
  }, [maKh]);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-amber-900">Công nợ hiện tại</span>
        <span className="text-xs text-amber-700">{asOf ? `Chốt ${new Date(asOf).toLocaleDateString('vi-VN')}` : new Date().toLocaleDateString('vi-VN')}</span>
      </div>
      <div className="mt-1">
        {loading ? <span className="text-sm text-amber-700">Đang tải…</span>
          : err ? <span className="text-sm text-red-600">{err}</span>
          : <span className="text-xl font-extrabold tabular-nums text-amber-900">{fmtFull(val ?? 0)}</span>}
      </div>
    </div>
  );
}

function labelMonth(m: string) { return 'T' + m.slice(5) + '/' + m.slice(2, 4); }

export function CustomerSalesTab({ maKh, tenKh }: { maKh: string; tenKh: string }) {
  const norm = useMemo(() => normMa(maKh), [maKh]);
  const [mode, setMode] = useState<PeriodMode>('year');
  const [selYear, setSelYear] = useState<number>(() => new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selQuarter, setSelQuarter] = useState<number>(() => Math.ceil((new Date().getMonth() + 1) / 3));
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [availableYears, setAvailableYears] = useState<number[]>(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3, y - 4].filter((v) => v >= 2020);
  });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/sales/meta');
        const j = await r.json();
        if (Array.isArray(j?.months)) {
          const yrs = [...new Set((j.months as string[]).map((m: string) => Number(m.slice(0, 4))))].filter((n) => !isNaN(n)).sort((a, b) => b - a) as number[];
          if (yrs.length) setAvailableYears(yrs);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let from = '', to = '';
    if (mode === 'month') ({ from, to } = monthRange(selYear, selMonth));
    else if (mode === 'quarter') ({ from, to } = quarterRange(selYear, selQuarter));
    else if (mode === 'year') ({ from, to } = yearRange(selYear));
    else { from = fromDate; to = toDate; }
    setFromDate((p) => (mode !== 'custom' ? from : p || from));
    setToDate((p) => (mode !== 'custom' ? to : p || to));
    if (mode !== 'custom') { setFromDate(from); setToDate(to); }
  }, [mode, selYear, selMonth, selQuarter]); // eslint-disable-line

  // initial range
  useEffect(() => {
    if (!fromDate || !toDate) {
      const { from, to } = yearRange(selYear);
      setFromDate(from); setToDate(to);
    }
  }, []); // eslint-disable-line

  // Khóa snapshot cho kỳ đang chọn (chỉ trùng khớp khi ông chọn đúng kỳ hiện tại).
  function snapKey(): { loai: string; ky: string } | null {
    const p = (n: number) => String(n).padStart(2, '0');
    if (mode === 'month') return { loai: 'month', ky: `${selYear}-${p(selMonth)}` };
    if (mode === 'quarter') return { loai: 'quarter', ky: `${selYear}Q${selQuarter}` };
    if (mode === 'year') return { loai: 'year', ky: `${selYear}` };
    return null; // custom: luôn tính trực tiếp
  }

  async function run() {
    if (!norm) { setErr('Khách này chưa có mã (ma_kh) nên không lọc được báo cáo theo mã chuẩn.'); return; }
    if (!fromDate || !toDate) { setErr('Thiếu kỳ báo cáo'); return; }
    setLoading(true); setErr('');
    try {
      // 1) Thử đọc snapshot (đã chốt 22:00 đêm trước) — nhanh, nhẹ DB.
      const k = snapKey();
      if (k) {
        try {
          const rs = await fetch(`/api/sales/customer-snapshot?ma_norm=${encodeURIComponent(norm)}&loai=${k.loai}&ky=${encodeURIComponent(k.ky)}`);
          const js = await rs.json();
          if (js && js.data) { setResult(js.data as QueryResult); return; }
        } catch {}
      }
      // 2) Fallback: tính trực tiếp bằng sales_report (job chưa chạy / kỳ quá khứ / tùy chọn).
      const r = await fetch('/api/sales/query', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate, ma_kh_norm: [norm] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? 'Lỗi tải báo cáo');
      setResult(j as QueryResult);
    } catch (e: any) { setErr(e?.message ?? 'Lỗi'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (norm && fromDate && toDate) run(); }, [norm, fromDate, toDate]); // eslint-disable-line

  const nhomOpt = useMemo(() => {
    if (!result) return null;
    const top8 = result.byNhom.slice(0, 8);
    if (top8.length === 0) return null;
    const other = result.byNhom.slice(8).reduce((s, x) => s + x.value, 0);
    const data = [...top8.map((x, i) => ({ name: x.label, value: x.value, itemStyle: { color: COLORS[i % COLORS.length] } }))];
    if (other > 0) data.push({ name: 'Khác', value: other, itemStyle: { color: '#94a3b8' } } as any);
    return {
      tooltip: { trigger: 'item' as const, formatter: (p: any) => p.name + '<br/>' + fmtFull(p.value) + ' (' + p.percent + '%)' },
      legend: { bottom: 0, textStyle: { fontSize: 10 }, type: 'scroll' as const },
      series: [{ type: 'pie' as const, radius: ['38%', '65%'], center: ['50%', '44%'], data, label: { formatter: (p: any) => p.percent + '%', fontSize: 11 } }],
    } as echarts.EChartsOption;
  }, [result]);

  const stackedNhom = useMemo(() => {
    if (!result || !result.byMonth?.length || !result.nhomMonth?.length) return null;
    const months = result.byMonth.map((x) => x.m).filter(Boolean).sort();
    // 5 tháng gần nhất có phát sinh (byMonth đã chỉ gồm tháng có dt, nhưng lọc dt>0 cho chắc)
    const active = months.filter((m) => (result.byMonth.find((x) => x.m === m)?.dt ?? 0) > 0).slice(-5);
    if (active.length === 0) return null;
    const top5 = result.byNhom.slice(0, 5).map((x) => x.label);
    if (top5.length === 0) return null;
    const cell = new Map<string, number>();
    for (const r of result.nhomMonth) cell.set(r.nhom + '|' + r.m, (cell.get(r.nhom + '|' + r.m) ?? 0) + r.value);
    const series = top5.map((nh, i) => ({
      name: nh, type: 'bar' as const, stack: 'nhom',
      data: active.map((m) => cell.get(nh + '|' + m) ?? 0),
      itemStyle: { color: COLORS[i % COLORS.length] },
    }));
    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const }, formatter: (ps: any) => {
        const m = ps[0]?.axisValue ?? '';
        let s = m + '<br/>';
        for (const p of ps) if (p.value) s += p.marker + p.seriesName + ': ' + fmtFull(p.value) + '<br/>';
        const tot = ps.reduce((a: number, p: any) => a + (Number(p.value) || 0), 0);
        s += '<b>Tổng: ' + fmtFull(tot) + '</b>';
        return s;
      }},
      legend: { bottom: 0, textStyle: { fontSize: 10 }, type: 'scroll' as const, data: top5 },
      grid: { left: 55, right: 16, top: 12, bottom: 34 },
      xAxis: { type: 'category' as const, data: active.map(labelMonth), axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => fmts(v), fontSize: 10 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      series,
    } as echarts.EChartsOption;
  }, [result]);

  const stackedSp = useMemo(() => {
    if (!result || !result.byMonth?.length) return null;
    const months = result.byMonth.map((x) => x.m).filter(Boolean).sort();
    const active = months.filter((m) => (result.byMonth.find((x) => x.m === m)?.dt ?? 0) > 0).slice(-6);
    if (active.length === 0) return null;
    const top5 = result.topSp.slice(0, 5).map((x) => x.label);
    if (top5.length === 0) return null;
    const spMonth = result.spMonth ?? [];
    const cell = new Map<string, number>();
    for (const r of spMonth) cell.set(r.sp + '|' + r.m, (cell.get(r.sp + '|' + r.m) ?? 0) + r.value);
    // Nếu spMonth rỗng (DB chưa chạy 0050), fallback: không vẽ — tránh sai số
    if (cell.size === 0) return null;
    const series = top5.map((sp, i) => ({
      name: sp.length > 22 ? sp.slice(0, 22) + '…' : sp,
      type: 'bar' as const, stack: 'sp',
      data: active.map((m) => cell.get(sp + '|' + m) ?? 0),
      itemStyle: { color: COLORS[i % COLORS.length] },
    }));
    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const }, formatter: (ps: any) => {
        const m = ps[0]?.axisValue ?? '';
        let s = m + '<br/>';
        for (const p of ps) if (p.value) s += p.marker + p.seriesName + ': ' + fmtFull(p.value) + '<br/>';
        const tot = ps.reduce((a: number, p: any) => a + (Number(p.value) || 0), 0);
        s += '<b>Tổng: ' + fmtFull(tot) + '</b>';
        return s;
      }},
      legend: { bottom: 0, textStyle: { fontSize: 9 }, type: 'scroll' as const, data: series.map((s) => s.name) },
      grid: { left: 55, right: 16, top: 12, bottom: 34 },
      xAxis: { type: 'category' as const, data: active.map(labelMonth), axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => fmts(v), fontSize: 10 }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      series,
    } as echarts.EChartsOption;
  }, [result]);

  const periodLabel = mode === 'month' ? `Tháng ${selMonth}/${selYear}` : mode === 'quarter' ? `Q${selQuarter}/${selYear}` : mode === 'year' ? `Năm ${selYear}` : `${fromDate || '—'} → ${toDate || '—'}`;

  return (
    <section className="space-y-4">
      <DebtCard maKh={maKh} />

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[#1e3a8a]">Kỳ báo cáo</span>
          <span className="text-xs text-slate-500">{periodLabel}{tenKh ? ` · ${tenKh}` : ''}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-full bg-slate-100 p-0.5 text-xs">
              {(['month', 'quarter', 'year', 'custom'] as const).map((v) => (
                <button key={v} onClick={() => setMode(v)} className={`rounded-full px-2.5 py-1 font-semibold ${mode === v ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>{v === 'month' ? 'Tháng' : v === 'quarter' ? 'Quý' : v === 'year' ? 'Năm' : 'Tùy chọn'}</button>
              ))}
            </div>
            {mode === 'year' && (
              <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {mode === 'quarter' && (
              <>
                <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={selQuarter} onChange={(e) => setSelQuarter(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </>
            )}
            {mode === 'month' && (
              <>
                <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>T{m}</option>)}
                </select>
              </>
            )}
            {mode === 'custom' && (
              <>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
                <span className="text-slate-500">→</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
              </>
            )}
          </div>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">Đang tải báo cáo…</div>
        : !result ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">Chưa có dữ liệu.</div>
        : result.total === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">Khách này chưa có phát sinh trong kỳ {periodLabel}.</div>
        : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">Doanh thu kỳ này</div><div className="mt-1 text-lg font-extrabold text-[#0f2a4a]">{fmtFull(result.total)}</div><div className="text-xs text-slate-500">{result.soHoaDon} hóa đơn · {fmtMoney(result.avgValue)}/HĐ</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">Số dòng / SL</div><div className="mt-1 text-lg font-extrabold text-[#0f2a4a]">{result.count} dòng · {fmtDot(result.totalQty)}</div><div className="text-xs text-slate-500">Kỳ {result.byMonth.length} tháng có phát sinh</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">Nhóm hàng nổi bật</div><div className="mt-1 truncate text-sm font-bold text-[#0f2a4a]">{result.byNhom[0]?.label ?? '—'}</div><div className="text-xs text-slate-500">{result.byNhom[0] ? fmtFull(result.byNhom[0].value) : ''}</div></div>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[0] }} />Cơ cấu nhóm hàng (Top 8)</div>
              {nhomOpt ? <Chart option={nhomOpt} height={300} /> : <p className="py-8 text-center text-sm text-slate-500">Không có dữ liệu nhóm hàng.</p>}
            </div>

            <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="mb-1 text-sm font-semibold text-[#1e293b]">Doanh số 5 nhóm hàng — 5 tháng gần nhất <span className="font-normal text-slate-500">(tháng có phát sinh của khách này, cột chồng)</span></div>
              {stackedNhom ? <Chart option={stackedNhom} height={300} /> : <p className="py-8 text-center text-sm text-slate-500">Chưa đủ dữ liệu để vẽ (cần ít nhất 1 tháng có phát sinh và pivot nhóm×tháng).</p>}
            </div>

            <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="mb-1 text-sm font-semibold text-[#1e293b]">Doanh số 5 sản phẩm — 6 tháng gần nhất <span className="font-normal text-slate-500">(tháng có phát sinh của khách này, cột chồng)</span></div>
              {stackedSp ? <Chart option={stackedSp} height={320} /> : <p className="py-8 text-center text-sm text-slate-500">Chưa đủ dữ liệu — cần chạy migration 0050 để có pivot sản phẩm×tháng (spMonth). Trang vẫn hiển thị các phần còn lại.</p>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#1e3a8a]">Top sản phẩm trong kỳ</h3>
              <div className="mt-2 overflow-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5 pr-2">Sản phẩm</th><th className="py-1.5 text-right">Doanh thu</th><th className="py-1.5 text-right">SL</th></tr></thead>
                  <tbody>{result.topSp.slice(0, 8).map((r) => <tr key={r.label} className="border-b border-slate-100"><td className="py-1.5 pr-2">{r.label}</td><td className="py-1.5 text-right tabular-nums">{fmtFull(r.total)}</td><td className="py-1.5 text-right tabular-nums">{fmtDot(r.qty)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </section>
  );
}
