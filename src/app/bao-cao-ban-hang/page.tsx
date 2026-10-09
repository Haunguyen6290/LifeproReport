'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
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
/** Full tiền, phân cách hàng nghìn bằng dấu chấm, KHÔNG kèm "đ" (dùng cho bảng Nhóm hàng × Tháng). */
function fmtDot(n: number) { return new Intl.NumberFormat('vi-VN').format(Math.round(n)); }
function fmts(n: number) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + ' k';
  return String(Math.round(n));
}
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
/** 2026-08-28 → 28/08/2026 (dd/mm/yyyy) */
function fmtDayVN(d: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) return d ?? ''; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }
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
  nhomMonth?: { nhom: string; m: string; value: number }[];
  khachMonth?: { ma_kh: string; ten_kh: string; kd: string; m: string; value: number }[];
  topSp: { label: string; total: number; qty: number; count: number }[];
  topSpQty: { label: string; total: number; qty: number; count: number }[];
  options: { kd: string[]; vung: string[]; nhom: string[]; kh: string[]; sp: string[] };
  meta: { scanned: number; filtered: number };
};

type DetailRow = {
  ngay: string; so_ct: string; ma_vt: string; ten_vt: string; ma_kh: string; ten_kh: string;
  kinh_doanh: string; so_luong: number | null; thanh_tien: number; vung: string; nhom_hang: string; hang_sx: string;
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
  useEffect(() => {
    if (instRef.current && option) instRef.current.setOption(option, true as any);
  }, [option]);
  return <div ref={ref} style={{ width: '100%', height }} />;
}

// ── Export Excel helpers (dùng xlsx đã có sẵn) ──
function fileSuffix(from: string, to: string) {
  const a = (from ?? '').slice(0, 7) || 'tu';
  const b = (to ?? '').slice(0, 7) || 'den';
  return `${a}_${b}`;
}
function exportNhomMonth(
  result: QueryResult | null,
  effGran: string,
  colKeys: string[],
  colLabel: (c: string) => string,
  nhoms: string[],
  get: (nh: string, c: string) => number,
  totOf: (nh: string) => number,
  colTot: Map<string, number>,
  from: string, to: string,
) {
  if (!result || colKeys.length === 0) return;
  const header = ['Nhóm hàng', 'Tổng', ...colKeys.map(colLabel)];
  const rows: (string | number)[][] = [header];
  rows.push(['TỔNG', result.total, ...colKeys.map((c) => colTot.get(c) ?? 0)]);
  for (const nh of nhoms) rows.push([nh, totOf(nh), ...colKeys.map((c) => get(nh, c))]);
  const ws = XLSX.utils.aoa_to_sheet(rows as any);
  // cột số: format #,##0 (giữ số, không phải text)
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let r = 1; r <= range.e.r; r++) for (let c = 1; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell: any = ws[addr];
    if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = '#,##0'; }
  }
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, ...colKeys.map(() => ({ wch: 14 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'NhomHang x Thang');
  XLSX.writeFile(wb, `NhomHang_x_Thang_${fileSuffix(from, to)}.xlsx`);
}
function exportKhachMonth(
  rows: { ma: string; ten: string; kd: string; tot: number; byCol: Map<string, number> }[],
  colKeys: string[],
  colLabel: (c: string) => string,
  grand: number,
  colTot: (c: string) => number,
  effGran: string, from: string, to: string,
) {
  if (rows.length === 0 || colKeys.length === 0) return;
  const header = ['Tên khách', 'Mã KH', 'Kinh doanh', 'Tổng', ...colKeys.map(colLabel)];
  const aoa: (string | number)[][] = [header];
  aoa.push(['TỔNG', '', '', grand, ...colKeys.map((c) => colTot(c))]);
  for (const r of rows) aoa.push([r.ten, r.ma, r.kd, r.tot, ...colKeys.map((c) => r.byCol.get(c) ?? 0)]);
  const ws = XLSX.utils.aoa_to_sheet(aoa as any);
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let r = 1; r <= range.e.r; r++) for (let c = 3; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell: any = ws[addr];
    if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = '#,##0'; }
  }
  ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, ...colKeys.map(() => ({ wch: 14 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KhachHang x Thang');
  XLSX.writeFile(wb, `KhachHang_x_Thang_${fileSuffix(from, to)}.xlsx`);
}

function NhomMonthTable({ result, fromDate, toDate }: { result: QueryResult | null; fromDate: string; toDate: string }) {
  const [gran, setGran] = useState<'auto' | 'month' | 'quarter' | 'year'>('auto');
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, y: 0, sl: 0, st: 0 });
  if (!result || !result.byMonth || result.byMonth.length === 0) return null;
  const nm = result.nhomMonth ?? [];
  const months = result.byMonth.map((x) => x.m).filter(Boolean).sort();
  if (months.length === 0 || nm.length === 0) return null;
  const nhoms = result.byNhom.map((x) => x.label);
  const qLab = (m: string) => { const [y, mo] = m.split('-'); return 'Q' + Math.ceil(Number(mo) / 3) + '/' + y.slice(-2); };
  const yLab = (m: string) => m.slice(0, 4);
  const effGran: 'month' | 'quarter' | 'year' = gran === 'auto' ? (months.length > 24 ? 'quarter' : 'month') : (gran === 'year' ? 'year' : gran === 'quarter' ? 'quarter' : 'month');
  const colOf = (m: string) => (effGran === 'month' ? m : effGran === 'quarter' ? qLab(m) : yLab(m));
  const colKeys = [...new Set(months.map(colOf))];
  const colLabel = (c: string) => (effGran === 'month' ? 'T' + c.slice(5) + '/' + c.slice(2, 4) : c);
  const cellVal = new Map<string, Map<string, number>>();
  for (const nh of nhoms) cellVal.set(nh, new Map());
  const colTot = new Map<string, number>();
  for (const x of nm) {
    const c = colOf(x.m);
    const row = cellVal.get(x.nhom);
    if (row) row.set(c, (row.get(c) ?? 0) + x.value);
    colTot.set(c, (colTot.get(c) ?? 0) + x.value);
  }
  const get = (nh: string, c: string) => cellVal.get(nh)?.get(c) ?? 0;
  const totOf = (nh: string) => result.byNhom.find((x) => x.label === nh)?.value ?? 0;
  const fmtCell = (n: number) => (n ? fmtDot(n) : '–');
  const LEFT_W = 176, TOT_W = 132, COL_W = 128;
  const ROW_H = 32, HEADER_H = 32, MAX_ROWS = 30;
  const boxH = HEADER_H + ROW_H * (MAX_ROWS - 1);
  const thBase = 'px-2 text-[11px] font-bold leading-none text-[#64748b]';
  const c1 = { left: 0, minWidth: LEFT_W, width: LEFT_W, maxWidth: LEFT_W };
  const c2 = { left: LEFT_W, minWidth: TOT_W, width: TOT_W, maxWidth: TOT_W };
  function onDown(e: React.PointerEvent) {
    const el = scrollRef.current; if (!el) return;
    drag.current = { down: true, x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    try { el.setPointerCapture(e.pointerId); } catch {}
  }
  function onMove(e: React.PointerEvent) {
    const el = scrollRef.current; if (!el || !drag.current.down) return;
    el.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
    el.scrollTop = drag.current.st - (e.clientY - drag.current.y);
  }
  function onUp(e: React.PointerEvent) {
    const el = scrollRef.current; if (!el) return;
    drag.current.down = false;
    try { el.releasePointerCapture(e.pointerId); } catch {}
  }
  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />Doanh số theo Nhóm hàng × {effGran === 'month' ? 'Tháng' : effGran === 'quarter' ? 'Quý' : 'Năm'}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportNhomMonth(result, effGran, colKeys, colLabel, nhoms, get, totOf, colTot, fromDate, toDate)}
            className="rounded-full bg-[#16A97B] px-3 py-1 text-xs font-bold text-white hover:bg-[#0d7a59]"
          >
            ⤓ Xuất Excel
          </button>
          <div className="flex items-center gap-1 rounded-full bg-[#f1f5f9] p-0.5 text-xs">
            {(['auto', 'month', 'quarter', 'year'] as const).map((v) => (
              <button key={v} onClick={() => setGran(v)} className={`rounded-full px-2.5 py-1 font-semibold ${gran === v ? 'bg-white text-[#1e293b] shadow' : 'text-[#64748b]'}`}>{v === 'auto' ? 'Tự động' : v === 'month' ? 'Tháng' : v === 'quarter' ? 'Quý' : 'Năm'}</button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={scrollRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="cursor-grab touch-none overflow-auto rounded-lg border border-[#e2e8f0] select-none active:cursor-grabbing"
        style={{ maxHeight: boxH }}
      >
        <table className="border-separate border-spacing-0 text-[11px] leading-none">
          <thead>
            <tr>
              <th className={`${thBase} sticky z-[4] border-b border-r border-[#e2e8f0] bg-[#f8fafc] text-left`} style={{ ...c1, top: 0, height: HEADER_H }}>Nhóm hàng</th>
              <th className={`${thBase} sticky z-[4] border-b border-r border-[#e2e8f0] bg-[#f8fafc] text-right`} style={{ ...c2, top: 0, height: HEADER_H }}>Tổng</th>
              {colKeys.map((c) => <th key={c} className={`${thBase} sticky z-[3] whitespace-nowrap border-b border-[#e2e8f0] bg-[#f8fafc] text-right`} style={{ top: 0, height: HEADER_H, minWidth: COL_W, width: COL_W, maxWidth: COL_W }}>{colLabel(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#f0f4f8] font-bold text-[#0f2a4a]">
              <td className="sticky z-[4] whitespace-nowrap border-b-2 border-r border-[#e2e8f0] bg-[#f0f4f8] px-2" style={{ ...c1, top: HEADER_H, height: ROW_H }}>TỔNG</td>
              <td className="sticky z-[4] whitespace-nowrap border-b-2 border-r border-[#e2e8f0] bg-[#f0f4f8] px-2 text-right tabular-nums text-[#0d7a59]" style={{ ...c2, top: HEADER_H, height: ROW_H }}>{fmtDot(result.total)}</td>
              {colKeys.map((c) => <td key={c} className="sticky z-[2] whitespace-nowrap border-b-2 border-[#e2e8f0] bg-[#f0f4f8] px-2 text-right tabular-nums" style={{ top: HEADER_H, height: ROW_H, minWidth: COL_W, width: COL_W, maxWidth: COL_W }}>{fmtDot(colTot.get(c) ?? 0)}</td>)}
            </tr>
            {nhoms.map((nh) => (
              <tr key={nh} className="bg-white hover:bg-[#f8fafc]">
                <td className="sticky z-[1] truncate border-b border-r border-[#e2e8f0] bg-white px-2 font-medium text-[#1e293b]" style={{ ...c1, height: ROW_H }} title={nh}>{nh}</td>
                <td className="sticky z-[1] whitespace-nowrap border-b border-r border-[#e2e8f0] bg-white px-2 text-right font-semibold tabular-nums text-[#0d7a59]" style={{ ...c2, height: ROW_H }}>{fmtDot(totOf(nh))}</td>
                {colKeys.map((c) => <td key={c} className="whitespace-nowrap border-b border-[#e2e8f0] bg-white px-2 text-right tabular-nums text-[#334155]" style={{ height: ROW_H, minWidth: COL_W, width: COL_W, maxWidth: COL_W }}>{fmtCell(get(nh, c))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-none text-[#64748b]">Kỳ {months.length} tháng · khung hiển thị tối đa {MAX_ROWS} dòng, kéo dọc trong khung. Giữ chuột rồi rê để cuộn ngang/dọc. 2 cột đầu và 2 dòng đầu luôn cố định. Ô "–" = không phát sinh.</p>
    </div>
  );
}


function ExcelFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const filtered = q.trim()
    ? options.filter((o) => String(o).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 80)
    : options.slice(0, 80);
  // Trạng thái bộ lọc: rỗng = không lọc (hiện tất cả), có phần tử = chỉ hiện những mục được TICK
  const allChecked = options.length > 0 && selected.length === options.length;
  const noneChecked = selected.length === 0;
  const active = !noneChecked;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold leading-none ${active ? 'border-[#16A97B] bg-[#ecfdf5] text-[#065f46]' : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#16A97B]'}`}
        title={`${label}: ${noneChecked ? 'Tất cả' : selected.length + '/' + options.length + ' mục'}`}
      >
        <span className="max-w-[110px] truncate">{label}</span>
        <span className="text-[10px]">{active ? `(${selected.length})` : ''}</span>
        <span className="text-[10px]">▼</span>
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm..."
            className="mb-2 w-full rounded border border-[#e2e8f0] px-2 py-1.5 text-xs outline-none focus:border-[#16A97B]"
          />
          <div className="mb-1 flex gap-1">
            <button
              onClick={() => onChange(allChecked ? [] : options.slice())}
              className="rounded bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#e2e8f0]"
              title={allChecked ? 'Bỏ tick tất cả (quay lại không lọc)' : 'Tick tất cả'}
            >
              {allChecked ? 'Bỏ hết' : 'Chọn hết'}
            </button>
            <button onClick={() => onChange([])} className="rounded bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#e2e8f0]" title="Xóa lọc — hiện tất cả">Không lọc</button>
            <button onClick={() => { setQ(''); setOpen(false); }} className="ml-auto rounded bg-[#16A97B] px-2 py-1 text-[11px] font-semibold text-white">Xong</button>
          </div>
          {filtered.map((o) => {
            const isOn = selected.includes(o);
            return (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[#f0f4f8]">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => {
                    if (isOn) {
                      const next = selected.filter((x) => x !== o);
                      onChange(next);
                    } else {
                      const next = [...selected, o];
                      // Nếu tick đủ hết → trở về trạng thái không lọc (rỗng) để bảng hiện tất cả mà không tích đầy
                      onChange(next.length === options.length ? [] : next);
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1 truncate" title={o}>{o}</span>
              </label>
            );
          })}
          {filtered.length === 0 && <p className="px-2 py-1 text-xs text-[#64748b]">Không tìm thấy</p>}
        </div>
      )}
    </div>
  );
}

function KhachMonthTable({ result, fromDate, toDate }: { result: QueryResult | null; fromDate: string; toDate: string }) {
  const [gran, setGran] = useState<'auto' | 'month' | 'quarter' | 'year'>('auto');
  const [fTen, setFTen] = useState<string[]>([]);
  const [fKd, setFKd] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, y: 0, sl: 0, st: 0 });
  const km = result?.khachMonth ?? [];
  const months = result?.byMonth?.map((x) => x.m).filter(Boolean).sort() ?? [];
  if (!result || months.length === 0 || km.length === 0) return null;

  const qLab = (m: string) => { const [y, mo] = m.split('-'); return 'Q' + Math.ceil(Number(mo) / 3) + '/' + y.slice(-2); };
  const yLab = (m: string) => m.slice(0, 4);
  const effGran: 'month' | 'quarter' | 'year' = gran === 'auto' ? (months.length > 24 ? 'quarter' : 'month') : (gran === 'year' ? 'year' : gran === 'quarter' ? 'quarter' : 'month');
  const colOf = (m: string) => (effGran === 'month' ? m : effGran === 'quarter' ? qLab(m) : yLab(m));
  const colKeys = [...new Set(months.map(colOf))];
  const colLabel = (c: string) => (effGran === 'month' ? 'T' + c.slice(5) + '/' + c.slice(2, 4) : c);

  const tenOpts = [...new Set(km.map((x) => x.ten_kh).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const kdOpts = [...new Set(km.map((x) => x.kd).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

  const passTen = (ten: string) => fTen.length === 0 || fTen.includes(ten);
  const passKd = (kd: string) => fKd.length === 0 || fKd.includes(kd);

  // Agg per (ma_kh unique): collect display fields and pivot
  type Agg = { ma: string; ten: string; kd: string; tot: number; byCol: Map<string, number> };
  const byMa = new Map<string, Agg>();
  for (const x of km) {
    if (!passTen(x.ten_kh) || !passKd(x.kd)) continue;
    const cur = byMa.get(x.ma_kh) ?? { ma: x.ma_kh, ten: x.ten_kh, kd: x.kd, tot: 0, byCol: new Map() };
    const c = colOf(x.m);
    cur.tot += x.value;
    cur.byCol.set(c, (cur.byCol.get(c) ?? 0) + x.value);
    // keep most frequent ten/kd if duplicates
    if (x.ten_kh) cur.ten = x.ten_kh;
    if (x.kd) cur.kd = x.kd;
    byMa.set(x.ma_kh, cur);
  }
  const rows = [...byMa.values()].sort((a, b) => b.tot - a.tot);

  const colTot = (c: string) => rows.reduce((a, r) => a + (r.byCol.get(c) ?? 0), 0);
  const grand = rows.reduce((a, r) => a + r.tot, 0);
  const fmtCell = (n: number) => (n ? fmtDot(n) : '–');

  // 10px font, 15 cols = 3 pinned + 12 time cols visible; container maxHeight 30 rows; wrap Ten khach
  const TEN_W = 200, KD_W = 150, TOT_W = 132, COL_W = 128;
  const ROW_MIN = 30, HEADER_H = 32, MAX_ROWS = 30;
  const boxH = HEADER_H + ROW_MIN * (MAX_ROWS - 1);
  const thBase = 'px-2 text-[9px] font-bold leading-tight text-[#64748b]';
  const c1 = { left: 0, minWidth: TEN_W, width: TEN_W, maxWidth: TEN_W };
  const c2 = { left: TEN_W, minWidth: KD_W, width: KD_W, maxWidth: KD_W };
  const c3 = { left: TEN_W + KD_W, minWidth: TOT_W, width: TOT_W, maxWidth: TOT_W };

  function onDown(e: React.PointerEvent) {
    const el = scrollRef.current; if (!el) return;
    drag.current = { down: true, x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    try { el.setPointerCapture(e.pointerId); } catch {}
  }
  function onMove(e: React.PointerEvent) {
    const el = scrollRef.current; if (!el || !drag.current.down) return;
    el.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
    el.scrollTop = drag.current.st - (e.clientY - drag.current.y);
  }
  function onUp(e: React.PointerEvent) {
    const el = scrollRef.current; if (!el) return;
    drag.current.down = false;
    try { el.releasePointerCapture(e.pointerId); } catch {}
  }

  const hasFilter = fTen.length > 0 || fKd.length > 0;

  return (
    <div className="mt-4 rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#3B82F6' }} />Doanh số theo Khách hàng × {effGran === 'month' ? 'Tháng' : effGran === 'quarter' ? 'Quý' : 'Năm'}</div>
        <div className="flex items-center gap-2">
          <ExcelFilter label="Tên khách" options={tenOpts} selected={fTen} onChange={setFTen} />
          <ExcelFilter label="Kinh doanh" options={kdOpts} selected={fKd} onChange={setFKd} />
          <button onClick={() => exportKhachMonth(rows, colKeys, colLabel, grand, colTot, effGran, fromDate, toDate)} className="rounded-full bg-[#16A97B] px-3 py-1 text-xs font-bold text-white hover:bg-[#0d7a59]">⤓ Xuất Excel</button>
          <div className="flex items-center gap-1 rounded-full bg-[#f1f5f9] p-0.5 text-xs">
            {(['auto', 'month', 'quarter', 'year'] as const).map((v) => (
              <button key={v} onClick={() => setGran(v)} className={`rounded-full px-2.5 py-1 font-semibold ${gran === v ? 'bg-white text-[#1e293b] shadow' : 'text-[#64748b]'}`}>{v === 'auto' ? 'Tự động' : v === 'month' ? 'Tháng' : v === 'quarter' ? 'Quý' : 'Năm'}</button>
            ))}
          </div>
        </div>
      </div>
      {hasFilter && <p className="mb-2 text-[11px] text-[#16A97B]">Đang lọc: {fTen.length ? `Tên khách (${fTen.length})` : ''}{fTen.length && fKd.length ? ' · ' : ''}{fKd.length ? `Kinh doanh (${fKd.length})` : ''} · {rows.length} khách khớp · <button onClick={() => { setFTen([]); setFKd([]); }} className="font-bold underline">Xóa lọc</button></p>}
      <div
        ref={scrollRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="cursor-grab touch-none overflow-auto rounded-lg border border-[#e2e8f0] select-none active:cursor-grabbing"
        style={{ maxHeight: boxH }}
      >
        <table className="border-separate border-spacing-0 text-[10px] leading-tight">
          <thead>
            <tr>
              <th className={`${thBase} sticky z-[5] border-b border-r border-[#e2e8f0] bg-[#f8fafc] text-left`} style={{ ...c1, top: 0, height: HEADER_H, whiteSpace: 'nowrap' }}>Tên khách</th>
              <th className={`${thBase} sticky z-[5] whitespace-nowrap border-b border-r border-[#e2e8f0] bg-[#f8fafc] text-left`} style={{ ...c2, top: 0, height: HEADER_H }}>Kinh doanh</th>
              <th className={`${thBase} sticky z-[5] whitespace-nowrap border-b border-r border-[#e2e8f0] bg-[#f8fafc] text-right`} style={{ ...c3, top: 0, height: HEADER_H }}>Tổng</th>
              {colKeys.map((c) => <th key={c} className={`${thBase} sticky z-[4] whitespace-nowrap border-b border-[#e2e8f0] bg-[#f8fafc] text-right`} style={{ top: 0, height: HEADER_H, minWidth: COL_W, width: COL_W, maxWidth: COL_W }}>{colLabel(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#f0f4f8] font-bold text-[#0f2a4a]">
              <td className="sticky z-[4] whitespace-nowrap border-b-2 border-r border-[#e2e8f0] bg-[#f0f4f8] px-2" style={{ ...c1, top: HEADER_H, minHeight: ROW_MIN, height: ROW_MIN }}>TỔNG</td>
              <td className="sticky z-[4] whitespace-nowrap border-b-2 border-r border-[#e2e8f0] bg-[#f0f4f8] px-2" style={{ ...c2, top: HEADER_H, minHeight: ROW_MIN, height: ROW_MIN }}></td>
              <td className="sticky z-[4] whitespace-nowrap border-b-2 border-r border-[#e2e8f0] bg-[#f0f4f8] px-2 text-right tabular-nums text-[#0d7a59]" style={{ ...c3, top: HEADER_H, minHeight: ROW_MIN, height: ROW_MIN }}>{fmtDot(grand)}</td>
              {colKeys.map((c) => <td key={c} className="sticky z-[3] whitespace-nowrap border-b-2 border-[#e2e8f0] bg-[#f0f4f8] px-2 text-right tabular-nums" style={{ top: HEADER_H, minHeight: ROW_MIN, height: ROW_MIN, minWidth: COL_W, width: COL_W, maxWidth: COL_W }}>{fmtDot(colTot(c))}</td>)}
            </tr>
            {rows.map((r) => (
              <tr key={r.ma} className="bg-white hover:bg-[#f8fafc]">
                <td className="sticky z-[1] break-words border-b border-r border-[#e2e8f0] bg-white px-2 py-1.5 font-medium text-[#1e293b]" style={{ ...c1, minHeight: ROW_MIN }} title={`${r.ten} (${r.ma})`}>{r.ten}<span className="ml-1 text-[9px] font-normal text-[#94a3b8]">{r.ma}</span></td>
                <td className="sticky z-[1] whitespace-nowrap border-b border-r border-[#e2e8f0] bg-white px-2 py-1.5 text-[#334155]" style={{ ...c2, minHeight: ROW_MIN }} title={r.kd}>{r.kd}</td>
                <td className="sticky z-[1] whitespace-nowrap border-b border-r border-[#e2e8f0] bg-white px-2 py-1.5 text-right font-semibold tabular-nums text-[#0d7a59]" style={{ ...c3, minHeight: ROW_MIN }}>{fmtDot(r.tot)}</td>
                {colKeys.map((c) => <td key={c} className="whitespace-nowrap border-b border-[#e2e8f0] bg-white px-2 py-1.5 text-right tabular-nums text-[#334155]" style={{ minWidth: COL_W, width: COL_W, maxWidth: COL_W }}>{fmtCell(r.byCol.get(c) ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-none text-[#64748b]">Kỳ {months.length} tháng · {hasFilter ? `${rows.length} khách khớp / ${byMaSize(km)} khách trong kỳ` : `${byMaSize(km)} khách trong kỳ`} · khung tối đa {MAX_ROWS} dòng (1 tiêu đề + 1 TỔNG + 28 khách), kéo dọc trong khung. Giữ chuột rồi rê để cuộn. 3 cột đầu và 2 dòng đầu luôn cố định. Ô "–" = không phát sinh.</p>
    </div>
  );
}

function byMaSize(km: { ma_kh: string }[]): number {
  return new Set(km.map((x) => x.ma_kh)).size;
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
  const filtered = searchable && q.trim()
    ? options.filter((o) => String(o ?? '').toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40)
    : options.filter((o) => o != null && String(o).trim() !== '').slice(0, searchable ? 50 : 200);
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
  const [selSp, setSelSp] = useState<string[]>([]);
  const [filterOpts, setFilterOpts] = useState<{ kd: string[]; vung: string[]; nhom: string[]; kh: string[]; sp: string[] }>({ kd: [], vung: [], nhom: [], kh: [], sp: [] });
  const [result, setResult] = useState<QueryResult | null>(null);
  const [tab, setTab] = useState<'tongquan' | 'chitiet'>('tongquan');
  // detail state
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailHasMore, setDetailHasMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [err, setErr] = useState('');

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

  // chart options — stable across tab switches so they don't flicker
  const monthlyOpt = useMemo(() => {
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
  }, [result]);

  const nhomOpt = useMemo(() => {
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
  }, [result]);

  const staffOpt = useMemo(() => {
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
  }, [result]);

  const hangOpt = useMemo(() => {
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
  }, [result]);

  // fetchMeta

  // Lần 1 (meta) chỉ lấy danh sách tháng/năm (rất nhẹ) để chọn kỳ mới nhất,
  // rồi await luôn lần 2 (Chạy báo cáo) — giữ skeleton tới khi có số liệu => cảm giác 1 lần load.
  async function fetchMeta() {
    let from = '', to = '';
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const headers: HeadersInit = tok ? { Authorization: `Bearer ${tok}` } : {};
      const res = await fetch('/api/sales/meta', { headers });
      const j = await res.json();
      if (Array.isArray(j.months) && j.months.length > 0 && /^\d{4}-\d{2}$/.test(String(j.months[0]))) {
        const [yStr, mStr] = String(j.months[0]).split('-');
        const y = Number(yStr), m = Number(mStr);
        if (!isNaN(y) && !isNaN(m)) {
          setSelYear(y); setSelMonth(m); setSelQuarter(Math.ceil(m / 3));
          const r = monthRange(y, m); from = r.from; to = r.to;
          if (Array.isArray(j.years) && j.years.length > 0) {
            const ys = (j.years as string[]).map(Number).filter((n) => !isNaN(n)).sort((a, b) => b - a);
            if (ys.length) setAvailableYears(ys);
          }
          setMode('month');
        }
      }
      if (!from) {
        const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
        const r = monthRange(y, m); from = r.from; to = r.to;
      }
    } catch {
      const y = new Date().getFullYear(), m = new Date().getMonth() + 1;
      const r = monthRange(y, m); from = r.from; to = r.to;
    }
    setFromDate(from); setToDate(to);
    try { await runQuery({ from, to }); } finally { setInitializing(false); }
  }

  useEffect(() => { fetchMeta(); }, []);

  function buildFilters() {
    const body: any = {};
    if (selKd.length) body.kd = selKd;
    if (selVung.length) body.vung = selVung;
    if (selNhom.length) body.nhom = selNhom;
    if (selKh.length) body.kh = selKh;
    if (selSp.length) body.sp = selSp;
    return body;
  }

  async function runQuery(opts?: { from: string; to: string }) {
    const f = opts?.from ?? fromDate;
    const t = opts?.to ?? toDate;
    if (!f || !t) { setErr('Vui lòng chọn Từ ngày và Đến ngày'); return; }
    if (f > t) { setErr('Từ ngày phải ≤ Đến ngày'); return; }
    setErr(''); setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const authH: HeadersInit = tok ? { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const body = buildFilters();
      body.from = f; body.to = t;
      const res = await fetch('/api/sales/query', { method: 'POST', headers: authH, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? 'Lỗi query');
      setResult(j);
      const clean = (arr: unknown) => (Array.isArray(arr) ? arr.filter((x) => x != null && String(x).trim() !== '').map((x) => String(x)) : []);
      setFilterOpts({ kd: clean(j.options?.kd), vung: clean(j.options?.vung), nhom: clean(j.options?.nhom), kh: clean(j.options?.kh), sp: clean(j.options?.sp) });
      // reset detail & load page 1 — truyền f/t trực tiếp để Chi tiết dùng đúng kỳ vừa Chạy (không đọc state cũ)
      setDetailPage(1); setDetailSearch('');
      await loadDetail(1, '', false, f, t);
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }

  async function loadDetail(page: number, search: string, append = false, f?: string, t?: string) {
    const ff = f ?? fromDate;
    const tt = t ?? toDate;
    if (!ff || !tt) return;
    setDetailLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const headers: HeadersInit = tok ? { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
      const body = buildFilters();
      body.from = ff; body.to = tt;
      body.page = page; body.limit = 20;
      if (search.trim()) body.search = search.trim();
      const res = await fetch('/api/sales/detail', { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? 'Lỗi chi tiết');
      const rows: DetailRow[] = j.rows ?? [];
      setDetailRows((prev) => (append ? [...prev, ...rows] : rows));
      setDetailTotal(j.total ?? 0);
      setDetailPage(page);
      setDetailHasMore(!!j.hasMore);
    } catch { /* ignore — detail is secondary */ }
    finally { setDetailLoading(false); }
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
          <FilterDropdown label="Sản phẩm" options={result?.options?.sp ?? filterOpts.sp} selected={selSp} onChange={setSelSp} searchable />
          <FilterDropdown label="Khách hàng" options={result?.options?.kh ?? filterOpts.kh} selected={selKh} onChange={setSelKh} searchable />
        </div>

        {/* Tabs: Tổng quan | Chi tiết */}
        <div className="mb-3 flex gap-1 rounded-xl border border-[#e2e8f0] bg-white px-2 py-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          {([['tongquan', 'Tổng quan'], ['chitiet', 'Chi tiết']] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === id ? 'bg-[#16A97B] text-white' : 'text-[#334155] hover:bg-[#f0f4f8]'}`}>{lbl}</button>
          ))}
        </div>

        {!result ? (
          <p className="py-10 text-center text-sm text-[#64748b]">Chọn kỳ và bấm Chạy báo cáo để xem dữ liệu.</p>
        ) : tab === 'tongquan' ? (
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
                <Chart option={monthlyOpt} />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#6B60E8' }} />Cơ cấu nhóm hàng (Top 8)</div>
                <Chart option={nhomOpt} />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#3B82F6' }} />Doanh thu theo nhân viên</div>
                <Chart option={staffOpt} />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#F59E0B' }} />Cơ cấu hãng sản xuất</div>
                <Chart option={hangOpt} />
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
            {/* Top KH */}
            <div className="mt-4 rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: '#3B82F6' }} />Top 15 khách hàng — doanh thu</div>
              {result.byKh.length === 0 ? <p className="py-4 text-center text-sm text-[#64748b]">Chưa có dữ liệu</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-[#e2e8f0] text-left text-xs font-bold text-[#64748b]"><th className="py-2">#</th><th className="py-2">Khách hàng</th><th className="py-2 text-right">Doanh số</th><th className="py-2 text-right">% tổng</th></tr></thead>
                    <tbody>
                      {result.byKh.slice(0, 15).map((r, i) => (
                        <tr key={r.label} className="border-t border-[#f1f5f9]">
                          <td className="py-2 text-[#64748b]">{i + 1}</td>
                          <td className="py-2 font-medium text-[#1e293b] line-clamp-1">{r.label}</td>
                          <td className="py-2 text-right font-semibold text-[#0d7a59]">{fmtFull(r.value)}</td>
                          <td className="py-2 text-right text-[#334155]">{result.total > 0 ? ((r.value / result.total) * 100).toFixed(1) : '0'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Doanh số theo Nhóm hàng × Tháng/Quý */}
            <NhomMonthTable result={result} fromDate={fromDate} toDate={toDate} />
            <KhachMonthTable result={result} fromDate={fromDate} toDate={toDate} />
            {result.count === 0 && <p className="mt-4 rounded-lg bg-amber-50 p-4 text-center text-sm text-amber-800">Không có dữ liệu trong kỳ/bộ lọc này.</p>}
          </>
        ) : (
          <div className="rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.07),0_4px_16px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#1e293b]"><span className="h-2 w-2 rounded-full" style={{ background: PRIMARY }} />Chi tiết giao dịch</div>
              <div className="flex items-center gap-2">
                <input
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setDetailPage(1); loadDetail(1, detailSearch); } }}
                  placeholder="Tìm trong bảng (Tên SP, KH, Số CT)…"
                  className="rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#16A97B] focus:ring-1 focus:ring-[#16A97B]/20"
                />
                <button onClick={() => { setDetailPage(1); loadDetail(1, detailSearch); }} className="rounded-md bg-[#16A97B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0d7a59]">Tìm</button>
              </div>
            </div>
            <p className="mb-2 text-xs text-[#64748b]">{detailTotal.toLocaleString('vi-VN')} dòng khớp bộ lọc {fmtDayVN(fromDate)} → {fmtDayVN(toDate)}</p>
            {detailRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#64748b]">Không có dòng chi tiết nào trong kỳ/bộ lọc này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] leading-[1.5]">
                  <colgroup>
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '36%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '5%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#e2e8f0] text-left text-[10px] font-bold text-[#64748b]">
                      <th className="py-1.5">Ngày</th>
                      <th className="py-1.5">Số CT</th>
                      <th className="py-1.5">Tên vật tư</th>
                      <th className="py-1.5">Mã KH</th>
                      <th className="py-1.5">Tên KH</th>
                      <th className="py-1.5">Kinh doanh</th>
                      <th className="py-1.5">Tỉnh</th>
                      <th className="py-1.5 text-right">SL</th>
                      <th className="py-1.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={`${r.so_ct}-${r.ma_vt}-${i}`} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc]">
                        <td className="py-1.5 text-[#64748b]">{fmtDayVN(r.ngay)}</td>
                        <td className="py-1.5 font-mono text-[9px] text-[#334155]">{r.so_ct}</td>
                        <td className="py-1.5 text-[#1e293b] line-clamp-1" title={r.ten_vt}>{r.ten_vt}</td>
                        <td className="py-1.5 font-mono text-[9px] text-[#334155]">{r.ma_kh}</td>
                        <td className="py-1.5 text-[#1e293b] line-clamp-1" title={r.ten_kh}>{r.ten_kh}</td>
                        <td className="py-1.5 text-[#334155]">{r.kinh_doanh}</td>
                        <td className="py-1.5 text-[#334155]">{r.vung || '–'}</td>
                        <td className="py-1.5 text-right">{(r.so_luong ?? 0).toLocaleString('vi-VN')}</td>
                        <td className="py-1.5 text-right font-semibold text-[#0d7a59]">{fmtFull(r.thanh_tien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detailHasMore && (
              <div className="mt-3 flex justify-center">
                <button onClick={() => loadDetail(detailPage + 1, detailSearch, true)} disabled={detailLoading} className="rounded-lg border border-[#e2e8f0] px-5 py-2 text-sm font-semibold text-[#334155] hover:border-[#16A97B] hover:text-[#16A97B] disabled:opacity-60">
                  {detailLoading ? 'Đang tải…' : `Xem thêm (${detailRows.length}/${detailTotal.toLocaleString('vi-VN')})`}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><DashboardInner /></RequireAuth>; }
