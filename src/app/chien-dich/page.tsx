'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AddCampaignDialog } from '@/components/AddCampaignDialog';
import { CampaignDetail } from '@/components/CampaignDetail';
import { Dialog } from '@/components/Dialog';
import { Selectable } from '@/components/Selectable';
import { fmtDateVN } from '@/lib/time';

type CD = { id: string; name: string; objective: string; start_date: string; end_date: string; type?: { name: string } | null; status?: { name: string } | null; unread?: number };

function Screen() {
  const { can, userId } = useAuth();
  const [list, setList] = useState<CD[]>([]);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('campaigns').select('id, name, objective, start_date, end_date, type:category_items!campaigns_type_id_fkey(name), status:category_items!campaigns_status_id_fkey(name)').order('created_at', { ascending: false });
    const campaigns = (data ?? []) as unknown as CD[];

    // Lấy session để gọi API đếm tin chưa đọc
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && campaigns.length > 0) {
      try {
        const res = await fetch('/api/campaign/unread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ campaign_ids: campaigns.map(c => c.id) }),
        });
        const unreadData = await res.json() as Record<string, number>;
        for (const c of campaigns) {
          c.unread = unreadData[c.id] ?? 0;
        }
      } catch {}
    }

    setList(campaigns);
  }
  useEffect(() => { load(); }, []);

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition';
  const leftBorder: Record<string, string> = { 'Chuẩn bị': 'border-l-4 border-l-slate-300', 'Đang chạy': 'border-l-4 border-l-[#0d6efd]', 'Đã kết thúc': 'border-l-4 border-l-emerald-400' };

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Chiến dịch</h1>
          {can('quan_ly_chien_dich') && <button onClick={() => setOpen(true)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-hover)]">+ Tạo chiến dịch</button>}
        </div>
        <AddCampaignDialog open={open} onClose={() => setOpen(false)} onDone={load} />
        {detailId && <Dialog open={!!detailId} onClose={() => setDetailId(null)} title="Chi tiết chiến dịch" size="wide"><CampaignDetail id={detailId} onClose={() => setDetailId(null)} /></Dialog>}
        {list.length === 0 ? <p className="py-10 text-center text-slate-600">Chưa có chiến dịch nào.</p> : (
          <ul className="space-y-3">
            {list.map((c) => (
              <li key={c.id}>
                <Selectable as="button" onOpen={() => setDetailId(c.id)} className={`${card} ${leftBorder[c.status?.name ?? ''] ?? ''} block w-full text-left`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{c.name}</span>
                      {c.unread !== undefined && c.unread > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                          {c.unread} tin chưa đọc
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{c.status?.name ?? '—'}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{c.type?.name ?? '—'} · {c.start_date ? fmtDateVN(c.start_date) : '—'} → {c.end_date ? fmtDateVN(c.end_date) : '—'}</div>
                  {c.objective && <p className="mt-1 line-clamp-1 text-sm text-slate-600">🎯 {c.objective}</p>}
                </Selectable>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
