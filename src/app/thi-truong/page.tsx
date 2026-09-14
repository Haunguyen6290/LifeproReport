'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AddNewsDialog } from '@/components/AddNewsDialog';
import { MarketNewsDetail } from '@/components/MarketNewsDetail';
import { Dialog } from '@/components/Dialog';
import { Selectable } from '@/components/Selectable';
import { fmtDateVN } from '@/lib/time';

type Tin = {
  id: string; ngay: string; content: string; source: string; suggested_action: string; status: string;
  importance?: { name: string } | null; type?: { name: string } | null; reporter?: { full_name: string } | null;
};

function Badge({ s }: { s: string }) {
  const cls: Record<string, string> = { MOI: 'bg-blue-50 text-blue-700', THAOLUAN: 'bg-amber-50 text-amber-700', KETLUAN: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls[s] ?? 'bg-slate-100'}`}>{s === 'MOI' ? 'Mới' : s === 'THAOLUAN' ? 'Đang thảo luận' : 'Đã kết luận'}</span>;
}

function Screen() {
  const { userId } = useAuth();
  const [list, setList] = useState<Tin[]>([]);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('market_news')
      .select('id, ngay, content, source, suggested_action, status, importance:category_items!market_news_importance_id_fkey(name), type:category_items!market_news_type_id_fkey(name), reporter:profiles!market_news_reporter_id_fkey(full_name)')
      .order('created_at', { ascending: false });
    setList((data ?? []) as unknown as Tin[]);
  }

  useEffect(() => { load(); }, []);

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition';
  const leftBorder: Record<string, string> = { MOI: 'border-l-4 border-l-[#0d6efd]', THAOLUAN: 'border-l-4 border-l-amber-400', KETLUAN: 'border-l-4 border-l-slate-300' };

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Báo cáo Tổng hợp KD</h1>
          <button onClick={() => setOpen(true)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-hover)]">+ Ghi tin mới</button>
        </div>
        <AddNewsDialog open={open} onClose={() => setOpen(false)} onDone={load} />
        {detailId && <Dialog open={!!detailId} onClose={() => setDetailId(null)} title="Chi tiết tin" size="wide" quickClose><MarketNewsDetail id={detailId} /></Dialog>}
        {list.length === 0 ? <p className="py-10 text-center text-slate-600">Chưa có tin nào.</p> : (
          <ul className="space-y-3">
            {list.map((t) => (
              <li key={t.id}>
                <Selectable as="button" onOpen={() => setDetailId(t.id)} className={`${card} ${leftBorder[t.status] ?? ''} block w-full text-left`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><span className="text-sm font-semibold text-[#1e3a8a]">{t.type?.name ?? '—'}</span><Badge s={t.status} /></div>
                    <span className="text-xs text-slate-600">{fmtDateVN(t.ngay)} · {t.reporter?.full_name ?? ''}</span>
                  </div>
                  {t.importance?.name && <p className="mt-1 text-xs font-semibold text-red-600">{t.importance.name}</p>}
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{t.content}</p>
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
