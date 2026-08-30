'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Dialog } from '@/components/Dialog';
import { rankQA, type QA } from '@/lib/chatbot/search';

const FILTERS = [
  'Tất cả',
  'Bộ não chung công ty',
  'Trợ lý OKRs',
  'Trợ lý Kế hoạch',
  'Trợ lý Báo cáo tuần',
  'Trợ lý Check-in hàng tuần',
  'Trợ lý Báo cáo vấn đề',
  'Trợ lý Khách hàng',
  'Trợ lý Kinh doanh',
  'Trợ lý Kho',
  'Trợ lý Tổng hợp kho',
  'Trợ lý Bảo hành',
  'Trợ lý Kế toán',
  'Trợ lý Mua hàng',
  'Trợ lý Marketing & Thiết kế',
  'Trợ lý Phát triển sản phẩm',
  'Trợ lý Lái xe',
  'Trợ lý Chiến dịch',
  'Trợ lý Thị trường kinh doanh',
  'Trợ lý Bảng tin',
];

export default function TroLyPage() {
  const [filter, setFilter] = useState('Tất cả');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<QA | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from('chatbot_qa').select('*').order('id');
      if (!cancelled) {
        setRows((data ?? []) as QA[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounce q 300ms
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => {
    const base = filter === 'Tất cả' ? rows : rows.filter((r) => r.phan_he === filter);
    const t = debounced.trim();
    if (!t) return { matches: base.map((qa) => ({ qa, score: 1 })), suggestions: [] as string[] };
    const context = filter === 'Tất cả' ? null : filter;
    return rankQA(base as any, t, context, 50);
  }, [rows, debounced, filter]);

  return (
    <RequireAuth>
      <AppSidebar>
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <h1 className="text-xl font-bold tracking-tight">Trợ lý công việc — Tra cứu QA</h1>
          <p className="mt-1 text-sm text-slate-500">Chọn phân hệ bên trái, gõ từ khóa để lọc. Bấm vào câu hỏi để xem đầy đủ: trả lời chuẩn, ví dụ, hành động, câu hỏi tiếp theo.</p>

          {/* Search */}
          <div className="mt-4 flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo từ khóa…"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-[#0d6efd] focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ('')} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50">Xóa</button>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-6 md:flex-row">
            {/* Filter trái: 240px desktop, scroll ngang mobile */}
            <div className="md:w-60 md:shrink-0">
              <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-left text-[13px] font-medium ${filter === f ? 'bg-[#0d6efd] text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Kết quả */}
            <div className="flex-1">
              {loading ? (
                <div className="text-sm text-slate-400">Đang tải…</div>
              ) : (
                <>
                  <div className="mb-2 text-[12px] text-slate-400">
                    {results.matches.length ? `${results.matches.length} kết quả` : 'Không có kết quả phù hợp'}
                  </div>
                  {results.matches.length === 0 && (results as any).suggestions?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {(results as any).suggestions.map((s: string) => (
                        <button key={s} onClick={() => setQ(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50">
                          Gợi ý: {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {results.matches.map(({ qa }) => (
                      <button
                        key={qa.id}
                        onClick={() => setOpen(qa as QA)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#0d6efd]/40 hover:bg-slate-50/50"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{qa.phan_he} · {qa.nhom_chu_de} · {qa.id}</div>
                        <div className="mt-1 text-sm font-medium text-slate-800">{qa.cau_hoi}</div>
                        <div className="mt-1 line-clamp-2 text-[13px] text-slate-500">{qa.tra_loi_chuan}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${open.phan_he} — ${open.id}` : ''} size="wide">
          {open && (
            <div className="space-y-4 text-sm leading-relaxed">
              <h3 className="text-base font-semibold">{open.cau_hoi}</h3>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Trả lời chuẩn</div>
                <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2">{open.tra_loi_chuan}</p>
              </div>
              {open.vi_du && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ví dụ</div>
                  <p className="mt-1 rounded-lg border-l-2 border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">{open.vi_du}</p>
                </div>
              )}
              {open.cau_hoi_tiep_theo && <p><span className="font-semibold">Câu hỏi tiếp theo: </span>{open.cau_hoi_tiep_theo}</p>}
              {open.hanh_dong && <p><span className="font-semibold">Hành động: </span>{open.hanh_dong}</p>}
              <div className="flex flex-wrap gap-1.5 pt-2 text-[12px] text-slate-500">
                {open.phan_he_lien_quan?.length > 0 && <span>Liên quan: {(open.phan_he_lien_quan as string[]).join(', ')}</span>}
              </div>
              <div className="text-[11px] text-slate-300">{open.id} · {open.muc_do} · {open.uu_tien}</div>
            </div>
          )}
        </Dialog>
      </AppSidebar>
    </RequireAuth>
  );
}
