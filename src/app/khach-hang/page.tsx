'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { categoryItems } from '@/lib/categories';
import { filterCustomers, sortCustomers, type SortKey, type SortStack } from '@/lib/customers';
import { tierColor } from '@/components/CustomerForm';
import { AddCustomerDialog } from '@/components/AddCustomerDialog';
import { EditCustomerDialog } from '@/components/EditCustomerDialog';

type KH = {
  id: string; ma_kh: string; ten_kh: string; sdt: string; tinh_thanh: string;
  assigned_to: string; tier_id: string | null; status_id: string | null;
  assigned?: { full_name: string } | null;
  tier?: { code: string; name: string } | null;
  status?: { name: string } | null;
};

function Screen() {
  const router = useRouter();
  const { userId, can } = useAuth();
  const [rows, setRows] = useState<KH[]>([]);
  const [users, setUsers] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [tiers, setTiers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [q, setQ] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [tierId, setTierId] = useState('');
  const [province, setProvince] = useState('');
  const [reassignOpen, setReassignOpen] = useState(false);
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [reassignMsg, setReassignMsg] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const loadRows = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, ma_kh, ten_kh, sdt, tinh_thanh, assigned_to, tier_id, status_id, assigned:profiles!customers_assigned_to_fkey(full_name), tier:category_items!customers_tier_id_fkey(code,name), status:category_items!customers_status_id_fkey(name)')
      .order('created_at', { ascending: false });
    setRows(((data ?? []) as unknown) as KH[]);
    const [u, t] = await Promise.all([
      supabase.from('profiles').select('id, username, full_name').eq('status', 'ACTIVE'),
      categoryItems('phan_hang_kh'),
    ]);
    setUsers((u.data ?? []) as { id: string; username: string; full_name: string }[]);
    setTiers(t.map((x) => ({ id: x.id, code: x.code, name: x.name })));
  };
  useEffect(() => { loadRows(); }, []);
  useEffect(() => { const u = new URLSearchParams(window.location.search).get('q'); if (u) setQ(u); }, []);

  const provinces = useMemo(() => {
    const base = filterCustomers(rows, { q, assignedTo, tierId, statusId: '' });
    const set = new Set<string>();
    base.forEach((r) => { if (r.tinh_thanh?.trim()) set.add(r.tinh_thanh.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [rows, q, assignedTo, tierId]);
  const tierCounts = useMemo(() => {
    const base = filterCustomers(rows, { q, assignedTo, tierId: '', statusId: '' });
    const filtered2 = province ? base.filter((r) => r.tinh_thanh === province) : base;
    const m = new Map<string, { code: string; label: string; count: number }>();
    filtered2.forEach((r) => {
      const code = r.tier?.code || '';
      const key = code || 'Chưa phân hạng';
      const cur = m.get(key) || { code, label: code ? `${code} · ${r.tier?.name ?? ''}`.trim() : 'Chưa phân hạng', count: 0 };
      cur.count++;
      m.set(key, cur);
    });
    return Array.from(m.values());
  }, [rows, q, assignedTo, province]);
  const visibleUsers = useMemo(() => {
    const base = filterCustomers(rows, { q, assignedTo: '', tierId, statusId: '' });
    const filtered2 = province ? base.filter((r) => r.tinh_thanh === province) : base;
    const ids = new Set(filtered2.map((r) => r.assigned_to));
    return users.filter((u) => ids.has(u.id));
  }, [rows, q, tierId, province, users]);
  const [sortStack, setSortStack] = useState<SortStack>([]);
  const filtered = useMemo(() => {
    let f = filterCustomers(rows, { q, assignedTo, tierId, statusId: '' });
    if (province) f = f.filter((r) => r.tinh_thanh === province);
    return sortCustomers(f as any, sortStack) as KH[];
  }, [rows, q, assignedTo, tierId, province, sortStack]);
  const toggleSort = (key: SortKey) => setSortStack((prev) => {
    const idx = prev.findIndex((s) => s.key === key);
    if (idx === -1) { if (prev.length >= 3) return prev; return [...prev, { key, dir: 'asc' as const }]; }
    const cur = prev[idx];
    if (cur.dir === 'asc') { const next = [...prev]; next[idx] = { key, dir: 'desc' }; return next; }
    return prev.filter((_, i) => i !== idx);
  });
  const arrow = (key: SortKey) => { const s = sortStack.find((x) => x.key === key); if (!s) return '↕'; return s.dir === 'asc' ? '↑' : '↓'; };
  const arrowCls = (key: SortKey) => sortStack.find((x) => x.key === key) ? 'text-[#1e3a8a]' : 'text-slate-400';
  const selCls = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-ring)]';

  async function doReassign() {
    setReassignMsg('');
    if (!fromUser || !toUser || fromUser === toUser) { setReassignMsg('Chọn đủ hai người khác nhau.'); return; }
    const { data, error } = await supabase.from('customers').update({ assigned_to: toUser }).eq('assigned_to', fromUser).select('id');
    if (error) { setReassignMsg(error.message); return; }
    const n = (data ?? []).length;
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Chuyển khách hàng hàng loạt', entity_type: 'customer', entity_id: null, details: { from: fromUser, to: toUser, so_luong: n, full_name: me2?.full_name ?? '' } }); } catch {}
    setReassignMsg(`Đã chuyển ${n} khách hàng.`);
    setReassignOpen(false);
    loadRows();
  }

  return (
    <AppSidebar>
      
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Khách hàng <span className="text-base font-normal text-slate-600">({filtered.length})</span></h1>
          <div className="flex gap-2">
            {can('chuyen_khach_hang_loat') && (
              <button onClick={() => setReassignOpen((o) => !o)} className="rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-primary)] hover:text-[#1e3a8a]">Chuyển khách hàng</button>
            )}
            {can('import_khach') && (
              <Link href="/khach-hang/import" className="rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-primary)] hover:text-[#1e3a8a]">Import Excel</Link>
            )}
            <button onClick={() => setAddOpen(true)} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]">+ Thêm khách hàng</button>
            <AddCustomerDialog open={addOpen} onClose={() => setAddOpen(false)} onDone={loadRows} />
            {editId && <EditCustomerDialog open={!!editId} id={editId} onClose={() => setEditId(null)} onDone={loadRows} />}
          </div>
        </div>

        {reassignOpen && (
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 backdrop-blur">
            <div><label className={selCls + ' mb-1 block border-0 bg-transparent px-0 text-xs font-semibold'}>Từ người phụ trách</label>
              <select value={fromUser} onChange={(e) => setFromUser(e.target.value)} className={selCls}><option value="">— chọn —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
            <span className="pb-2 text-slate-600">→</span>
            <div><label className={selCls + ' mb-1 block border-0 bg-transparent px-0 text-xs font-semibold'}>Sang người phụ trách</label>
              <select value={toUser} onChange={(e) => setToUser(e.target.value)} className={selCls}><option value="">— chọn —</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
            <button onClick={doReassign} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Thực hiện chuyển</button>
            {reassignMsg && <span className="pb-2 text-sm text-slate-600">{reassignMsg}</span>}
          </div>
        )}

        {/* Pill hạng */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">Tổng {rows.length}</span>
          {tierCounts.map((t) => (
            <button key={t.label} onClick={() => setTierId(t.code ? tiers.find((x) => x.code === t.code)?.id ?? '' : '')} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${tierId === (tiers.find((x) => x.code === t.code)?.id ?? '') ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : 'bg-white border-slate-200 hover:border-[#1e3a8a] hover:text-[#1e3a8a]'}`}>
              <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${tierColor(t.code)}`}></span>{t.label} · {t.count}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, SĐT…"
            className="min-w-[180px] flex-1 rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--color-ring)]" />
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={`${selCls} w-auto min-w-[160px]`} aria-label="Lọc người phụ trách">
            <option value="">Tất cả người phụ trách</option>
            {visibleUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={`${selCls} w-auto`} aria-label="Lọc phân hạng">
            <option value="">Mọi phân hạng</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.code ? `${t.code} · ` : ''}{t.name}</option>)}
          </select>
          <select value={province} onChange={(e) => setProvince(e.target.value)} className={`${selCls} w-auto max-w-[180px] sm:max-w-[200px]`} aria-label="Lọc tỉnh thành">
            <option value="">Mọi tỉnh/TP</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Bảng desktop - mã gộp vào tên, Kinh doanh rộng 1.5x Tỉnh */}
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white backdrop-blur md:block">
          <table className="w-full table-fixed text-sm">
            <colgroup><col style={{ width: '44%' }} /><col style={{ width: '11%' }} /><col style={{ width: '27%' }} /><col style={{ width: '18%' }} /></colgroup>
            <thead>
              <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
                <th className="px-4 py-3 font-semibold"><button onClick={() => toggleSort('name')} className="flex w-full items-center justify-between gap-2 text-left">Tên khách hàng <span className={arrowCls('name')}>{arrow('name')}</span></button></th>
                <th className="px-4 py-3 font-semibold"><button onClick={() => toggleSort('tier')} className="flex w-full items-center justify-between gap-2 text-left">Hạng <span className={arrowCls('tier')}>{arrow('tier')}</span></button></th>
                <th className="px-4 py-3 font-semibold"><button onClick={() => toggleSort('assignee')} className="flex w-full items-center justify-between gap-2 text-left">Kinh doanh quản lý <span className={arrowCls('assignee')}>{arrow('assignee')}</span></button></th>
                <th className="px-4 py-3 font-semibold"><button onClick={() => toggleSort('province')} className="flex w-full items-center justify-between gap-2 text-left">Tỉnh/TP <span className={arrowCls('province')}>{arrow('province')}</span></button></th>
              </tr>
              <tr className="bg-[#f8fafc] text-xs font-normal text-slate-600">
                <th colSpan={4} className="px-4 py-2 font-normal">{province ? `Đang hiển thị ${filtered.length} khách ở 1 Tỉnh/thành phố` : `Đang hiển thị ${filtered.length} khách ở ${provinces.length} Tỉnh/thành phố`}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-slate-200 transition last:border-0 hover:bg-slate-100"
                  onClick={() => setEditId(r.id)}>
                  <td className="px-4 py-3 font-medium text-[#0f2a4a]">{r.ten_kh}</td>
                  <td className="px-4 py-3"><span className={`inline-block min-w-7 rounded px-1.5 py-0.5 text-center text-xs font-bold text-white ${tierColor(r.tier?.code)}`}>{r.tier?.code || '—'}</span></td>
                  <td className="px-4 py-3">{r.assigned?.full_name ?? ''}</td>
                  <td className="px-4 py-3">{r.tinh_thanh || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-600">Chưa có khách hàng nào. Bấm “Thêm khách hàng” hoặc “Import Excel”.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Thẻ mobile */}
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map((r) => (
            <button key={r.id} onClick={() => setEditId(r.id)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-[#0f2a4a]">{r.ten_kh}</span>
                <span className="shrink-0 text-sm text-slate-600">{r.tinh_thanh || '—'}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <span className={`inline-block min-w-7 rounded px-1.5 py-0.5 text-center text-xs font-bold text-white ${tierColor(r.tier?.code)}`}>{r.tier?.code || '—'}</span>
                <span>{r.assigned?.full_name ?? ''}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="py-10 text-center text-slate-600">Chưa có khách hàng.</div>}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() {
  return <RequireAuth><Screen /></RequireAuth>;
}
