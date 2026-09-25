'use client';
import { useEffect, useMemo, useState } from 'react';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';
import { fmtDot, parseDot, tuneSL } from '@/lib/ho-tro-xuat-hoa-don/calc';

const fmt = (n: number | string) => {
  const v = typeof n === 'string' ? parseDot(n) : Number(n || 0);
  return v.toLocaleString('vi-VN');
};

type DmThue = { ma_thue: string; ten_thue: string; cap1: string; cap2: string; gia_chua_vat: number; vat: number };
type DmThuc = { ma_thuc: string; ten_thuc: string; cap1: string; cap2: string };
type SoTonRow = { cap1: string; cap2: string; ten_thue: string; ton_thue1: number; ton_thuc1: number; ton_thue2: number | string; ton_thuc2: number | string; thua: number };

function useToday() { return new Date().toISOString().slice(0, 10); }

function Screen() {
  const { can } = useAuth();
  const today = useToday();
  const [tab, setTab] = useState<'dm' | 'ton' | 'goiy' | 'ls'>('dm');
  const [ngay, setNgay] = useState(today);

  // DM
  const [dmThue, setDmThue] = useState<DmThue[]>([]);
  const [dmThuc, setDmThuc] = useState<DmThuc[]>([]);
  const [qCap, setQCap] = useState('');
  const [dmFormOpen, setDmFormOpen] = useState<null | 'thue' | 'thuc'>(null);
  const [dmForm, setDmForm] = useState({ ma: '', ten: '', cap1: '', cap2: '', gia: '', vat: '10' });
  const [dmMsg, setDmMsg] = useState('');

  // Ton
  const [soTon, setSoTon] = useState<SoTonRow[]>([]);
  const [qTon, setQTon] = useState('');
  const [tonMsg, setTonMsg] = useState('');
  const [missing, setMissing] = useState<any[]>([]);
  const [capList, setCapList] = useState<string[]>([]);
  const [tonBusy, setTonBusy] = useState(false);

  // Goi y
  const [opt, setOpt] = useState<1 | 2 | 3>(1);
  const [tongVAT, setTongVAT] = useState('100.000.000');
  const [khach, setKhach] = useState('');
  const [khTu, setKhTu] = useState('2026-09-01');
  const [khDen, setKhDen] = useState(today);
  const [khachRows, setKhachRows] = useState<any[]>([]);
  const [khachList, setKhachList] = useState<any[]>([]);
  type InvRow = { ma: string; ten: string; sl: string; giaChua: string; vat: number; giaDa: string; lk: { ma: boolean; sl: boolean; gia: boolean } };
  const [inv, setInv] = useState<InvRow[]>([
    { ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } },
    { ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } },
    { ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } },
  ]);
  const [goiyMsg, setGoiyMsg] = useState('');

  // Lich su
  const [ls, setLs] = useState<any[]>([]);

  const canEdit = can('quan_ly_cai_dat') || can('ke_toan') || can('xem_tai_chinh');

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const tok = data.session?.access_token ?? '';
    return tok ? { Authorization: `Bearer ${tok}` } : ({} as any);
  }

  async function loadDm() {
    const h = await authHeader();
    const r = await fetch('/api/ho-tro-xuat-hoa-don/dm', { headers: h });
    const j = await r.json();
    if (r.ok) { setDmThue(j.dm_thue ?? []); setDmThuc(j.dm_thuc ?? []); }
  }
  async function loadSoTon() {
    const h = await authHeader();
    const r = await fetch(`/api/ho-tro-xuat-hoa-don/so-ton?ngay=${ngay}`, { headers: h });
    const j = await r.json();
    if (r.ok) setSoTon(j.rows ?? []);
  }
  async function loadKhachList() {
    const { data } = await supabase.from('customers').select('ma_kh, ten_kh').limit(200);
    setKhachList((data ?? []) as any[]);
  }
  async function loadLs() {
    const h = await authHeader();
    const r = await fetch('/api/ho-tro-xuat-hoa-don/hoa-don', { headers: h });
    const j = await r.json();
    if (r.ok) setLs(j.rows ?? []);
  }

  useEffect(() => { loadDm(); loadKhachList(); }, []);
  useEffect(() => { loadSoTon(); }, [ngay]);
  useEffect(() => { if (tab === 'ls') loadLs(); }, [tab]);

  // Khach detail: lay tu receivable/customer snapshot gan dung — demo dung ton
  async function xemKhach() {
    if (!khach) { setKhachRows([]); return; }
    // Lay 10 ma co cap tu dm_thue de hien 4 cot ton
    const rows = dmThue.slice(0, 10).map((d) => {
      const st = soTon.find((s) => s.cap1 === d.cap1);
      return { ma_thuc: d.ma_thue, ten_thuc: d.ten_thue, ma_thue: d.ma_thue, ten_thue: d.ten_thue, cap1: d.cap1, cap2: d.cap2, ton_thue1: st?.ton_thue1 ?? d.gia_chua_vat, ton_thuc1: st?.ton_thuc1 ?? 0, ton_thue2: st?.ton_thue2 ?? '—', ton_thuc2: st?.ton_thuc2 ?? '—', sl: 5, dg: d.gia_chua_vat };
    });
    setKhachRows(rows);
  }

  const tongCalc = useMemo(() => inv.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0), [inv]);
  const target = useMemo(() => parseDot(tongVAT) || 0, [tongVAT]);
  const lech = tongCalc - target;
  const lechOk = Math.abs(lech) <= 10000 && tongCalc > 0 && target > 0;

  function calcGiaDa(giaChua: number, vat: number) { return Math.round(giaChua * (1 + vat / 100)); }
  function calcGiaChua(giaDa: number, vat: number) { return Math.round(giaDa / (1 + vat / 100)); }

  async function saveDm() {
    const h = await authHeader();
    const body = { kind: dmFormOpen, ma: dmForm.ma.trim(), ten: dmForm.ten.trim(), cap1: dmForm.cap1.trim(), cap2: dmForm.cap2.trim(), gia_chua_vat: parseDot(dmForm.gia), vat: Number(dmForm.vat) };
    if (!body.ma) { setDmMsg('Thiếu mã'); return; }
    const r = await fetch('/api/ho-tro-xuat-hoa-don/dm', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setDmMsg(j.error ?? 'Lỗi'); return; }
    setDmMsg('Đã thêm ✓'); setDmForm({ ma: '', ten: '', cap1: '', cap2: '', gia: '', vat: '10' }); loadDm();
  }

  async function importTon(kind: 'thue' | 'thuc', file: File) {
    setTonBusy(true); setTonMsg('');
    const h = await authHeader();
    const fd = new FormData(); fd.append('file', file); fd.append('kind', kind); fd.append('ngay', ngay);
    const r = await fetch('/api/ho-tro-xuat-hoa-don/ton', { method: 'POST', headers: h, body: fd });
    const j = await r.json();
    setTonBusy(false);
    if (!r.ok) { setTonMsg(j.error ?? 'Lỗi'); return; }
    setTonMsg(`Đã import ${j.soDong} dòng (${kind === 'thue' ? 'thuế' : 'thực'})`);
    setMissing(j.missing ?? []); setCapList(j.capList ?? []);
    loadDm(); loadSoTon();
  }

  async function saveMissingCaps() {
    const h = await authHeader();
    for (const m of missing) {
      const ma = m.ma_thue ?? m.ma_thuc;
      const kind = m.ma_thue ? 'thue' : 'thuc';
      const cap1 = String(m.cap1 ?? '').trim();
      const cap2 = String(m.cap2 ?? '').trim();
      if (!cap1) continue;
      await fetch('/api/ho-tro-xuat-hoa-don/dm', { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ma, cap1, cap2 }) });
    }
    setMissing([]); loadDm(); loadSoTon();
  }

  function tonForMa(ma: string) {
    const d = dmThue.find((x) => x.ma_thue === ma);
    if (!d) return { t1: '—', r1: '—', t2: '—', r2: '—' };
    const st = soTon.find((s) => s.cap1 === d.cap1);
    if (!st) return { t1: fmt(d.gia_chua_vat), r1: '—', t2: '—', r2: '—' };
    return { t1: fmt(st.ton_thue1), r1: fmt(st.ton_thuc1), t2: fmt(st.ton_thue2 as any), r2: fmt(st.ton_thuc2 as any) };
  }

  function doGoiY(forKhach = false) {
    const need = target;
    if (!need) { setGoiyMsg('Nhập tổng tiền đã VAT trước'); return; }
    let pool = [...dmThue].sort((a, b) => {
      const sa = soTon.find((s) => s.cap1 === a.cap1)?.thua ?? 0;
      const sb = soTon.find((s) => s.cap1 === b.cap1)?.thua ?? 0;
      return sb - sa;
    });
    if (forKhach && khachRows.length) {
      const khachPool = khachRows.slice(0, 10).map((r) => ({ ma_thue: r.ma_thue, ten_thue: r.ten_thue, gia_chua_vat: dmThue.find((d) => d.ma_thue === r.ma_thue)?.gia_chua_vat ?? 150000, vat: dmThue.find((d) => d.ma_thue === r.ma_thue)?.vat ?? 10 }));
      const other = pool.filter((p) => !khachPool.some((k) => k.ma_thue === p.ma_thue));
      pool = [...khachPool as any, ...other] as any;
    }
    const next = inv.map((r) => ({ ...r, lk: { ...r.lk } }));
    let idx = 0;
    for (let i = 0; i < next.length; i++) {
      if (!next[i].ma && !next[i].lk.ma) {
        const t: any = pool[idx++ % pool.length];
        if (!t) continue;
        next[i].ma = t.ma_thue; next[i].ten = t.ten_thue; next[i].vat = t.vat;
        if (!next[i].giaChua && !next[i].lk.gia) { next[i].giaChua = String(t.gia_chua_vat); next[i].giaDa = String(calcGiaDa(t.gia_chua_vat, t.vat)); }
      }
      if (!next[i].giaDa && next[i].giaChua && !next[i].lk.gia) next[i].giaDa = String(calcGiaDa(parseDot(next[i].giaChua), next[i].vat));
      if (!next[i].giaChua && next[i].giaDa && !next[i].lk.gia) next[i].giaChua = String(calcGiaChua(parseDot(next[i].giaDa), next[i].vat));
    }
    const unlocked = next.map((r, i) => (!r.lk.sl ? i : -1)).filter((i) => i >= 0);
    if (unlocked.length) {
      unlocked.forEach((i) => {
        const giaDa = parseDot(next[i].giaDa) || 1;
        next[i].sl = String(Math.max(1, Math.round(need / unlocked.length / giaDa) || 1));
      });
      tuneSL(need, next as any, unlocked);
    }
    let tong = next.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
    let guard = 30;
    while (Math.abs(tong - need) > 10000 && guard-- > 0) {
      const cand = next.map((r, i) => (!r.lk.sl ? i : -1)).filter((i) => i >= 0).sort((a, b) => parseDot(next[a].giaDa) - parseDot(next[b].giaDa));
      if (!cand.length) break;
      let improved = false;
      for (const i of cand) {
        const giaDa = parseDot(next[i].giaDa) || 1;
        const curSL = parseDot(next[i].sl) || 1;
        const diff = need - tong;
        if (diff > 0) {
          next[i].sl = String(curSL + 1);
          const nt = tong + giaDa;
          if (Math.abs(nt - need) < Math.abs(tong - need)) { tong = nt; improved = true; break; } else next[i].sl = String(curSL);
        } else if (curSL > 1) {
          next[i].sl = String(curSL - 1);
          const nt = tong - giaDa;
          if (Math.abs(nt - need) < Math.abs(tong - need)) { tong = nt; improved = true; break; } else next[i].sl = String(curSL);
        }
      }
      if (!improved) break;
    }
    while (Math.abs(tong - need) > 10000 && next.length < 5) {
      const t: any = pool[idx++ % pool.length];
      if (!t) break;
      const giaDa = calcGiaDa(t.gia_chua_vat, t.vat);
      const remain = need - tong;
      if (Math.abs(remain) <= 10000) break;
      next.push({ ma: t.ma_thue, ten: t.ten_thue, sl: String(Math.max(1, Math.round(remain / giaDa) || 1)), giaChua: String(t.gia_chua_vat), vat: t.vat, giaDa: String(giaDa), lk: { ma: false, sl: false, gia: false } });
      const u2 = next.map((r, i) => (!r.lk.sl ? i : -1)).filter((i) => i >= 0);
      if (u2.length) tuneSL(need, next as any, u2);
      tong = next.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
    }
    setInv(next);
    const fin = next.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
    setGoiyMsg(Math.abs(fin - need) <= 10000 ? `Đã gợi ý — lệch ${Math.abs(fin - need).toLocaleString('vi-VN')}đ ✓` : `Đã gợi ý — lệch ${Math.abs(fin - need).toLocaleString('vi-VN')}đ, bấm Sửa giá dòng cuối để khớp 100%`);
  }

  function suaGiaCuoi() {
    if (!target || !inv.length) return;
    const tongTruoc = inv.slice(0, -1).reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
    const last = inv[inv.length - 1];
    const sl = parseDot(last.sl) || 1;
    const can = target - tongTruoc;
    const giaDaMoi = Math.max(1000, Math.round(can / sl));
    const next = [...inv];
    next[next.length - 1] = { ...last, giaDa: String(giaDaMoi), giaChua: String(calcGiaChua(giaDaMoi, last.vat)), lk: { ...last.lk, gia: true } };
    setInv(next);
  }

  async function luuXuat() {
    const h = await authHeader();
    const tong = inv.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
    const r = await fetch('/api/ho-tro-xuat-hoa-don/hoa-don', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ ngay, khach_ma: khach || null, tu_ngay: khTu, den_ngay: khDen, tong_vat: tong, dong: inv }) });
    if (r.ok) { setGoiyMsg('Đã lưu & xuất ✓'); loadLs(); }
    else { const j = await r.json(); setGoiyMsg(j.error ?? 'Lỗi'); }
  }

  if (!can('quan_ly_cai_dat') && !can('ke_toan') && !can('xem_tai_chinh')) {
    return <AppSidebar><main className="p-6 text-sm text-slate-600">Không có quyền xem (cần quyền Kế toán / Quản lý cài đặt).</main></AppSidebar>;
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Hỗ trợ xuất hóa đơn</h1>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Ngày</label>
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
          </div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-slate-200">
          {([['dm', 'Danh mục'], ['ton', 'So tồn'], ['goiy', 'Gợi ý hóa đơn'], ['ls', 'Lịch sử']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${tab === k ? 'border border-b-0 border-slate-200 bg-white text-[#1e3a8a]' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
          ))}
        </div>

        {tab === 'dm' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm text-[#0f2a4a]">Danh mục</b>
                <div className="flex gap-2">
                  <button onClick={() => setDmFormOpen('thue')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-[#1e3a8a]">+ Thêm mã thuế</button>
                  <button onClick={() => setDmFormOpen('thuc')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-[#1e3a8a]">+ Thêm mã thực</button>
                </div>
              </div>
              {dmFormOpen && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <input value={dmForm.ma} onChange={(e) => setDmForm({ ...dmForm, ma: e.target.value })} placeholder="Mã" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                    <input value={dmForm.ten} onChange={(e) => setDmForm({ ...dmForm, ten: e.target.value })} placeholder="Tên" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                    <input value={dmForm.cap1} onChange={(e) => setDmForm({ ...dmForm, cap1: e.target.value })} placeholder="Cap1" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                    <input value={dmForm.cap2} onChange={(e) => setDmForm({ ...dmForm, cap2: e.target.value })} placeholder="Cap2" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                    {dmFormOpen === 'thue' && (
                      <>
                        <input value={dmForm.gia} onChange={(e) => setDmForm({ ...dmForm, gia: e.target.value })} placeholder="Giá chưa VAT" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                        <select value={dmForm.vat} onChange={(e) => setDmForm({ ...dmForm, vat: e.target.value })} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"><option value="8">VAT 8%</option><option value="10">VAT 10%</option></select>
                      </>
                    )}
                    <button onClick={saveDm} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white">Lưu</button>
                    <button onClick={() => setDmFormOpen(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm">Hủy</button>
                  </div>
                  {dmMsg && <p className="mt-2 text-xs text-slate-600">{dmMsg}</p>}
                </div>
              )}
              <div className="mt-3">
                <input value={qCap} onChange={(e) => setQCap(e.target.value)} placeholder="Tìm Cap1 / Cap2 / mã…" className="w-full max-w-[320px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <b className="text-sm">DM Thuế ({dmThue.length})</b>
                <div className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-2 py-1.5">Mã thuế</th><th className="px-2 py-1.5">Tên</th><th className="px-2 py-1.5">Cap1</th><th className="px-2 py-1.5">Cap2</th><th className="px-2 py-1.5 text-right">Giá</th><th className="px-2 py-1.5">VAT</th></tr></thead>
                    <tbody>{dmThue.filter((r) => !qCap || r.ma_thue.toLowerCase().includes(qCap.toLowerCase()) || r.cap1.toLowerCase().includes(qCap.toLowerCase())).slice(0, 200).map((r) => (
                      <tr key={r.ma_thue} className="border-t border-slate-100"><td className="px-2 py-1 font-mono">{r.ma_thue}</td><td className="px-2 py-1">{r.ten_thue}</td><td className="px-2 py-1 font-mono">{r.cap1 || '—'}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.gia_chua_vat)}</td><td className="px-2 py-1">{r.vat}%</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <b className="text-sm">DM Thực ({dmThuc.length})</b>
                <div className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-2 py-1.5">Mã thực</th><th className="px-2 py-1.5">Tên</th><th className="px-2 py-1.5">Cap1</th><th className="px-2 py-1.5">Cap2</th></tr></thead>
                    <tbody>{dmThuc.filter((r) => !qCap || r.ma_thuc.toLowerCase().includes(qCap.toLowerCase()) || r.cap1.toLowerCase().includes(qCap.toLowerCase())).slice(0, 200).map((r) => (
                      <tr key={r.ma_thuc} className="border-t border-slate-100"><td className="px-2 py-1 font-mono">{r.ma_thuc}</td><td className="px-2 py-1">{r.ten_thuc}</td><td className="px-2 py-1 font-mono">{r.cap1 || '—'}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'ton' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <b className="text-sm text-[#0f2a4a]">Import tồn hàng ngày (định dạng cố định)</b>
              <p className="text-xs text-slate-500">Tồn thuế: cột B/C/D/F/G · Tồn thực: cột A/B/L (Tổng hợp). Ngày: {ngay}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold hover:border-[#1e3a8a]">📥 Import tồn thuế<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importTon('thue', f); e.target.value = ''; }} /></label>
                <label className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold hover:border-[#1e3a8a]">📥 Import tồn thực<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importTon('thuc', f); e.target.value = ''; }} /></label>
                {tonBusy && <span className="text-xs text-slate-500">Đang xử lý…</span>}
              </div>
              {tonMsg && <p className="mt-2 text-xs text-slate-600">{tonMsg}</p>}
              {missing.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">⚠ {missing.length} mã chưa có Cap1 — chọn Cap có sẵn hoặc gõ Cap mới</p>
                  <div className="mt-2 max-h-[300px] overflow-auto rounded-lg border border-amber-200 bg-white">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-amber-50 text-left"><th className="px-2 py-1">Mã</th><th className="px-2 py-1">Tên</th><th className="px-2 py-1">Cap1</th><th className="px-2 py-1">Cap2</th></tr></thead>
                      <tbody>{missing.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono">{m.ma_thue ?? m.ma_thuc}</td><td className="px-2 py-1">{m.ten_thue ?? m.ten_thuc ?? '—'}</td>
                          <td className="px-2 py-1">
                            <select value={m.cap1 ?? ''} onChange={(e) => { const v = e.target.value; setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap1: v === '__new' ? '' : v, _newCap1: v === '__new' } : x)); }} className="rounded border border-slate-200 px-2 py-1 text-xs">
                              <option value="">— chọn —</option>{capList.map((c) => <option key={c} value={c}>{c}</option>)}<option value="__new">+ Gõ Cap mới…</option>
                            </select>
                            {m._newCap1 && <input placeholder="Gõ Cap1 mới" value={m.cap1 ?? ''} onChange={(e) => setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap1: e.target.value } : x))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs" />}
                          </td>
                          <td className="px-2 py-1">
                            <select value={m.cap2 ?? ''} onChange={(e) => { const v = e.target.value; setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap2: v === '__new' ? '' : v, _newCap2: v === '__new' } : x)); }} className="rounded border border-slate-200 px-2 py-1 text-xs">
                              <option value="">— không dùng —</option>{capList.map((c) => <option key={c} value={c}>{c}</option>)}<option value="__new">+ Gõ Cap mới…</option>
                            </select>
                            {m._newCap2 && <input placeholder="Gõ Cap2 mới" value={m.cap2 ?? ''} onChange={(e) => setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap2: e.target.value } : x))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs" />}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex gap-2"><button onClick={saveMissingCaps} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-xs font-semibold text-white">Lưu gán Cap</button><button onClick={() => setMissing([])} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs">Để sau</button></div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm text-[#0f2a4a]">So tồn — 4 cột</b>
                <input value={qTon} onChange={(e) => setQTon(e.target.value)} placeholder="Tìm Cap1/Cap2…" className="rounded-md border border-slate-200 px-3 py-1.5 text-sm" />
              </div>
              <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#eff6ff] text-[#1e3a8a]"><th className="px-2 py-1.5 text-left">Cap1</th><th className="px-2 py-1.5 text-left">Cap2</th><th className="px-2 py-1.5 text-left">Tên thuế</th><th className="px-2 py-1.5 text-right">Tồn thuế 1</th><th className="px-2 py-1.5 text-right">Tồn thực 1</th><th className="px-2 py-1.5 text-right">Tồn thuế 2</th><th className="px-2 py-1.5 text-right">Tồn thực 2</th><th className="px-2 py-1.5 text-right">Thừa</th></tr></thead>
                  <tbody>{soTon.filter((r) => !qTon || r.cap1.toLowerCase().includes(qTon.toLowerCase()) || r.cap2.toLowerCase().includes(qTon.toLowerCase())).map((r) => (
                    <tr key={r.cap1 + r.cap2} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-2 py-1 font-mono">{r.cap1}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td><td className="px-2 py-1">{r.ten_thue}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thue1)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thuc1)}</td><td className="px-2 py-1 text-right tabular-nums">{r.ton_thue2 === '—' ? '—' : fmt(r.ton_thue2 as number)}</td><td className="px-2 py-1 text-right tabular-nums">{r.ton_thuc2 === '—' ? '—' : fmt(r.ton_thuc2 as number)}</td><td className={`px-2 py-1 text-right font-bold tabular-nums ${r.thua > 50 ? 'text-red-600 bg-red-50' : ''}`}>{fmt(r.thua)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'goiy' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOpt(1)} className={`rounded-full px-3 py-1 text-xs font-semibold ${opt === 1 ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>Option 1 · Random toàn bộ (3–5 mã)</button>
                <button onClick={() => setOpt(2)} className={`rounded-full px-3 py-1 text-xs font-semibold ${opt === 2 ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>Option 2 · Nhập tay 1–2 mã + random</button>
                <button onClick={() => setOpt(3)} className={`rounded-full px-3 py-1 text-xs font-semibold ${opt === 3 ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>Option 3 · Đúng giá thực (chọn khách)</button>
              </div>
              {opt !== 3 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600">Tổng tiền đã VAT cần xuất (đ)</label>
                  <input value={tongVAT} onChange={(e) => { const raw = e.target.value.replace(/\./g, '').replace(/,/g, ''); const n = Number(raw); setTongVAT(isNaN(n) ? '' : fmtDot(n)); }} placeholder="100.000.000" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold" />
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lechOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{!tongCalc || !target ? 'Lệch —' : `${lech > 0 ? '+' : ''}${fmt(lech)}đ ${lechOk ? '· OK ≤10k' : '· lệch >10k'}`}</span>
                  <span className="text-xs text-slate-500">Lệch tối đa 10.000đ</span>
                </div>
              )}
            </div>

            {opt === 3 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <b className="text-sm text-[#0f2a4a]">Chọn khách — sổ chi tiết theo khoảng ngày</b>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={khach} onChange={(e) => setKhach(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">
                    <option value="">— Chọn khách —</option>{khachList.map((k: any) => <option key={k.ma_kh} value={k.ma_kh}>{k.ma_kh} — {k.ten_kh}</option>)}
                  </select>
                  <label className="text-xs text-slate-600">Từ ngày</label><input type="date" value={khTu} onChange={(e) => setKhTu(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                  <label className="text-xs text-slate-600">Đến ngày</label><input type="date" value={khDen} onChange={(e) => setKhDen(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                  <button onClick={xemKhach} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white">Xem sổ chi tiết</button>
                </div>
                <div className="mt-3 max-h-[340px] overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-[11px]">
                    <thead><tr className="bg-[#eff6ff] text-left text-[#1e3a8a]"><th className="px-2 py-1">Mã thực</th><th className="px-2 py-1">Tên thực</th><th className="px-2 py-1">Mã thuế</th><th className="px-2 py-1">Tên thuế</th><th className="px-2 py-1">Cap1</th><th className="px-2 py-1">Cap2</th><th className="px-2 py-1 text-right">Tồn thuế 1</th><th className="px-2 py-1 text-right">Tồn thực 1</th><th className="px-2 py-1 text-right">Tồn thuế 2</th><th className="px-2 py-1 text-right">Tồn thực 2</th><th className="px-2 py-1 text-right">SL</th></tr></thead>
                    <tbody>{khachRows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1 font-mono">{r.ma_thuc}</td><td className="px-2 py-1">{r.ten_thuc}</td><td className="px-2 py-1 font-mono">{r.ma_thue}</td><td className="px-2 py-1">{r.ten_thue}</td><td className="px-2 py-1 font-mono">{r.cap1}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thue1)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thuc1)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thue2 as any)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thuc2 as any)}</td><td className="px-2 py-1 text-right">{r.sl}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <label className="text-xs font-bold text-[#0f2a4a]">Tổng tiền đã VAT cần xuất cho khách này (đ)</label>
                  <input value={tongVAT} onChange={(e) => { const raw = e.target.value.replace(/\./g, '').replace(/,/g, ''); const n = Number(raw); setTongVAT(isNaN(n) ? '' : fmtDot(n)); }} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold" />
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lechOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{!tongCalc || !target ? 'Lệch —' : `${lech > 0 ? '+' : ''}${fmt(lech)}đ ${lechOk ? '· OK' : '· lệch >10k'}`}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Nhập khoảng ngày + tổng tiền khách trả, bấm “Gợi ý hóa đơn cho khách này” ở bảng dưới — máy lấy luôn dữ liệu bảng trên, chọn hàng gần giống thực, ưu tiên thừa thuế.</p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <b className="text-sm text-[#0f2a4a]">Bảng nhập liệu hóa đơn (mã + tên thuế) — 2 giá liên thông</b>
                <span className="text-[11px] text-slate-500">Sửa Giá chưa VAT ↔ Giá đã VAT tự nhảy theo VAT% riêng</span>
              </div>
              <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-[#eff6ff] text-left text-[#1e3a8a]"><th className="px-2 py-1">#</th><th className="px-2 py-1">Mã thuế</th><th className="px-2 py-1">Tên thuế</th><th className="px-2 py-1 text-right">Số lượng</th><th className="px-2 py-1 text-right">Giá chưa VAT</th><th className="px-2 py-1">VAT%</th><th className="px-2 py-1 text-right">Giá đã VAT</th><th className="px-2 py-1 text-right">Thành tiền đã VAT</th><th className="px-2 py-1 text-right">Tồn thuế 1</th><th className="px-2 py-1 text-right">Tồn thực 1</th><th className="px-2 py-1 text-right">Tồn thuế 2</th><th className="px-2 py-1 text-right">Tồn thực 2</th><th></th></tr></thead>
                  <tbody>{inv.map((r, i) => {
                    const ton = tonForMa(r.ma);
                    return (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1">{i + 1}</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${r.lk.ma ? 'bg-emerald-500' : r.ma ? 'bg-amber-400' : 'bg-slate-300'}`} title={r.lk.ma ? 'đã chốt' : r.ma ? 'gợi ý' : ''} />
                            <select value={r.ma} onChange={(e) => {
                              const v = e.target.value; const t = dmThue.find((x) => x.ma_thue === v);
                              const nxt = [...inv]; nxt[i] = { ...r, ma: v, ten: t?.ten_thue ?? v, vat: t?.vat ?? 10, lk: { ...r.lk, ma: !!v } };
                              if (t && !r.lk.gia) { nxt[i].giaChua = String(t.gia_chua_vat); nxt[i].giaDa = String(calcGiaDa(t.gia_chua_vat, t.vat)); }
                              setInv(nxt);
                            }} className={`rounded border px-2 py-1 text-[11px] ${r.lk.ma ? 'border-[#0f2a4a] bg-blue-50 font-semibold' : 'border-slate-200 bg-white'}`}>
                              <option value="">— chọn —</option>{dmThue.slice(0, 300).map((d) => <option key={d.ma_thue} value={d.ma_thue}>{d.ma_thue}</option>)}
                            </select>
                            {r.lk.ma && <button onClick={() => { const nxt = [...inv]; nxt[i] = { ...r, lk: { ...r.lk, ma: false } }; setInv(nxt); }} className="text-[11px] text-slate-500 hover:text-[#1e3a8a]">↺</button>}
                          </div>
                        </td>
                        <td className="px-2 py-1 max-w-[160px] truncate text-slate-600" title={r.ten}>{r.ten || '—'}</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1 justify-end">
                            <span className={`h-2 w-2 rounded-full ${r.lk.sl ? 'bg-emerald-500' : r.sl ? 'bg-amber-400' : 'bg-slate-300'}`} />
                            <input value={r.sl ? fmtDot(r.sl) : ''} onChange={(e) => { const raw = e.target.value.replace(/\./g, '').replace(/,/g, ''); const nxt = [...inv]; nxt[i] = { ...r, sl: raw, lk: { ...r.lk, sl: raw !== '' } }; setInv(nxt); }} className={`w-[64px] rounded border px-2 py-1 text-right text-[11px] ${r.lk.sl ? 'border-[#0f2a4a] bg-blue-50 font-semibold' : 'border-slate-200'}`} inputMode="numeric" />
                            {r.lk.sl && <button onClick={() => { const nxt = [...inv]; nxt[i] = { ...r, lk: { ...r.lk, sl: false } }; setInv(nxt); }} className="text-[11px] text-slate-500">↺</button>}
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1 justify-end">
                            <span className={`h-2 w-2 rounded-full ${r.lk.gia ? 'bg-emerald-500' : r.giaChua ? 'bg-amber-400' : 'bg-slate-300'}`} />
                            <input value={r.giaChua ? fmtDot(r.giaChua) : ''} onChange={(e) => { const raw = e.target.value.replace(/\./g, '').replace(/,/g, ''); const nxt = [...inv]; const giaDa = raw ? String(calcGiaDa(Number(raw), r.vat)) : ''; nxt[i] = { ...r, giaChua: raw, giaDa, lk: { ...r.lk, gia: raw !== '' } }; setInv(nxt); }} className={`w-[96px] rounded border px-2 py-1 text-right text-[11px] tabular-nums ${r.lk.gia ? 'border-[#0f2a4a] bg-blue-50 font-semibold' : 'border-slate-200'}`} inputMode="numeric" />
                          </div>
                        </td>
                        <td className="px-2 py-1"><span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{r.vat}%</span></td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1 justify-end">
                            <input value={r.giaDa ? fmtDot(r.giaDa) : ''} onChange={(e) => { const raw = e.target.value.replace(/\./g, '').replace(/,/g, ''); const nxt = [...inv]; const giaChua = raw ? String(calcGiaChua(Number(raw), r.vat)) : ''; nxt[i] = { ...r, giaDa: raw, giaChua, lk: { ...r.lk, gia: raw !== '' } }; setInv(nxt); }} className={`w-[96px] rounded border px-2 py-1 text-right text-[11px] tabular-nums ${r.lk.gia ? 'border-[#0f2a4a] bg-blue-50 font-semibold' : 'border-slate-200'}`} inputMode="numeric" />
                            {r.lk.gia && <button onClick={() => { const nxt = [...inv]; nxt[i] = { ...r, lk: { ...r.lk, gia: false } }; setInv(nxt); }} className="text-[11px] text-slate-500">↺</button>}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmt((parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0))}</td>
                        <td className="px-2 py-1 text-right tabular-nums bg-slate-50">{ton.t1}</td>
                        <td className="px-2 py-1 text-right tabular-nums bg-slate-50">{ton.r1}</td>
                        <td className="px-2 py-1 text-right tabular-nums bg-slate-50">{ton.t2}</td>
                        <td className="px-2 py-1 text-right tabular-nums bg-slate-50">{ton.r2}</td>
                        <td className="px-2 py-1"><button onClick={() => setInv((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600">×</button></td>
                      </tr>
                    );
                  })}
                    <tr><td colSpan={13} className="border-t border-slate-200 bg-slate-50 px-2 py-2 text-center"><button onClick={() => setInv((prev) => [...prev, { ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } }])} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold hover:border-[#1e3a8a]">+ Thêm dòng</button> <span className="text-xs text-slate-500">— thêm dòng ngay trong bảng</span></td></tr>
                  </tbody>
                  <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-bold"><td colSpan={7} className="px-2 py-1.5 text-right text-xs">Tổng đã VAT</td><td className="px-2 py-1.5 text-right tabular-nums">{fmt(tongCalc)}</td><td colSpan={5}></td></tr></tfoot>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">Gợi ý lệch ≤10.000đ · Sửa giá dòng cuối khớp 100% · Đã chốt giữ nguyên khi gợi ý lại</span>
                <div className="flex gap-2">
                  {opt === 3 ? <button onClick={() => doGoiY(true)} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e40af]">✨ Gợi ý hóa đơn cho khách này</button>
                    : <button onClick={() => doGoiY(false)} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e40af]">✨ Gợi ý (chỉ lấp ô chưa chốt)</button>}
                  <button onClick={suaGiaCuoi} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold hover:border-[#1e3a8a]">Sửa giá dòng cuối cho khớp 100%</button>
                  <button onClick={() => { setInv((prev) => prev.map((r) => ({ ...r, lk: { ma: false, sl: false, gia: false } }))); }} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold">↺ Làm mới</button>
                </div>
              </div>
              {goiyMsg && <p className="mt-2 text-xs text-slate-600">{goiyMsg}</p>}
              <div className="mt-3 flex justify-end">
                <button onClick={luuXuat} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700">💾 Lưu & Xuất Excel/CSV (MISA)</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'ls' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <b className="text-sm text-[#0f2a4a]">Lịch sử đã Lưu & Xuất</b>
            <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-3 py-2">Thời gian</th><th className="px-3 py-2">Khách</th><th className="px-3 py-2">Từ → Đến</th><th className="px-3 py-2 text-right">Tổng đã VAT</th><th className="px-3 py-2 text-right">Dòng</th></tr></thead>
                <tbody>{ls.map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100"><td className="px-3 py-2">{new Date(r.created_at).toLocaleString('vi-VN')}</td><td className="px-3 py-2">{r.khach_ma ?? '—'}</td><td className="px-3 py-2">{r.tu_ngay ?? '—'} → {r.den_ngay ?? '—'}</td><td className="px-3 py-2 text-right tabular-nums">{fmt(r.tong_vat)}</td><td className="px-3 py-2 text-right">{Array.isArray(r.dong) ? r.dong.length : '—'}</td></tr>
                ))}{!ls.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Chưa có lịch sử</td></tr>}</tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
