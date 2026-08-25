'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';
import { Avatar } from '@/components/Avatar';
import { fmtDateTimeVN } from '@/lib/time';

type Log = { id: string; actor_id: string; action: string; entity_type: string; details: any; created_at: string; actor?: { full_name: string; avatar_url?: string | null } | null };

function Screen() {
  const { can } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 50;

  function displayName(l: Log) {
    // Snapshot lưu lúc ghi log để dù đổi tên sau vẫn hiện đúng tên lúc đó
    const snap = (l.details as any)?.full_name ?? (l.details as any)?.actor_name ?? null;
    return (l.actor?.full_name ?? snap ?? '') as string;
  }

  async function fetchPage(p: number, reset: boolean) {
    setLoading(true);
    const fromRow = p * PAGE_SIZE;
    const toRow = fromRow + PAGE_SIZE - 1;
    async function doFetch(withAvatar: boolean) {
      let q = supabase.from('audit_logs').select(withAvatar ? 'id, actor_id, action, entity_type, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, avatar_url)' : 'id, actor_id, action, entity_type, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)').order('created_at', { ascending: false }).range(fromRow, toRow);
      if (action.trim()) q = q.ilike('action', `%${action.trim()}%`);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to + 'T23:59:59');
      return q;
    }
    let { data, error } = await doFetch(true);
    if (error && String(error.message).includes('avatar_url')) {
      const r2 = await doFetch(false);
      data = r2.data as any; error = r2.error as any;
    }
    if (error) { setLoading(false); if (reset) setLogs([]); return; }
    let list = (data ?? []) as unknown as Log[];
    // Lọc người theo snapshot + tên hiện tại (server không filter được join)
    if (actor.trim()) {
      const q = actor.trim().toLowerCase();
      list = list.filter((l) => displayName(l).toLowerCase().includes(q));
    }
    if (reset) setLogs(list);
    else setLogs((prev) => [...prev, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
  }

  async function load() {
    setPage(0);
    await fetchPage(0, true);
  }

  async function loadMore() {
    const np = page + 1;
    setPage(np);
    await fetchPage(np, false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (!can('xem_log')) return <AppSidebar><main className="px-6 py-10 text-slate-700">Bạn không có quyền xem nhật ký.</main></AppSidebar>;
  const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 backdrop-blur';

  return (
    <AppSidebar>

      <main className="w-full px-4 py-6 sm:px-6 text-slate-900">
        <AdminTabs />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Nhật ký thao tác</h1>
        <div className={`${card} mb-4 flex flex-wrap gap-2`}>
          <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Người…" className={`${sel} min-w-[140px]`} />
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Hành động…" className={`${sel} min-w-[160px]`} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} aria-label="Từ ngày" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} aria-label="Đến ngày" />
          <button onClick={load} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Lọc</button>
        </div>
        <div className={card}>
          {logs.length === 0 ? <p className="py-6 text-center text-sm text-slate-600">Không có bản ghi nào.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs font-semibold text-slate-700"><th className="py-1">Thời gian</th><th className="py-1">Người</th><th className="py-1">Module</th><th className="py-1">Hành động</th><th className="py-1">Chi tiết</th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-200 align-top">
                  <td className="py-1 font-mono text-xs">{fmtDateTimeVN(l.created_at)}</td>
                  <td className="py-1"><span className="inline-flex items-center gap-2"><Avatar name={displayName(l) || '?'} src={l.actor?.avatar_url ?? null} size={24} /><span>{displayName(l)}</span></span></td>
                  <td className="py-1 text-xs">{l.entity_type}</td>
                  <td className="py-1">{l.action}</td>
                  <td className="py-1 text-xs text-slate-700">{l.details ? JSON.stringify(l.details).slice(0, 200) : ''}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {hasMore && logs.length > 0 && (
            <div className="mt-3 flex justify-center"><button onClick={loadMore} disabled={loading} className="rounded-md border border-slate-200 px-4 py-2 text-sm disabled:opacity-60">{loading ? 'Đang tải…' : 'Tải thêm'}</button></div>
          )}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
