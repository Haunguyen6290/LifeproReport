'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { WarehouseDialog, type WarehouseInitial } from '@/components/WarehouseDialog';
import { WarehouseReportDetail } from '@/components/WarehouseReportDetail';
import { Dialog } from '@/components/Dialog';
import { Selectable } from '@/components/Selectable';
import { categoryItems, type CategoryItem } from '@/lib/categories';
import { notifyTelegram } from '@/lib/notify';
import { weekBounds } from '@/lib/week';
import { fmtDateVN, fmtCommentTimeVN } from '@/lib/time';

type Row = {
  id: string;
  user_id: string;
  ngay: string;
  product_group_id: string | null;
  nhom_van_de_id: string | null;
  so_luong: number | null;
  thuc_trang: string;
  de_xuat: string;
  trang_thai: string;
  y_kien_quan_ly: string;
  tuan_tu: string | null;
  tuan_den: string | null;
  created_at: string;
};

function TrangThai({ v }: { v: string }) {
  const dot = v === 'Đã xử lý' ? 'bg-emerald-500' : v === 'Đang giải quyết' ? 'bg-amber-500' : 'bg-red-500';
  const text = v === 'Đã xử lý' ? 'text-emerald-700' : v === 'Đang giải quyết' ? 'text-amber-700' : 'text-red-700';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${text}`}>
      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      {v}
    </span>
  );
}

function weekKey(r: Row): string {
  if (r.tuan_tu && r.tuan_den) return `${fmtDateVN(r.tuan_tu)} → ${fmtDateVN(r.tuan_den)}`;
  if (r.ngay) {
    const d = new Date(r.ngay + 'T00:00:00Z');
    if (!isNaN(d.getTime())) {
      const b = weekBounds(d);
      return `${fmtDateVN(b.tu)} → ${fmtDateVN(b.den)}`;
    }
  }
  return r.tuan_tu ? fmtDateVN(r.tuan_tu) : '—';
}

function Screen() {
  const { userId, can } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string[]>(['Chờ giải quyết', 'Đang giải quyết']); // Mặc định chỉ hiện chưa xong
  const [filterGroup, setFilterGroup] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [sanPhamMap, setSanPhamMap] = useState<Map<string, string>>(new Map());
  const [vanDeMap, setVanDeMap] = useState<Map<string, string>>(new Map());
  const [sanPhamOpts, setSanPhamOpts] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseInitial | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const canManage = can('quan_ly_okr');

  // load category opts for filter + map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([categoryItems('san_pham'), categoryItems('nhom_van_de_kho')]);
        if (cancelled) return;
        setSanPhamOpts(a);
        setSanPhamMap(new Map(a.map((x) => [x.id, x.name])));
        setVanDeMap(new Map(b.map((x) => [x.id, x.name])));
      } catch {
        if (!cancelled) { setSanPhamOpts([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg('');
      try {
        let q = supabase
          .from('warehouse_reports')
          .select('id, user_id, ngay, product_group_id, nhom_van_de_id, so_luong, thuc_trang, de_xuat, trang_thai, y_kien_quan_ly, tuan_tu, tuan_den, created_at')
          .order('ngay', { ascending: false })
          .order('created_at', { ascending: false });
        if (filterStatus.length > 0) q = q.in('trang_thai', filterStatus);
        if (filterGroup) q = q.eq('product_group_id', filterGroup);
        const { data, error } = await q;
        if (cancelled) return;
        if (error) { setMsg(error.message); setRows([]); }
        else {
          const list = (data ?? []) as Row[];
          setRows(list);
          const uids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean)));
          if (uids.length) {
            const { data: profs } = await supabase.from('profiles').select('id, full_name, username').in('id', uids);
            if (cancelled) return;
            const m = new Map<string, string>();
            for (const p of (profs ?? []) as any[]) m.set(p.id, p.full_name || p.username || p.id.slice(0, 8));
            setProfiles(m);
          } else setProfiles(new Map());
        }
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? 'Lỗi tải dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filterStatus, filterGroup, refreshKey]);

  async function handleDelete(r: Row) {
    if (!confirm(`Xóa báo cáo ngày ${fmtDateVN(r.ngay)} — “${r.thuc_trang.slice(0, 60)}”?`)) return;
    try {
      const { error } = await supabase.from('warehouse_reports').delete().eq('id', r.id);
      if (error) { setMsg(error.message); return; }
      try {
        const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Xóa báo cáo kho', entity_type: 'warehouse_report', entity_id: r.id, details: { ngay: r.ngay, thuc_trang: r.thuc_trang.slice(0, 200), full_name: (me2 as any)?.full_name ?? '' } });
      } catch {}
      const _ttX = r.thuc_trang.slice(0, 300);
      const _ngX = fmtDateVN(r.ngay);
      notifyTelegram('TB_BAO_CAO_KHO', (nm) => `[Báo cáo kho] Xóa ${_ngX} · Người xóa: ${nm}\n${_ttX}`, userId);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      setMsg(e?.message ?? 'Không xóa được');
    }
  }

  function openAdd() { setEditing(null); setOpen(true); }
  function openEdit(r: Row) {
    setEditing({
      id: r.id, ngay: r.ngay, product_group_id: r.product_group_id, nhom_van_de_id: r.nhom_van_de_id,
      so_luong: r.so_luong, thuc_trang: r.thuc_trang, de_xuat: r.de_xuat, trang_thai: r.trang_thai, y_kien_quan_ly: r.y_kien_quan_ly,
      tuan_tu: r.tuan_tu, tuan_den: r.tuan_den,
    });
    setOpen(true);
  }

  // group by week for Lịch sử nhóm theo tuần
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = weekKey(r);
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const sel = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Báo cáo kho</h1>
          <button onClick={openAdd} className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-hover)]">+ Thêm báo cáo</button>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#1e3a8a]">Trạng thái</label>
              <select value={filterStatus.length === 1 ? filterStatus[0] : (filterStatus.length === 2 && !filterStatus.includes('Đã xử lý') ? 'CHUA_XON' : 'TAT_CA')} onChange={(e) => { const v = e.target.value; if (v === 'TAT_CA') setFilterStatus([]); else if (v === 'CHUA_XONG') setFilterStatus(['Chờ giải quyết', 'Đang giải quyết']); else setFilterStatus([v]); }} className={sel}>
                <option value="CHUA_XONG">Chờ xử lý + Đang xử lý</option>
                <option value="Chờ giải quyết">Chờ giải quyết</option>
                <option value="Đang giải quyết">Đang giải quyết</option>
                <option value="Đã xử lý">Đã xử lý</option>
                <option value="TAT_CA">Tất cả trạng thái</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#1e3a8a]">Nhóm sản phẩm</label>
              <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className={sel}>
                <option value="">— Tất cả —</option>
                {sanPhamOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Lọc theo Trạng thái và Nhóm sản phẩm. Mặc định chỉ hiện báo cáo chưa xử lý xong.</p>
        </div>

        {msg && <p className="mb-3 text-sm text-red-600">{msg}</p>}
        {loading ? <p className="py-8 text-center text-sm text-slate-600">Đang tải…</p> : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">Chưa có báo cáo trong khoảng này.</p>
            <button onClick={openAdd} className="mt-3 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">+ Thêm báo cáo</button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([wk, list]) => (
              <div key={wk} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Tuần {wk}</span>
                  <span className="text-xs text-slate-500">{list.length} dòng</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col style={{ width: 108 }} />
                      <col style={{ width: 128 }} />
                      <col style={{ width: 118 }} />
                      <col style={{ width: 118 }} />
                      <col />
                      <col />
                      <col style={{ width: 158 }} />
                      <col style={{ width: 72 }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
                        <th className="whitespace-nowrap px-3 py-2">Ngày</th>
                        <th className="whitespace-nowrap px-3 py-2">Người tạo</th>
                        <th className="whitespace-nowrap px-3 py-2">Nhóm SP</th>
                        <th className="whitespace-nowrap px-3 py-2">Nhóm vấn đề</th>
                        <th className="px-3 py-2">Thực trạng</th>
                        <th className="px-3 py-2">Đề xuất</th>
                        <th className="whitespace-nowrap px-3 py-2 text-center">Trạng thái</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map((r) => {
                        const canEdit = r.user_id === userId || canManage;
                        const isAdmin = can('quan_ly_nguoi_dung');
                        const spName = r.product_group_id ? (sanPhamMap.get(r.product_group_id) ?? r.product_group_id.slice(0, 8)) : '—';
                        const vdName = r.nhom_van_de_id ? (vanDeMap.get(r.nhom_van_de_id) ?? r.nhom_van_de_id.slice(0, 8)) : '—';
                        const canDelete = isAdmin && r.trang_thai === 'Đã xử lý';
                        const ngayGio = (() => {
                          const d = fmtDateVN(r.ngay);
                          const t = new Date(r.created_at);
                          const hh = isNaN(t.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
                          // Rút gọn 22/08/2026 09:15 -> 22/08 09:15 (bỏ năm cho cột nhỏ)
                          const shortD = d.split('/').slice(0, 2).join('/') ;
                          return hh ? `${shortD} ${hh}` : d;
                        })();
                        return (
                          <Selectable key={r.id} as="tr" onOpen={() => { setDetailId(r.id); setDetailOpen(true); }} className="cursor-pointer align-top hover:bg-slate-50">
                            <td className="truncate px-3 py-2 text-sm text-slate-700" title={ngayGio}>{ngayGio}</td>
                            <td className="break-words px-3 py-2 text-sm font-medium text-slate-900">{profiles.get(r.user_id) ?? r.user_id.slice(0, 8)}</td>
                            <td className="break-words px-3 py-2 text-sm text-slate-900">{spName}</td>
                            <td className="break-words px-3 py-2 text-sm text-slate-700">{vdName}</td>
                            <td className="px-3 py-2"><p className="whitespace-pre-wrap break-words text-sm text-slate-900">{r.thuc_trang}</p></td>
                            <td className="px-3 py-2"><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{r.de_xuat || '—'}</p></td>
                            <td className="px-3 py-2 text-center"><TrangThai v={r.trang_thai} /></td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              <span className="inline-flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} aria-label="Sửa" className="rounded-md p-1 text-slate-600 hover:bg-slate-100 hover:text-[#1e3a8a]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                {canDelete && <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} aria-label="Xóa" className="rounded-md p-1 text-red-600 hover:bg-red-50"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>}</span>
                            </td>
                          </Selectable>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <WarehouseDialog open={open} onClose={() => setOpen(false)} initial={editing} onDone={() => setRefreshKey((k) => k + 1)} />
        {detailOpen && detailId && <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết báo cáo kho" size="xwide"><WarehouseReportDetail id={detailId} /></Dialog>}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
