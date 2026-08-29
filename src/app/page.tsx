'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { BangTinFeed } from '@/components/BangTinFeed';
import { OkrTree } from '@/components/OkrTree';
import { fmtCommentTimeVN, fmtDateVN } from '@/lib/time';
import { visibleTabIds, type DashboardTabId } from '@/lib/dashboard';

type NV = { hoTen: string; soKh: number; thieuVH: number; thieuKT: number };
type TinCard = { id: string; loaiTin: string; content: string; status: string };
type CampCard = { id: string; name: string; status: string; type: string };

type WeeklyRow = { id: string; user_id: string; tuan_tu: string; tuan_den: string; noi_dung: string; created_at: string };
type WhRow = { id: string; product_group_id: string | null; ngay: string; thuc_trang: string; trang_thai: string; so_luong: number | null };

const VH = ['scale_id', 'so_co_so', 'xe_ngay', 'segment', 'sp_dang_ban', 'nguon_nhap', 'sp_ban_manh', 'sp_ban_yeu'];
const KT = ['van_de', 'sp_cty_phu_hop', 'ly_do_chon', 'tro_ngai', 'ghi_chu'];
function filled(r: Record<string, any>, fs: string[]) { let n = 0; for (const f of fs) if (String(r[f] ?? '').trim()) n++; return n; }

function OkrSummaryCard({ tu, den }: { tu: string; den: string }) {
  const [summary, setSummary] = useState<{ total: number; cham: number; done: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tu || !den) return;
      const { data } = await supabase.from('okrs').select('id, tien_do, den_ngay, trang_thai').gte('tu_ngay', tu).lte('den_ngay', den);
      if (cancelled) return;
      const list = (data ?? []) as any[];
      const now = new Date();
      const nearDeadline = (denNgay: string) => {
        const d = new Date(denNgay + 'T00:00:00+07:00');
        if (isNaN(d.getTime())) return false;
        const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 14;
      };
      const cham = list.filter((r: any) => Number(r.tien_do) < 50 && nearDeadline(r.den_ngay)).length;
      const done = list.filter((r: any) => r.trang_thai === 'Hoàn thành').length;
      setSummary({ total: list.length, cham, done });
    })();
    return () => { cancelled = true; };
  }, [tu, den]);
  if (!summary) return <p className="text-sm text-slate-500">Đang tải OKR…</p>;
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{summary.total} OKR</span>
      <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">{summary.done} hoàn thành</span>
      {summary.cham > 0 && <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">{summary.cham} chậm (tien_do &lt; 50, gần hạn)</span>}
      <Link href="/okr" className="rounded-full bg-[#0f2a4a] px-3 py-1 font-semibold text-white hover:bg-[#1e40af]">Xem OKR →</Link>
    </div>
  );
}

function TongHopTab({ tu, den, camps, nhanVien }: { tu: string; den: string; camps: CampCard[]; nhanVien: NV[] }) {
  const [plans, setPlans] = useState<WeeklyRow[]>([]);
  const [reports, setReports] = useState<WeeklyRow[]>([]);
  const [tins, setTins] = useState<{ id: string; content: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tu || !den) return;
      setLoading(true);
      try {
        const [pRes, rRes, tinRes] = await Promise.all([
          supabase.from('weekly_plans').select('id, user_id, tuan_tu, tuan_den, noi_dung, created_at').gte('tuan_tu', tu).lte('tuan_den', den).order('created_at', { ascending: false }).limit(20),
          supabase.from('weekly_reports').select('id, user_id, tuan_tu, tuan_den, noi_dung, created_at').gte('tuan_tu', tu).lte('tuan_den', den).order('created_at', { ascending: false }).limit(20),
          supabase.from('market_news').select('id, content, created_at').gte('ngay', tu).lte('ngay', den).order('created_at', { ascending: false }).limit(10),
        ]);
        if (cancelled) return;
        setPlans((pRes.data ?? []) as any[]);
        setReports((rRes.data ?? []) as any[]);
        setTins((tinRes.data ?? []) as any[]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tu, den]);
  if (loading) return <p className="py-6 text-center text-sm text-slate-600">Đang tải…</p>;
  const campCard = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';
  const campCardInner = 'rounded-lg border border-slate-200 bg-[#f8fafc] p-3';
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-[#0f2a4a]">Kế hoạch tuần ({plans.length})</h3>
          {plans.length === 0 ? <p className="mt-2 text-sm text-slate-500">Không có kế hoạch trong kỳ.</p> : (
            <ul className="mt-2 space-y-2">
              {plans.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="line-clamp-2 text-sm text-slate-900">{r.noi_dung.slice(0, 120)}</p>
                  <p className="mt-1 text-xs text-slate-500">{fmtDateVN(r.tuan_tu)} → {fmtDateVN(r.tuan_den)} · {fmtCommentTimeVN(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-[#0f2a4a]">Báo cáo tuần ({reports.length})</h3>
          {reports.length === 0 ? <p className="mt-2 text-sm text-slate-500">Không có báo cáo trong kỳ.</p> : (
            <ul className="mt-2 space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="line-clamp-2 text-sm text-slate-900">{r.noi_dung.slice(0, 120)}</p>
                  <p className="mt-1 text-xs text-slate-500">{fmtDateVN(r.tuan_tu)} → {fmtDateVN(r.tuan_den)} · {fmtCommentTimeVN(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-[#0f2a4a]">Tin thị trường ({tins.length})</h3>
        {tins.length === 0 ? <p className="mt-2 text-sm text-slate-500">Không có tin trong kỳ.</p> : (
          <ul className="mt-2 space-y-2">
            {tins.map((t) => (
              <li key={t.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="line-clamp-2 text-sm text-slate-900">{t.content.slice(0, 120)}</p>
                <p className="mt-1 text-xs text-slate-500">{fmtCommentTimeVN(t.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link href="/bao-cao-tuan" className="inline-block text-sm font-semibold text-[#0d6efd] hover:underline">Xem Báo cáo tuần →</Link>
      {' · '}
      <Link href="/thi-truong" className="inline-block text-sm font-semibold text-[#0d6efd] hover:underline">Báo cáo Tổng hợp KD →</Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={campCard}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1e3a8a]">Chiến dịch</h2>
            <Link href="/chien-dich" className="text-xs font-semibold text-[#0d6efd] hover:underline">Xem tất cả →</Link>
          </div>
          {camps.length === 0 ? <p className="py-6 text-center text-sm text-slate-600">Chưa có chiến dịch.</p> : (
            <div className="space-y-2">
              {camps.map((c) => (
                <div key={c.id} className={campCardInner}>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm line-clamp-1">{c.name}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{c.status}</span></div>
                  <p className="mt-1 text-xs text-slate-600">{c.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={campCard + ' overflow-hidden'}>
          <h2 className="mb-3 text-sm font-bold text-[#1e3a8a]">Thống kê Khách hàng</h2>
          {nhanVien.length === 0 ? <p className="text-sm text-slate-600">—</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-700"><th className="py-2">Nhân viên</th><th className="py-2 text-right">Khách</th><th className="py-2 text-right">Thiếu vận hành</th><th className="py-2 text-right">Thiếu khai thác</th></tr></thead>
                <tbody>{nhanVien.map((n) => <tr key={n.hoTen} className="border-t border-slate-100"><td className="py-2 font-medium text-slate-900">{n.hoTen}</td><td className="py-2 text-right font-semibold text-slate-900">{n.soKh}</td><td className={`py-2 text-right ${n.thieuVH ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>{n.thieuVH}</td><td className={`py-2 text-right ${n.thieuKT ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>{n.thieuKT}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KhoTab({ tu, den }: { tu: string; den: string }) {
  const [rows, setRows] = useState<WhRow[]>([]);
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tu || !den) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('warehouse_reports')
          .select('id, product_group_id, ngay, thuc_trang, trang_thai, so_luong')
          .gte('ngay', tu).lte('ngay', den)
          .order('ngay', { ascending: false }).limit(100);
        if (cancelled) return;
        const list = (data ?? []) as WhRow[];
        setRows(list);
        const gids = Array.from(new Set(list.map((r) => r.product_group_id).filter(Boolean) as string[]));
        if (gids.length) {
          const { data: items } = await supabase.from('category_items').select('id, name').in('id', gids);
          if (cancelled) return;
          const m = new Map<string, string>();
          for (const it of (items ?? []) as any[]) m.set(it.id, it.name);
          setGroupNames(m);
        } else setGroupNames(new Map());
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tu, den]);

  const grouped = useMemo(() => {
    const m = new Map<string, WhRow[]>();
    for (const r of rows) {
      const k = r.product_group_id ?? '__none__';
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  if (loading) return <p className="py-6 text-center text-sm text-slate-600">Đang tải kho…</p>;
  if (rows.length === 0) return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm text-slate-600">Không có báo cáo kho trong kỳ {fmtDateVN(tu)} → {fmtDateVN(den)}.</p>
      <Link href="/bao-cao-kho" className="mt-3 inline-block rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white">Đi tới Báo cáo kho →</Link>
    </div>
  );
  return (
    <div className="space-y-4">
      {grouped.map(([gid, list]) => (
        <div key={gid} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{gid === '__none__' ? 'Chưa phân nhóm' : (groupNames.get(gid) ?? gid.slice(0, 8))}</span>
            <span className="text-xs text-slate-500">{list.length} dòng</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {list.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-slate-900">{r.thuc_trang || '—'}</p>
                  <p className="mt-1 text-xs text-slate-500">{fmtDateVN(r.ngay)} · {r.trang_thai}{r.so_luong != null ? ` · SL: ${r.so_luong}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Link href="/bao-cao-kho" className="inline-block text-sm font-semibold text-[#0d6efd] hover:underline">Xem Báo cáo kho →</Link>
    </div>
  );
}

function TongQuanContent() {
  const { permissions, can } = useAuth();
  // Default period: current quarter-ish — keep simple: last 90 days
  const defaults = useMemo(() => {
    const den = new Date().toISOString().slice(0, 10);
    const d = new Date(); d.setDate(d.getDate() - 90);
    return { tu: d.toISOString().slice(0, 10), den };
  }, []);
  const [tu, setTu] = useState(defaults.tu);
  const [den, setDen] = useState(defaults.den);

  const allowedIds = useMemo(() => visibleTabIds(permissions), [permissions]);
  const [tab, setTab] = useState<DashboardTabId>('okr');
  useEffect(() => {
    if (allowedIds.length === 0) return;
    if (!allowedIds.includes(tab)) setTab(allowedIds[0]);
  }, [allowedIds, tab]);

  // Keep original overview data for non-tab content? Show legacy cards under tabs or keep only tabs?
  // Brief says dashboard ties them together with 3 tabs; keep a compact legacy section below tabs.
  const [nhanVien, setNhanVien] = useState<NV[]>([]);
  const [tins, setTins] = useState<TinCard[]>([]);
  const [camps, setCamps] = useState<CampCard[]>([]);
  useEffect(() => {
    (async () => {
      const [kh, tin, cd, users] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('market_news').select('id, type:category_items!market_news_type_id_fkey(name), content, status, conclusion_resolved').order('created_at', { ascending: false }).limit(6),
        supabase.from('campaigns').select('id, name, type:category_items!campaigns_type_id_fkey(name), status:category_items!campaigns_status_id_fkey(name)').order('created_at', { ascending: false }).limit(6),
        supabase.from('profiles').select('id, username, full_name, roles(name)').eq('status', 'ACTIVE'),
      ]);
      const rows = (kh.data ?? []) as unknown as Record<string, any>[];
      const profiles = (users.data ?? []) as { id: string; username: string; full_name: string; roles?: { name: string } | { name: string }[] | null }[];
      const roleName = (p: { roles?: { name: string } | { name: string }[] | null }) => {
        const r = p.roles;
        if (!r) return '';
        return Array.isArray(r) ? (r[0]?.name ?? '') : (r.name ?? '');
      };
      const admin = profiles.find((p) => p.username === 'admin');
      // Chỉ thống kê nhân viên KINH DOANH (KINH_DOANH / SALES) — không tính cả công ty
      const others = profiles.filter((p) => p.username !== 'admin' && ['KINH_DOANH', 'SALES'].includes(roleName(p)));
      const list: NV[] = others.map((u) => {
        const mine = rows.filter((r) => String(r.assigned_to) === String(u.id));
        return { hoTen: u.full_name, soKh: mine.length, thieuVH: mine.filter((r) => filled(r, VH) < 2).length, thieuKT: mine.filter((r) => filled(r, KT) < 2).length };
      });
      if (admin) {
        const unassigned = rows.filter((r) => String(r.assigned_to) === String(admin.id));
        if (unassigned.length > 0) list.push({ hoTen: 'Khách chưa giao', soKh: unassigned.length, thieuVH: unassigned.filter((r) => filled(r, VH) < 2).length, thieuKT: unassigned.filter((r) => filled(r, KT) < 2).length });
      }
      setNhanVien(list);
      setTins(((tin.data ?? []) as any[]).map((t: any) => ({ id: t.id, loaiTin: t.type?.name ?? '—', content: t.content, status: t.status })));
      setCamps(((cd.data ?? []) as any[]).map((c: any) => ({ id: c.id, name: c.name, status: c.status?.name ?? '—', type: c.type?.name ?? '—' })));
    })();
  }, []);

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';
  const innerCard = 'rounded-lg border border-slate-200 bg-[#f8fafc] p-3 hover:bg-white hover:shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition';

  const tabLabels: Record<DashboardTabId, string> = { okr: 'OKR', tonghop: 'Báo cáo Tổng hợp KD', kho: 'Kho' };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Tổng quan</h1>

        {/* Từ ngày → Đến ngày filter — shared across tabs; each tab query uses gte tu / lte den */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Từ ngày</label>
              <input type="date" value={tu} onChange={(e) => setTu(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Đến ngày</label>
              <input type="date" value={den} onChange={(e) => setDen(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
            </div>
            <span className="pb-2 text-xs text-slate-500">{tu && den ? `${fmtDateVN(tu)} → ${fmtDateVN(den)}` : '—'}</span>
          </div>
        </div>

        {/* Tabs — visible per permissions */}
        {allowedIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">Bạn chưa được cấp quyền xem dashboard. Liên hệ quản trị để được cấp quyền.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Dashboard tabs">
              {allowedIds.map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === id ? 'bg-[#0f2a4a] text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
                >
                  {tabLabels[id]}
                </button>
              ))}
            </div>

            <div className="mb-6">
              {tab === 'okr' && (
                <div className="space-y-4">
                  <div className={`${card}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-[#1e3a8a]">Tổng quan OKR</h2>
                      <Link href="/okr" className="text-xs font-semibold text-[#0d6efd] hover:underline">Đi tới OKR →</Link>
                    </div>
                    <OkrSummaryCard tu={tu} den={den} />
                  </div>
                  <OkrTree tu={tu} den={den} readOnly />
                </div>
              )}
              {tab === 'tonghop' && <TongHopTab tu={tu} den={den} camps={camps} nhanVien={nhanVien} />}
              {tab === 'kho' && <KhoTab tu={tu} den={den} />}
            </div>
          </>
        )}
    </div>
  );
}

/** Trang chủ: 2 tab — Bảng tin (mặc định) | Tổng quan. Vào phần mềm là thấy Bảng tin. */
function HomeInner() {
  const { can } = useAuth();
  const canSeeTongQuan = can('quan_ly_okr') || can('xem_okr') || can('bao_cao_tuan') || can('bao_cao_kho') || can('bao_cao_ban_hang') || can('xem_khach_hang') || can('quan_ly_chien_dich');
  const [tab, setTab] = useState<'bangtin' | 'tongquan'>('bangtin');
  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[900px]">
          <div className="mb-4 flex gap-2 border-b border-slate-200">
            <button onClick={() => setTab('bangtin')} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${tab === 'bangtin' ? 'border-[#16A97B] text-[#16A97B]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Bảng tin</button>
            {canSeeTongQuan && <button onClick={() => setTab('tongquan')} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${tab === 'tongquan' ? 'border-[#16A97B] text-[#16A97B]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Tổng quan</button>}
          </div>
          {tab === 'bangtin' ? <BangTinFeed /> : <TongQuanContent />}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><HomeInner /></RequireAuth>; }
