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
type SoTonRow = { ma_thue: string; ten_thue: string; cap1: string; cap2: string; ton_thue1: number; ton_thuc1: number; ton_thue2: number | string; ton_thuc2: number | string; thua: number };

function useToday() { return new Date().toISOString().slice(0, 10); }

function Screen() {
  const { can } = useAuth();
  const today = useToday();
  const [tab, setTab] = useState<'dm' | 'ton' | 'goiy' | 'ls'>('goiy');
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
  const [goiySeed, setGoiySeed] = useState(0);
  const [maQuery, setMaQuery] = useState<Record<number, string>>({});
  const [maOpen, setMaOpen] = useState<number | null>(null);
  const [khachQuery, setKhachQuery] = useState('');
  const [khachOpen, setKhachOpen] = useState(false);
  const [khachDebt, setKhachDebt] = useState<null | { con_thieu: number; cong_no_dau_ky: number; doanh_thu: number; thu_tien: number }>(null);

  const [thucPerMa, setThucPerMa] = useState<Record<string, number>>({});

  // Lich su
  const [ls, setLs] = useState<any[]>([]);

  // Edit inline DM
  const [editThue, setEditThue] = useState<null | { ma: string; ten: string; cap1: string; cap2: string; gia: string; vat: string }>(null);
  const [editThuc, setEditThuc] = useState<null | { ma: string; ten: string; cap1: string; cap2: string }>(null);
  const [dmTab, setDmTab] = useState<'thue' | 'thuc'>('thue');
  const [tonTab, setTonTab] = useState<'thue' | 'thuc'>('thue');

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
    const fetchTon = async (ngayStr: string) => {
      const [r, t] = await Promise.all([
        fetch(`/api/ho-tro-xuat-hoa-don/so-ton?ngay=${ngayStr}`, { headers: h }),
        fetch(`/api/ho-tro-xuat-hoa-don/tru-tam?ngay=${ngayStr}`, { headers: h }),
      ]);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { rows: [] as any[], ok: false };
      if (j.thucPerMa) setThucPerMa(j.thucPerMa as Record<string, number>);
      let rows = (j.rows ?? []) as any[];
      try {
        const tj = await t.json().catch(() => ({}));
        const byCap = (tj as any)?.byCap ?? {};
        const byMa: Record<string, number> = (tj as any)?.byMa ?? {};
        if (Object.keys(byCap).length || Object.keys(byMa).length) {
          rows = rows.map((row: any) => {
            const cap = row.cap1;
            const truCap = Number(byCap[cap] ?? 0);
            const truMa = Number(byMa[row.ma_thue] ?? 0);
            const tru = truMa || truCap ? (truMa || truCap) : 0;
            return { ...row, ton_thue1: Number(row.ton_thue1 ?? 0) - tru, thua: Number(row.thua ?? 0) - tru };
          });
        }
      } catch {}
      return { rows, ok: true };
    };
    let { rows } = await fetchTon(ngay);
    const hasData = rows.some((r: any) => Number(r.ton_thue1 ?? 0) > 0);
    if (!hasData) {
      try {
        const rn = await fetch('/api/ho-tro-xuat-hoa-don/ton?kind=nearest', { headers: h });
        const jn = await rn.json().catch(() => ({}));
        const nearest = String(jn?.ngay ?? '');
        if (nearest && nearest !== ngay) {
          const fb = await fetchTon(nearest);
          if (fb.rows.some((r: any) => Number(r.ton_thue1 ?? 0) > 0)) { if ((fb as any).thucPerMa) setThucPerMa((fb as any).thucPerMa); setSoTon(fb.rows); return; }
        }
      } catch {}
    }
    setSoTon(rows);
  }
  async function loadKhachList() {
    const all: any[] = [];
    let from = 0; const step = 1000;
    while (true) {
      const { data } = await supabase.from('customers').select('ma_kh, ten_kh').order('ma_kh').range(from, from + step - 1);
      const chunk = (data ?? []) as any[];
      all.push(...chunk);
      if (chunk.length < step) break;
      from += step;
      if (all.length > 10000) break;
    }
    setKhachList(all);
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

  // đổi khách thì xóa data khách cũ để không gợi ý nhầm
  useEffect(() => { setKhachRows([]); setKhachDebt(null); }, [khach]);

  // Khach detail: lay tu sales_rows (Bao cao ban hang) + 4 cot ton
  async function xemKhach() {
    if (!khach) { setKhachRows([]); setKhachDebt(null); return; }
    const h = await authHeader();
    fetch(`/api/sales/customer-debt?ma_norm=${encodeURIComponent(khach)}`, { headers: h }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      const d = (j as any)?.data ?? j;
      if (d && (d.con_thieu != null || (d as any).conThieu != null)) setKhachDebt({ con_thieu: Number((d as any).con_thieu ?? (d as any).conThieu ?? 0), cong_no_dau_ky: 0, doanh_thu: 0, thu_tien: 0 });
      else setKhachDebt(null);
    }).catch(() => setKhachDebt(null));
    const sp2 = new URLSearchParams({ ma_kh: khach, tu: khTu, den: khDen });
    const r = await fetch(`/api/ho-tro-xuat-hoa-don/so-chi-tiet-khach?${sp2}`, { headers: h });
    const j = await r.json();
    if (!r.ok) { setKhachRows([]); return; }
    setKhachRows(j.rows ?? []);
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

  async function saveEditThue() {
    if (!editThue) return;
    const h = await authHeader();
    const r = await fetch('/api/ho-tro-xuat-hoa-don/dm', { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'thue', ma: editThue.ma, ten: editThue.ten, cap1: editThue.cap1, cap2: editThue.cap2, gia_chua_vat: parseDot(editThue.gia), vat: Number(editThue.vat) }) });
    const j = await r.json(); if (!r.ok) { setDmMsg(j.error ?? 'Lỗi'); return; }
    setEditThue(null); setDmMsg('Đã cập nhật ✓'); loadDm();
  }
  async function saveEditThuc() {
    if (!editThuc) return;
    const h = await authHeader();
    const r = await fetch('/api/ho-tro-xuat-hoa-don/dm', { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'thuc', ma: editThuc.ma, ten: editThuc.ten, cap1: editThuc.cap1, cap2: editThuc.cap2 }) });
    const j = await r.json(); if (!r.ok) { setDmMsg(j.error ?? 'Lỗi'); return; }
    setEditThuc(null); setDmMsg('Đã cập nhật ✓'); loadDm();
  }
  async function deleteDm(kind: string, ma: string) {
    if (!confirm(`Xóa ${ma}?`)) return;
    const h = await authHeader();
    const r = await fetch(`/api/ho-tro-xuat-hoa-don/dm?kind=${kind}&ma=${encodeURIComponent(ma)}`, { method: 'DELETE', headers: h });
    const j = await r.json(); if (!r.ok) { setDmMsg(j.error ?? 'Lỗi'); return; }
    setDmMsg('Đã xóa ✓'); loadDm(); loadSoTon();
  }

  async function importTon(kind: 'thue' | 'thuc', file: File) {
    setTonBusy(true); setTonMsg(kind === 'thue' ? 'Đang import tồn thuế…' : 'Đang import tồn thực…');
    try {
      const h = await authHeader();
      const fd = new FormData(); fd.append('file', file); fd.append('kind', kind); fd.append('ngay', ngay);
      const r = await fetch('/api/ho-tro-xuat-hoa-don/ton', { method: 'POST', headers: h, body: fd });
      let j: any = null;
      try { j = await r.json(); } catch { setTonMsg('Lỗi phản hồi server'); return; }
      if (!r.ok) { setTonMsg(j.error ?? `Lỗi ${r.status}`); return; }
      setTonMsg(`Đã import ${j.soDong} dòng (${kind === 'thue' ? 'thuế' : 'thực'}) — ngày ${j.ngay}`);
      setMissing(j.missing ?? []); setCapList(j.capList ?? []);
      if ((j.missing ?? []).length) setTonMsg((m) => m + ` · ⚠ ${j.missing.length} mã thiếu Mã Tham Chiếu`);
      await Promise.all([loadDm(), loadSoTon()]);
    } catch (e: any) {
      setTonMsg(e?.message ?? 'Lỗi kết nối');
    } finally {
      setTonBusy(false);
    }
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

  function getThua(ma: string): number {
    const st = soTon.find((s) => s.ma_thue === ma);
    if (st) {
      const v = Number((st as any).thua ?? 0);
      return isNaN(v) ? 999999 : v;
    }
    const d = dmThue.find((x) => x.ma_thue === ma);
    if (!d) return 999999;
    const byCap = soTon.find((s) => s.cap1 === d.cap1);
    if (!byCap) return 999999;
    const v = Number((byCap as any).thua ?? 0);
    return isNaN(v) ? 999999 : v;
  }

  function doGoiY(forKhach = false, variant = false) {
    const need = target;
    if (!need) { setGoiyMsg('Nhập tổng tiền đã VAT trước'); return; }
    const seed = goiySeed + 1; setGoiySeed(seed);
    function shuffleWithSeed<T>(arr: T[], s: number): T[] {
      const a = [...arr]; let cur = s * 9301 + 49297;
      for (let i = a.length - 1; i > 0; i--) {
        cur = (cur * 9301 + 49297) % 233280;
        const j = Math.floor((cur / 233280) * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    const poolBaseAll = [...dmThue].sort((a, b) => {
      const sa = soTon.find((s) => s.cap1 === a.cap1)?.thua ?? 0;
      const sb = soTon.find((s) => s.cap1 === b.cap1)?.thua ?? 0;
      return sb - sa;
    });
    const poolBaseFiltered = poolBaseAll.filter((d) => {
      const t = getThua(d.ma_thue);
      return t !== 999999 && t > 0 && Number(d.gia_chua_vat) > 0;
    });
    const poolBaseWithThua = poolBaseFiltered.length ? poolBaseFiltered : [];
    // Nếu chọn Gợi ý theo khách mà pool khách lọc sạch (thừa 0), giữ pool thừa để vẫn ra đủ mã/thừa, fallback pool rộng chỉ khi không phải theo khách
    const poolBase = poolBaseWithThua.length ? poolBaseWithThua : (forKhach ? [] : poolBaseAll.filter((d) => Number(d.gia_chua_vat) > 0));

    function buildTrial(pool: any[], baseInv: typeof inv, forKhachRows: any[]): { trial: typeof inv; tong: number; diff: number } {
      const trial = baseInv.map((r) => ({ ...r, lk: { ...r.lk } }));
      const used = new Set(trial.filter((r) => !!r.ma).map((r) => r.ma));
      let idx = 0;
      for (let i = 0; i < trial.length; i++) {
        if (!trial[i].ma && !trial[i].lk.ma) {
          let cand: any = null;
          let guard = pool.length * 2;
          while (guard-- > 0) {
            const c = pool[idx++ % pool.length];
            if (!c) break;
            if (used.has(c.ma_thue)) continue;
            cand = c; break;
          }
          if (!cand) continue;
          used.add(cand.ma_thue);
          trial[i].ma = cand.ma_thue; trial[i].ten = cand.ten_thue; trial[i].vat = cand.vat;
          if (!trial[i].lk.gia) { trial[i].giaChua = String(cand.gia_chua_vat); trial[i].giaDa = String(calcGiaDa(cand.gia_chua_vat, cand.vat)); }
        }
        if (!trial[i].giaDa && trial[i].giaChua && !trial[i].lk.gia) trial[i].giaDa = String(calcGiaDa(parseDot(trial[i].giaChua), trial[i].vat));
        if (!trial[i].giaChua && trial[i].giaDa && !trial[i].lk.gia) trial[i].giaChua = String(calcGiaChua(parseDot(trial[i].giaDa), trial[i].vat));
      }
      for (let i = 0; i < trial.length; i++) {
        if (trial[i].lk.sl) continue;
        const thua = getThua(trial[i].ma);
        if (thua !== 999999 && parseDot(trial[i].sl) > thua) trial[i].sl = String(Math.max(1, thua));
      }
      const unlocked = trial.map((r, i) => (!r.lk.sl ? i : -1)).filter((i) => i >= 0);
      if (unlocked.length) {
        unlocked.forEach((i) => {
          const giaDa = parseDot(trial[i].giaDa) || 1;
          const thua = getThua(trial[i].ma);
          const maxSl = thua !== 999999 ? Math.max(1, thua) : 999999;
          // trần SL hợp lý theo giá: tránh 1 mã rẻ ôm SL quá lớn
          const capByGia = giaDa >= 1000000 ? Math.min(maxSl, 12) : giaDa >= 300000 ? Math.min(maxSl, 20) : Math.min(maxSl, 40);
          const want = Math.max(1, Math.round(need / unlocked.length / giaDa) || 1);
          trial[i].sl = String(Math.min(want, capByGia));
        });
        tuneSL(need, trial as any, unlocked);
        for (const i of unlocked) {
          const th = getThua(trial[i].ma);
          if (th !== 999999 && parseDot(trial[i].sl) > th) trial[i].sl = String(th);
        }
      }
      let tong = trial.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
      let guard = 40;
      while (Math.abs(tong - need) > 10000 && guard-- > 0) {
        const cand = trial.map((r, i) => (!r.lk.sl ? i : -1)).filter((i) => i >= 0).sort((a, b) => parseDot(trial[a].giaDa) - parseDot(trial[b].giaDa));
        if (!cand.length) break;
        let improved = false;
        for (const i of cand) {
          const giaDa = parseDot(trial[i].giaDa) || 1;
          const curSL = parseDot(trial[i].sl) || 1;
          const thua = getThua(trial[i].ma);
          const diff = need - tong;
          if (diff > 0) {
            if (thua !== 999999 && curSL >= thua) continue;
            trial[i].sl = String(curSL + 1);
            const nt = tong + giaDa;
            if (Math.abs(nt - need) < Math.abs(tong - need)) { tong = nt; improved = true; break; } else trial[i].sl = String(curSL);
          } else if (curSL > 1) {
            trial[i].sl = String(curSL - 1);
            const nt = tong - giaDa;
            if (Math.abs(nt - need) < Math.abs(tong - need)) { tong = nt; improved = true; break; } else trial[i].sl = String(curSL);
          }
        }
        if (!improved) break;
      }
      // thêm dòng nếu vẫn lệch >10k và chưa đủ 5 dòng, nhưng tôn trọng thừa + không trùng mã
      let addGuard = 20;
      while (Math.abs(tong - need) > 10000 && trial.length < 5 && addGuard-- > 0) {
        let cand: any = null;
        let g = pool.length + 5;
        while (g-- > 0) {
          const c: any = pool[idx++ % pool.length];
          if (!c) break;
          if (used.has(c.ma_thue)) continue;
          cand = c; break;
        }
        if (!cand) break;
        const thua = getThua(cand.ma_thue);
        const giaDa = calcGiaDa(cand.gia_chua_vat, cand.vat);
        const remain = need - tong;
        if (Math.abs(remain) <= 10000) break;
        // chỉ thêm dòng nếu còn thừa và remain đủ lớn
        if (thua !== 999999 && thua <= 0) continue;
        const want = Math.max(1, Math.round(Math.abs(remain) / giaDa) || 1);
        const clampedWant = thua !== 999999 ? Math.min(want, thua) : want;
        if (remain < 0 && trial.length >= 3) break; // đã thừa tiền thì không thêm dòng dương nữa
        used.add(cand.ma_thue);
        trial.push({ ma: cand.ma_thue, ten: cand.ten_thue, sl: String(clampedWant), giaChua: String(cand.gia_chua_vat), vat: cand.vat, giaDa: String(giaDa), lk: { ma: false, sl: false, gia: false } });
        const u2 = trial.map((r, i) => (!r.lk.sl ? i : -1)).filter((i) => i >= 0);
        if (u2.length) tuneSL(need, trial as any, u2);
        tong = trial.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
      }
      return { trial, tong, diff: Math.abs(tong - need) };
    }

    const topN = Math.min(14, poolBase.length);
    // Nếu pool rỗng (theo khách mà không còn thừa), báo rõ thay vì gợi ý SL 0 lệch chục triệu
    if (!poolBase.length) {
      setGoiyMsg(forKhach ? 'Không còn mã nào đủ thừa để gợi ý cho khách này — kiểm tra tồn (thừa 0) hoặc cập nhật giá' : 'Không còn mã nào đủ thừa để gợi ý — kiểm tra tồn');
      return;
    }
    const top = shuffleWithSeed(poolBase.slice(0, topN), seed);
    let pool: any[] = [...top, ...poolBase.slice(topN)];
    if (forKhach && khachRows.length) {
      const rawKhachPool = khachRows.slice(0, 10).map((r) => ({ ma_thue: r.ma_thue, ten_thue: r.ten_thue, gia_chua_vat: dmThue.find((d) => d.ma_thue === r.ma_thue)?.gia_chua_vat ?? 150000, vat: dmThue.find((d) => d.ma_thue === r.ma_thue)?.vat ?? 10 }));
      const khachPoolFiltered = rawKhachPool.filter((x: any) => { const t = getThua(x.ma_thue); return t !== 999999 && t > 0 && Number(x.gia_chua_vat) > 0; });
      const khachPool = khachPoolFiltered.length ? khachPoolFiltered : rawKhachPool.filter((x: any) => Number(x.gia_chua_vat) > 0).slice(0, 5);
      const other = pool.filter((p) => !khachPool.some((k) => k.ma_thue === p.ma_thue));
      pool = [...khachPool as any, ...other] as any;
    }

    // helper: sắp xếp trial theo giá đã VAT giảm dần (cao -> thấp), giữ chốt ở trên nếu có
    function sortByGiaDesc(trial: typeof inv) {
      const locked = trial.filter((r) => r.lk.ma || r.lk.sl || r.lk.gia);
      const free = trial.filter((r) => !r.lk.ma && !r.lk.sl && !r.lk.gia);
      free.sort((a, b) => parseDot(b.giaDa) - parseDot(a.giaDa));
      // trộn lại: đã chốt giữ vị trí đầu, còn lại sort cao->thấp
      if (!locked.length) return free.length ? free : trial;
      // nếu có chốt, chỉ sort phần free và ghép sau locked, rồi sort toàn bộ free cao->thấp, locked giữ nguyên thứ tự
      return [...locked, ...free];
    }

    if (!variant) {
      const { trial: raw, diff } = buildTrial(pool, inv, khachRows);
      const trial = sortByGiaDesc(raw);
      setInv(trial);
      setGoiyMsg(diff <= 10000 ? `Đã gợi ý — lệch ${diff.toLocaleString('vi-VN')}đ ✓` : `Đã gợi ý — lệch ${diff.toLocaleString('vi-VN')}đ, bấm Sửa giá dòng cuối để khớp 100%`);
      return;
    }

    // variant: thử nhiều pool khác nhau, chọn phương án lệch nhỏ nhất và ≤10k nếu có
    const baseForVariant = inv.map((r) => ({ ...r, lk: { ...r.lk } }));
    // xóa mã chưa chốt để bốc lại
    for (let i = 0; i < baseForVariant.length; i++) if (!baseForVariant[i].lk.ma) { baseForVariant[i].ma = ''; baseForVariant[i].ten = ''; baseForVariant[i].giaChua = ''; baseForVariant[i].giaDa = ''; baseForVariant[i].sl = ''; }

    let best: { trial: typeof inv; diff: number } | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const shuffled = shuffleWithSeed(poolBase, seed + 7 + attempt * 13);
      let p: any[] = [...shuffled.slice(0, topN), ...shuffled.slice(topN)];
      if (forKhach && khachRows.length) {
        const kpRaw = khachRows.slice(0, 10).map((r) => ({ ma_thue: r.ma_thue, ten_thue: r.ten_thue, gia_chua_vat: dmThue.find((d) => d.ma_thue === r.ma_thue)?.gia_chua_vat ?? 150000, vat: dmThue.find((d) => d.ma_thue === r.ma_thue)?.vat ?? 10 }));
        const kp = kpRaw.filter((x: any) => { const t = getThua(x.ma_thue); return t !== 999999 && t > 0 && Number(x.gia_chua_vat) > 0; });
        const kpShuffled = shuffleWithSeed(kp as any, seed + 3 + attempt) as any;
        const other = p.filter((x: any) => !kpShuffled.some((k: any) => k.ma_thue === x.ma_thue));
        p = [...kpShuffled, ...other];
        const off = (attempt * 3) % Math.max(1, p.length);
        p = [...p.slice(off), ...p.slice(0, off)];
      } else {
        const off = (attempt * 5) % Math.max(1, p.length);
        p = [...p.slice(off), ...p.slice(0, off)];
      }
      const { trial: raw, diff } = buildTrial(p, baseForVariant, khachRows);
      const trial = sortByGiaDesc(raw);
      if (!best || diff < best.diff) best = { trial, diff };
      if (diff <= 10000) break;
    }
    if (best) {
      setInv(best.trial);
      setGoiyMsg(best.diff <= 10000 ? `Đã gợi ý phương án khác — lệch ${best.diff.toLocaleString('vi-VN')}đ ✓` : `Đã gợi ý phương án khác — lệch ${best.diff.toLocaleString('vi-VN')}đ, bấm Sửa giá dòng cuối để khớp 100%`);
    }
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
    if (r.ok) {
      setGoiyMsg('Đã lưu & xuất ✓');
      // xuất Excel MISA ngay
      try {
        const XLSX = await import('xlsx');
        const rows = inv.filter((x) => x.ma && parseDot(x.sl) > 0).map((x) => ({
          'Mã hàng': x.ma,
          'Tên hàng': x.ten,
          'Số lượng': parseDot(x.sl),
          'Đơn giá': parseDot(x.giaChua),
          'VAT%': x.vat,
          'Thành tiền chưa VAT': parseDot(x.sl) * parseDot(x.giaChua),
          'Tiền VAT': Math.round(parseDot(x.sl) * parseDot(x.giaChua) * x.vat / 100),
          'Thành tiền đã VAT': parseDot(x.sl) * parseDot(x.giaDa),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HoaDon');
        XLSX.writeFile(wb, `HoaDon_${ngay}_${Date.now()}.xlsx`);
      } catch {}
      loadLs(); loadSoTon();
    }
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
                    <input value={dmForm.cap1} onChange={(e) => setDmForm({ ...dmForm, cap1: e.target.value })} placeholder="Mã Tham Chiếu 1" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                    <input value={dmForm.cap2} onChange={(e) => setDmForm({ ...dmForm, cap2: e.target.value })} placeholder="Mã Tham Chiếu 2" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
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
                <input value={qCap} onChange={(e) => setQCap(e.target.value)} placeholder="Tìm Mã Tham Chiếu 1 / 2 / mã…" className="w-full max-w-[320px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                    <button onClick={() => setDmTab('thue')} className={`rounded-md px-3 py-1 text-xs font-bold ${dmTab === 'thue' ? 'bg-white shadow text-[#0f2a4a]' : 'text-slate-500'}`}>DM Thuế ({dmThue.length})</button>
                    <button onClick={() => setDmTab('thuc')} className={`rounded-md px-3 py-1 text-xs font-bold ${dmTab === 'thuc' ? 'bg-white shadow text-[#0f2a4a]' : 'text-slate-500'}`}>DM Thực ({dmThuc.length})</button>
                  </div>
                  <span className="text-[11px] text-slate-400">{dmTab === 'thue' ? 'Giá & VAT lấy theo file import tồn thuế (B/C/D/F/G)' : 'Mã thực · Tham chiếu'}</span>
                </div>
                {dmTab === 'thue' ? (
                <div className="max-h-[600px] overflow-auto rounded-lg border border-slate-200">
                  {editThue && (
                    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-2 py-2">
                      <span className="text-xs font-bold text-amber-800">Sửa: {editThue.ma}</span>
                      <input value={editThue.ten} onChange={(e) => setEditThue({ ...editThue, ten: e.target.value })} placeholder="Tên" className="min-w-[160px] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <input value={editThue.cap1} onChange={(e) => setEditThue({ ...editThue, cap1: e.target.value })} placeholder="Mã Tham Chiếu 1" className="w-[130px] rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <input value={editThue.cap2} onChange={(e) => setEditThue({ ...editThue, cap2: e.target.value })} placeholder="Mã Tham Chiếu 2" className="w-[130px] rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <input value={editThue.gia} onChange={(e) => setEditThue({ ...editThue, gia: e.target.value })} placeholder="Giá chưa VAT" className="w-[90px] rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <select value={editThue.vat} onChange={(e) => setEditThue({ ...editThue, vat: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"><option value="8">VAT 8%</option><option value="10">VAT 10%</option></select>
                      <button onClick={saveEditThue} className="rounded bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white">Lưu</button>
                      <button onClick={() => setEditThue(null)} className="rounded border border-slate-200 bg-white px-3 py-1 text-xs">Hủy</button>
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-2 py-1.5">Mã thuế</th><th className="px-2 py-1.5">Tên</th><th className="px-2 py-1.5">Mã Tham Chiếu 1</th><th className="px-2 py-1.5">Mã Tham Chiếu 2</th><th className="px-2 py-1.5 text-right">Giá</th><th className="px-2 py-1.5">VAT</th><th className="px-2 py-1.5"></th></tr></thead>
                    <tbody>{dmThue.filter((r) => !qCap || r.ma_thue.toLowerCase().includes(qCap.toLowerCase()) || r.cap1.toLowerCase().includes(qCap.toLowerCase())).slice(0, 400).map((r) => (
                      <tr key={r.ma_thue} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-2 py-1 font-mono">{r.ma_thue}</td><td className="px-2 py-1 max-w-[420px] truncate" title={r.ten_thue}>{r.ten_thue}</td><td className="px-2 py-1 font-mono">{r.cap1 || '—'}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.gia_chua_vat)}</td><td className="px-2 py-1">{r.vat}%</td><td className="px-2 py-1 whitespace-nowrap"><button onClick={() => setEditThue({ ma: r.ma_thue, ten: r.ten_thue, cap1: r.cap1, cap2: r.cap2, gia: String(r.gia_chua_vat), vat: String(r.vat) })} className="mr-2 text-xs font-semibold text-[#1e3a8a] hover:underline">Sửa</button><button onClick={() => deleteDm('thue', r.ma_thue)} className="text-xs text-red-600 hover:underline">Xóa</button></td></tr>
                    ))}</tbody>
                  </table>
                </div>
                ) : (
                <div className="max-h-[600px] overflow-auto rounded-lg border border-slate-200">
                  {editThuc && (
                    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-2 py-2">
                      <span className="text-xs font-bold text-amber-800">Sửa: {editThuc.ma}</span>
                      <input value={editThuc.ten} onChange={(e) => setEditThuc({ ...editThuc, ten: e.target.value })} placeholder="Tên" className="min-w-[160px] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <input value={editThuc.cap1} onChange={(e) => setEditThuc({ ...editThuc, cap1: e.target.value })} placeholder="Mã Tham Chiếu 1" className="w-[130px] rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <input value={editThuc.cap2} onChange={(e) => setEditThuc({ ...editThuc, cap2: e.target.value })} placeholder="Mã Tham Chiếu 2" className="w-[130px] rounded border border-slate-300 bg-white px-2 py-1 text-xs" />
                      <button onClick={saveEditThuc} className="rounded bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white">Lưu</button>
                      <button onClick={() => setEditThuc(null)} className="rounded border border-slate-200 bg-white px-3 py-1 text-xs">Hủy</button>
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="px-2 py-1.5">Mã thực</th><th className="px-2 py-1.5">Tên</th><th className="px-2 py-1.5">Mã Tham Chiếu 1</th><th className="px-2 py-1.5">Mã Tham Chiếu 2</th><th className="px-2 py-1.5"></th></tr></thead>
                    <tbody>{dmThuc.filter((r) => !qCap || r.ma_thuc.toLowerCase().includes(qCap.toLowerCase()) || r.cap1.toLowerCase().includes(qCap.toLowerCase())).slice(0, 400).map((r) => (
                      <tr key={r.ma_thuc} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-2 py-1 font-mono">{r.ma_thuc}</td><td className="px-2 py-1 max-w-[420px] truncate" title={r.ten_thuc}>{r.ten_thuc}</td><td className="px-2 py-1 font-mono">{r.cap1 || '—'}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td><td className="px-2 py-1 whitespace-nowrap"><button onClick={() => setEditThuc({ ma: r.ma_thuc, ten: r.ten_thuc, cap1: r.cap1, cap2: r.cap2 })} className="mr-2 text-xs font-semibold text-[#1e3a8a] hover:underline">Sửa</button><button onClick={() => deleteDm('thuc', r.ma_thuc)} className="text-xs text-red-600 hover:underline">Xóa</button></td></tr>
                    ))}</tbody>
                  </table>
                </div>
                )}
              </div>
          </div>
        )}

        {tab === 'ton' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <b className="text-sm text-[#0f2a4a]">Import tồn hàng ngày (định dạng cố định)</b>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold hover:border-[#1e3a8a]">📥 Import tồn thuế<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importTon('thue', f); e.target.value = ''; }} /></label>
                <label className="cursor-pointer rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold hover:border-[#1e3a8a]">📥 Import tồn thực<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importTon('thuc', f); e.target.value = ''; }} /></label>
                {tonBusy && <span className="text-xs text-slate-500">Đang xử lý…</span>}
              </div>
              {tonMsg && <p className="mt-2 text-xs text-slate-600">{tonMsg}</p>}
              {missing.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">⚠ {missing.length} mã chưa có Mã Tham Chiếu 1 — chọn Mã Tham Chiếu có sẵn hoặc gõ Mã Tham Chiếu mới</p>
                  <div className="mt-2 max-h-[300px] overflow-auto rounded-lg border border-amber-200 bg-white">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-amber-50 text-left"><th className="px-2 py-1">Mã</th><th className="px-2 py-1">Tên</th><th className="px-2 py-1">Mã Tham Chiếu 1</th><th className="px-2 py-1">Mã Tham Chiếu 2</th></tr></thead>
                      <tbody>{missing.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono">{m.ma_thue ?? m.ma_thuc}</td><td className="px-2 py-1">{m.ten_thue ?? m.ten_thuc ?? '—'}</td>
                          <td className="px-2 py-1">
                            <select value={m.cap1 ?? ''} onChange={(e) => { const v = e.target.value; setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap1: v === '__new' ? '' : v, _newCap1: v === '__new' } : x)); }} className="rounded border border-slate-200 px-2 py-1 text-xs">
                              <option value="">— chọn —</option>{capList.map((c) => <option key={c} value={c}>{c}</option>)}<option value="__new">+ Gõ Cap mới…</option>
                            </select>
                            {m._newCap1 && <input placeholder="Gõ Mã Tham Chiếu 1 mới" value={m.cap1 ?? ''} onChange={(e) => setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap1: e.target.value } : x))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs" />}
                          </td>
                          <td className="px-2 py-1">
                            <select value={m.cap2 ?? ''} onChange={(e) => { const v = e.target.value; setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap2: v === '__new' ? '' : v, _newCap2: v === '__new' } : x)); }} className="rounded border border-slate-200 px-2 py-1 text-xs">
                              <option value="">— không dùng —</option>{capList.map((c) => <option key={c} value={c}>{c}</option>)}<option value="__new">+ Gõ Cap mới…</option>
                            </select>
                            {m._newCap2 && <input placeholder="Gõ Mã Tham Chiếu 2 mới" value={m.cap2 ?? ''} onChange={(e) => setMissing((prev) => prev.map((x, idx) => idx === i ? { ...x, cap2: e.target.value } : x))} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs" />}
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
                <input value={qTon} onChange={(e) => setQTon(e.target.value)} placeholder="Tìm Mã Tham Chiếu 1/2…" className="rounded-md border border-slate-200 px-3 py-1.5 text-sm" />
              </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button onClick={() => setTonTab('thue')} className={`rounded-md px-3 py-1 text-xs font-bold ${tonTab === 'thue' ? 'bg-white shadow text-[#0f2a4a]' : 'text-slate-500'}`}>Tồn thuế ({dmThue.length})</button>
                  <button onClick={() => setTonTab('thuc')} className={`rounded-md px-3 py-1 text-xs font-bold ${tonTab === 'thuc' ? 'bg-white shadow text-[#0f2a4a]' : 'text-slate-500'}`}>Tồn thực ({dmThuc.length})</button>
                </div>
                <input value={qTon} onChange={(e) => setQTon(e.target.value)} placeholder={tonTab === 'thue' ? 'Tìm Mã thuế / Tên thuế / Mã Tham Chiếu…' : 'Tìm Mã thực / Tên thực / Mã Tham Chiếu…'} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm" />
              </div>
              {tonTab === 'thue' ? (
              <div className="overflow-auto rounded-lg border border-slate-200 max-h-[600px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0"><tr className="bg-[#eff6ff] text-[#1e3a8a]"><th className="px-2 py-1.5 text-left">Mã thuế</th><th className="px-2 py-1.5 text-left">Tên thuế</th><th className="px-2 py-1.5 text-left">Mã Tham Chiếu 1</th><th className="px-2 py-1.5 text-left">Mã Tham Chiếu 2</th><th className="px-2 py-1.5 text-right">Tồn thuế 1</th><th className="px-2 py-1.5 text-right">Tồn thực 1</th><th className="px-2 py-1.5 text-right">Tồn thuế 2</th><th className="px-2 py-1.5 text-right">Tồn thực 2</th><th className="px-2 py-1.5 text-right">Thừa</th></tr></thead>
                  <tbody>{soTon.filter((r) => !qTon || r.ma_thue.toLowerCase().includes(qTon.toLowerCase()) || r.ten_thue.toLowerCase().includes(qTon.toLowerCase()) || r.cap1.toLowerCase().includes(qTon.toLowerCase()) || r.cap2.toLowerCase().includes(qTon.toLowerCase())).slice(0, 600).map((r) => (
                    <tr key={r.ma_thue} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-2 py-1 font-mono">{r.ma_thue}</td><td className="px-2 py-1 max-w-[280px] truncate" title={r.ten_thue}>{r.ten_thue}</td><td className="px-2 py-1 font-mono">{r.cap1 || '—'}</td><td className="px-2 py-1 font-mono">{r.cap2 || '—'}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thue1)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thuc1)}</td><td className="px-2 py-1 text-right tabular-nums">{r.ton_thue2 === '—' ? '—' : fmt(r.ton_thue2 as number)}</td><td className="px-2 py-1 text-right tabular-nums">{r.ton_thuc2 === '—' ? '—' : fmt(r.ton_thuc2 as number)}</td><td className={`px-2 py-1 text-right font-bold tabular-nums ${r.thua > 50 ? 'text-red-600 bg-red-50' : r.thua < 0 ? 'text-red-600 bg-red-50' : ''}`}>{r.thua > 0 ? `+${fmt(r.thua)}` : fmt(r.thua)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              ) : (
              <div className="overflow-auto rounded-lg border border-slate-200 max-h-[600px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0"><tr className="bg-[#eff6ff] text-[#1e3a8a]"><th className="px-2 py-1.5 text-left">Mã thực</th><th className="px-2 py-1.5 text-left">Tên thực</th><th className="px-2 py-1.5 text-left">Mã Tham Chiếu 1</th><th className="px-2 py-1.5 text-left">Mã Tham Chiếu 2</th><th className="px-2 py-1.5 text-right">Tồn thuế 1</th><th className="px-2 py-1.5 text-right">Tồn thực 1</th><th className="px-2 py-1.5 text-right">Tồn thuế 2</th><th className="px-2 py-1.5 text-right">Tồn thực 2</th><th className="px-2 py-1.5 text-right">Thừa</th></tr></thead>
                  <tbody>{(() => {
                    const capMap = new Map(soTon.map((s) => [s.cap1, s] as const));
                    const rows = dmThuc.filter((d) => !qTon || d.ma_thuc.toLowerCase().includes(qTon.toLowerCase()) || d.ten_thuc.toLowerCase().includes(qTon.toLowerCase()) || d.cap1.toLowerCase().includes(qTon.toLowerCase()) || d.cap2.toLowerCase().includes(qTon.toLowerCase())).slice(0, 600);
                    return rows.map((d) => {
                      const s = capMap.get(d.cap1);
                      const ton_thue1 = s?.ton_thue1 ?? 0;
                      const ton_thue2 = d.cap2 ? (s?.ton_thue2 ?? '—') : '—';
                      const ton_thuc1 = d.ma_thuc in thucPerMa ? thucPerMa[d.ma_thuc]! : 0;
                      const ton_thuc2 = d.cap2 ? (d.ma_thuc in thucPerMa ? thucPerMa[d.ma_thuc]! : 0) : '—';
                      const tonThuc2Val = ton_thuc2 === '—' ? null : Number(ton_thuc2);
                      const thua = Number(ton_thue1) - Number(ton_thuc1 || 0);
                      return <tr key={d.ma_thuc} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-2 py-1 font-mono">{d.ma_thuc}</td><td className="px-2 py-1 max-w-[280px] truncate" title={d.ten_thuc}>{d.ten_thuc}</td><td className="px-2 py-1 font-mono">{d.cap1 || '—'}</td><td className="px-2 py-1 font-mono">{d.cap2 || '—'}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(ton_thue1)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(ton_thuc1)}</td><td className="px-2 py-1 text-right tabular-nums">{ton_thue2 === '—' ? '—' : fmt(ton_thue2 as number)}</td><td className="px-2 py-1 text-right tabular-nums">{tonThuc2Val === null ? '—' : fmt(tonThuc2Val as number)}</td><td className={`px-2 py-1 text-right font-bold tabular-nums ${thua > 50 ? 'text-red-600 bg-red-50' : thua < 0 ? 'text-red-600 bg-red-50' : ''}`}>{thua > 0 ? `+${fmt(thua)}` : fmt(thua)}</td></tr>;
                    });
                  })()}</tbody>
                </table>
              </div>
              )}
            </div>
            </div>
          </div>
        )}

        {tab === 'goiy' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setOpt(1)} className={`rounded-full px-3 py-1 text-xs font-semibold ${opt === 1 ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>Gợi ý theo tồn</button>
                <button onClick={() => setOpt(3)} className={`rounded-full px-3 py-1 text-xs font-semibold ${opt === 3 ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>Gợi ý theo khách</button>
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
                <b className="text-sm text-[#0f2a4a]">Gợi ý theo khách — sổ chi tiết theo khoảng ngày</b>
                <p className="mt-1 text-[11px] text-slate-500">Gõ để chọn khách (autocomplete) — data lấy từ Báo cáo bán hàng (sales_rows), các chức năng gợi ý giống hệt Gợi ý theo tồn, chỉ khác là gợi ý gần giống thực tế mua bán của khách.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input value={khachOpen ? khachQuery : (khach ? (khachList.find((k: any) => k.ma_kh === khach)?.ten_kh ? `${khach} — ${khachList.find((k: any) => k.ma_kh === khach)?.ten_kh}` : khach) : '')} onFocus={() => { setKhachOpen(true); setKhachQuery(''); }} onBlur={() => setTimeout(() => setKhachOpen(false), 180)} onChange={(e) => { setKhachQuery(e.target.value); setKhachOpen(true); }} placeholder="Gõ mã/tên khách…" className="w-[320px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                    {khachOpen && (() => {
                      const q = khachQuery.trim().toLowerCase();
                      if (!q) return null;
                      const opts = khachList.filter((k: any) => String(k.ma_kh).toLowerCase().includes(q) || String(k.ten_kh).toLowerCase().includes(q)).slice(0, 5);
                      if (!opts.length) return <div className="absolute left-0 top-[34px] z-30 w-[420px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">Không tìm thấy khách</div>;
                      return <div className="absolute left-0 top-[34px] z-30 max-h-[180px] w-[420px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {opts.map((k: any) => (
                          <button key={k.ma_kh} onMouseDown={(e) => { e.preventDefault(); setKhach(k.ma_kh); setKhachOpen(false); setKhachQuery(`${k.ma_kh} — ${k.ten_kh}`); }} className="w-full truncate px-3 py-1.5 text-left text-xs hover:bg-slate-50">
                            {k.ma_kh} - {k.ten_kh}
                          </button>
                        ))}
                      </div>;
                    })()}
                  </div>
                  <label className="text-xs text-slate-600">Từ ngày</label><input type="date" value={khTu} onChange={(e) => setKhTu(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                  <label className="text-xs text-slate-600">Đến ngày</label><input type="date" value={khDen} onChange={(e) => setKhDen(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                  <button onClick={xemKhach} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white">Xem sổ chi tiết</button>
                  {khachDebt != null && <span className={`ml-2 rounded-full px-3 py-1 text-xs font-bold ${khachDebt.con_thieu > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>Công nợ hiện tại: {fmt(khachDebt.con_thieu)}đ</span>}
                </div>
                <div className="mt-3 max-h-[340px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
                  {khachRows.length > 0 && (
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                      <span>Tổng thành tiền: {fmt(khachRows.reduce((s, r) => s + Number(r.tt ?? 0), 0))}đ</span>
                      <span className="text-[11px] font-normal text-slate-500">{khachRows.length} mã · kéo ngang để xem đủ cột →</span>
                    </div>
                  )}
                  <table className="w-full min-w-[1100px] text-[11px]">
                    <thead><tr className="bg-[#eff6ff] text-left text-[#1e3a8a]"><th className="px-2 py-1">Mã thực</th><th className="px-2 py-1">Tên thực</th><th className="px-2 py-1 text-right">SL bán</th><th className="px-2 py-1 text-right">Đơn giá</th><th className="px-2 py-1 text-right">Thành tiền</th><th className="px-2 py-1">Mã thuế</th><th className="px-2 py-1">Tên thuế</th><th className="px-2 py-1">Mã Tham Chiếu 1</th><th className="px-2 py-1 text-right">Tồn thuế 1</th><th className="px-2 py-1 text-right">Tồn thực 1</th><th className="px-2 py-1 text-right">Thừa</th></tr></thead>
                    <tbody>{khachRows.map((r, i) => {
                      const donGia = r.sl ? Math.round(Number(r.tt ?? 0) / Number(r.sl)) : 0;
                      const thua = Number(r.ton_thue1 ?? 0) - Number(r.ton_thuc1 ?? 0);
                      return <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1 font-mono">{r.ma_thuc}</td><td className="px-2 py-1 max-w-[220px] truncate" title={r.ten_thuc}>{r.ten_thuc}</td><td className="px-2 py-1 text-right tabular-nums font-semibold">{fmt(r.sl)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(donGia)}</td><td className="px-2 py-1 text-right tabular-nums font-semibold">{fmt(r.tt)}</td><td className="px-2 py-1 font-mono">{r.ma_thue}</td><td className="px-2 py-1 max-w-[180px] truncate" title={r.ten_thue}>{r.ten_thue}</td><td className="px-2 py-1 font-mono">{r.cap1}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thue1)}</td><td className="px-2 py-1 text-right tabular-nums">{fmt(r.ton_thuc1)}</td><td className={`px-2 py-1 text-right tabular-nums font-bold ${thua > 0 ? 'text-emerald-600' : thua < 0 ? 'text-red-600' : ''}`}>{thua > 0 ? `+${fmt(thua)}` : fmt(thua)}</td></tr>;
                    })}</tbody>
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
                          <div className="relative flex items-center gap-1">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${r.lk.ma ? 'bg-emerald-500' : r.ma ? 'bg-amber-400' : 'bg-slate-300'}`} title={r.lk.ma ? 'đã chốt' : r.ma ? 'gợi ý' : ''} />
                            <input
                              value={maOpen === i ? (maQuery[i] ?? '') : (r.ma || '')}
                              onFocus={() => { setMaOpen(i); setMaQuery((m) => ({ ...m, [i]: r.ma || '' })); }}
                              onBlur={() => setTimeout(() => setMaOpen((o) => (o === i ? null : o)), 180)}
                              onChange={(e) => { const v = e.target.value; setMaQuery((m) => ({ ...m, [i]: v })); if (v.trim()) setMaOpen(i); else setMaOpen(null);
                                const exact = dmThue.find((x) => x.ma_thue.toLowerCase() === v.toLowerCase());
                                if (exact) { const nxt = [...inv]; nxt[i] = { ...r, ma: exact.ma_thue, ten: exact.ten_thue, vat: exact.vat, lk: { ...r.lk, ma: true } }; if (!r.lk.gia) { nxt[i].giaChua = String(exact.gia_chua_vat); nxt[i].giaDa = String(calcGiaDa(exact.gia_chua_vat, exact.vat)); } setInv(nxt); }
                                else if (!v) { const nxt = [...inv]; nxt[i] = { ...r, ma: '', ten: '', lk: { ...r.lk, ma: false } }; setInv(nxt); }
                              }}
                              placeholder="Gõ mã…"
                              className={`w-[200px] rounded border px-2 py-1 text-[11px] font-mono ${r.lk.ma ? 'border-[#0f2a4a] bg-blue-50 font-semibold' : 'border-slate-200 bg-white'}`}
                            />
                            {r.lk.ma && <button onClick={() => { const nxt = [...inv]; nxt[i] = { ...r, lk: { ...r.lk, ma: false } }; setInv(nxt); }} className="text-[11px] text-slate-500 hover:text-[#1e3a8a]">↺</button>}
                            {maOpen === i && (() => {
                              const q = (maQuery[i] ?? '').trim().toLowerCase();
                              if (!q) return null;
                              const opts = dmThue.filter((d) => d.ma_thue.toLowerCase().includes(q) || d.ten_thue.toLowerCase().includes(q)).slice(0, 5);
                              if (!opts.length) return null;
                              return <div className="absolute left-0 top-[28px] z-30 max-h-[180px] w-[520px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                {opts.map((d) => (
                                  <button key={d.ma_thue} onMouseDown={(e) => { e.preventDefault(); const nxt = [...inv]; nxt[i] = { ...r, ma: d.ma_thue, ten: d.ten_thue, vat: d.vat, lk: { ...r.lk, ma: true } }; if (!r.lk.gia) { nxt[i].giaChua = String(d.gia_chua_vat); nxt[i].giaDa = String(calcGiaDa(d.gia_chua_vat, d.vat)); } setInv(nxt); setMaOpen(null); }} className="w-full truncate px-3 py-1.5 text-left text-xs hover:bg-slate-50">
                                    {d.ma_thue} - {d.ten_thue}
                                  </button>
                                ))}
                              </div>;
                            })()}
                          </div>
                        </td>
                        <td className="px-2 py-1 max-w-[280px] truncate text-slate-600" title={r.ten}>{r.ten || '—'}</td>
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
                <div className="flex gap-2">
                  {opt === 3 ? <button onClick={() => doGoiY(true, true)} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e40af]">✨ Gợi ý hóa đơn cho khách này</button>
                    : <button onClick={() => { const hasData = inv.some(r => r.ma); doGoiY(false, hasData); }} className="rounded-lg bg-[#1e3a8a] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1e40af]">✨ Gợi ý</button>}
                  <button onClick={suaGiaCuoi} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold hover:border-[#1e3a8a]">Sửa giá dòng cuối cho khớp 100%</button>
                  <button onClick={() => { setInv([{ ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } }, { ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } }, { ma: '', ten: '', sl: '', giaChua: '', vat: 10, giaDa: '', lk: { ma: false, sl: false, gia: false } }]); setMaQuery({}); setMaOpen(null); setGoiyMsg(''); setGoiySeed(0); }} className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold">↺ Làm mới</button>
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
