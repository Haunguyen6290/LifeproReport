'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { rankQA, type QA } from '@/lib/chatbot/search';
import { loadBotConfig } from '@/lib/troly-config';

const BO_NAO_CHUNG = 'Bộ não chung công ty';

type QaDraft = { phan_he: string; nhom_chu_de: string; cau_hoi: string; tra_loi_chuan: string; vi_du: string; cau_hoi_tiep_theo: string; hanh_dong: string };
const blank: QaDraft = { phan_he: BO_NAO_CHUNG, nhom_chu_de: '', cau_hoi: '', tra_loi_chuan: '', vi_du: '', cau_hoi_tiep_theo: '', hanh_dong: '' };

function uid(): string {
  // ngắn gọn, đủ duy nhất cho chatbot_qa (mã ông vẫn dùng: QAxxx)
  return 'QA' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString(36).slice(-5).toUpperCase();
}

function Screen() {
  const { can } = useAuth();
  const canWrite = can('quan_ly_cai_dat');
  const [filter, setFilter] = useState('Tất cả');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<QA | null>(null);
  const [phanHeDs, setPhanHeDs] = useState<string[]>([]);

  // CRUD
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QaDraft>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from('chatbot_qa').select('*').order('id');
    setRows((data ?? []) as QA[]);
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  // Danh sách phân hệ lấy từ Danh mục "Phân hệ trợ lý"; chưa có thì tạm dùng các phân hệ đã có câu hỏi
  useEffect(() => {
    loadBotConfig().then((c) => setPhanHeDs(c.phanHe.map((p) => p.name)));
  }, []);
  const FILTERS = useMemo(() => {
    const ds = phanHeDs.length ? phanHeDs : [...new Set(rows.map((r) => r.phan_he).filter(Boolean))];
    return ['Tất cả', ...ds];
  }, [phanHeDs, rows]);
  // Nếu danh mục đổi (xóa phân hệ đang lọc) → quay về Tất cả
  useEffect(() => {
    if (filter !== 'Tất cả' && !FILTERS.includes(filter)) setFilter('Tất cả');
  }, [FILTERS, filter]);

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

  function startAdd() {
    setEditingId(null);
    setDraft({ ...blank, phan_he: filter !== 'Tất cả' ? filter : BO_NAO_CHUNG });
    setFormMsg('');
    setFormOpen(true);
  }
  function startEdit(qa: QA) {
    setEditingId(qa.id);
    setDraft({ phan_he: qa.phan_he, nhom_chu_de: qa.nhom_chu_de, cau_hoi: qa.cau_hoi, tra_loi_chuan: qa.tra_loi_chuan, vi_du: qa.vi_du ?? '', cau_hoi_tiep_theo: (qa as any).cau_hoi_tiep_theo ?? '', hanh_dong: (qa as any).hanh_dong ?? '' });
    setFormMsg('');
    setFormOpen(true);
  }
  async function save() {
    const ph = draft.phan_he.trim();
    const nh = draft.nhom_chu_de.trim();
    const ch = draft.cau_hoi.trim();
    const tl = draft.tra_loi_chuan.trim();
    if (!ph || !nh || !ch || !tl) { setFormMsg('Phân hệ, nhóm, câu hỏi và trả lời chuẩn là bắt buộc.'); return; }
    setBusy(true);
    setFormMsg('');
    try {
      if (editingId) {
        const { error } = await supabase.from('chatbot_qa').update({
          phan_he: ph, nhom_chu_de: nh, cau_hoi: ch, tra_loi_chuan: tl,
          vi_du: draft.vi_du, cau_hoi_tiep_theo: draft.cau_hoi_tiep_theo, hanh_dong: draft.hanh_dong,
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const id = uid();
        const { error } = await supabase.from('chatbot_qa').insert({
          id, phan_he: ph, nhom_chu_de: nh, cau_hoi: ch, tra_loi_chuan: tl,
          vi_du: draft.vi_du, cau_hoi_tiep_theo: draft.cau_hoi_tiep_theo, hanh_dong: draft.hanh_dong,
        } as any);
        if (error) throw error;
      }
      setFormOpen(false);
      setToast(editingId ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi mới.');
      await reload();
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) { setFormMsg(e?.message ?? 'Không lưu được'); }
    finally { setBusy(false); }
  }
  async function removeAsk(qa: QA) {
    if (!confirm(`Xóa câu hỏi "${qa.cau_hoi}" (${qa.id})?`)) return;
    const { error } = await supabase.from('chatbot_qa').delete().eq('id', qa.id);
    if (error) { alert(error.message); return; }
    setRows((prev) => prev.filter((r) => r.id !== qa.id));
    setOpen((v) => (v?.id === qa.id ? null : v));
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#0d6efd] focus:outline-none';

  return (
    <AppSidebar>
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Trợ lý công việc — Tra cứu &amp; Quản lý QA</h1>
              <p className="mt-1 text-sm text-slate-500">
                Chọn phân hệ bên trái, gõ từ khóa để lọc. <b>Nhóm</b> lấy từ trường <b>Nhóm chủ đề</b> — bot hiển thị theo nhóm {FILTERS.length - 1} phân hệ. Ong bấm vào câu hỏi để xem đầy đủ và {canWrite ? 'Sửa / Xóa' : 'chỉ xem'}.
              </p>
            </div>
            {canWrite && <button onClick={startAdd} className="rounded-lg bg-[#0d6efd] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#0b5ed7]">+ Thêm câu hỏi</button>}
          </div>

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

          {toast && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{toast}</div>}

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
                      <div key={qa.id} className="flex gap-1">
                        <button
                          onClick={() => setOpen(qa as QA)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#0d6efd]/40 hover:bg-slate-50/50"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{qa.phan_he} · {qa.nhom_chu_de} · {qa.id}</div>
                          <div className="mt-1 text-sm font-medium text-slate-800">{qa.cau_hoi}</div>
                          <div className="mt-1 line-clamp-2 text-[13px] text-slate-500">{qa.tra_loi_chuan}</div>
                        </button>
                        {canWrite && (
                          <div className="flex shrink-0 flex-col gap-1">
                            <button onClick={() => startEdit(qa as QA)} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Sửa</button>
                            <button onClick={() => removeAsk(qa as QA)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Xóa</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Xem đầy đủ */}
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
              {canWrite && <div className="flex gap-2 pt-2"><button onClick={() => { const v = open; setOpen(null); startEdit(v); }} className="rounded-lg bg-[#0d6efd] px-4 py-2 text-sm font-semibold text-white">Sửa câu này</button></div>}
            </div>
          )}
        </Dialog>

        {/* Thêm / Sửa */}
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? `Sửa ${editingId}` : 'Thêm câu hỏi'} size="wide">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">Phân hệ</label>
                <select value={draft.phan_he} onChange={(e) => setDraft((d) => ({ ...d, phan_he: e.target.value }))} className={inputCls}>
                  {FILTERS.filter((f) => f !== 'Tất cả').map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">Nhóm chủ đề</label>
                <input value={draft.nhom_chu_de} onChange={(e) => setDraft((d) => ({ ...d, nhom_chu_de: e.target.value }))} placeholder="VD: OKRs là gì / Nhóm Kế hoạch / Báo cáo vấn đề" className={inputCls} />
                <p className="mt-1 text-[11px] text-slate-400">Nhóm này hiện trong widget khi bấm vào ô chat — tối đa 8 câu/nhóm, tự xoay vòng.</p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">Câu hỏi</label>
              <input value={draft.cau_hoi} onChange={(e) => setDraft((d) => ({ ...d, cau_hoi: e.target.value }))} placeholder="VD: KR đạt chuẩn như thế nào?" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700">Trả lời chuẩn</label>
              <GrowArea value={draft.tra_loi_chuan} onChange={(e) => setDraft((d) => ({ ...d, tra_loi_chuan: e.target.value }))} rows={4} className={inputCls + ' min-h-[90px]'} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Ví dụ</label>
              <GrowArea value={draft.vi_du} onChange={(e) => setDraft((d) => ({ ...d, vi_du: e.target.value }))} rows={2} className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Câu hỏi tiếp theo (gợi ý)</label>
                <input value={draft.cau_hoi_tiep_theo} onChange={(e) => setDraft((d) => ({ ...d, cau_hoi_tiep_theo: e.target.value }))} placeholder="Tùy chọn" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Hành động</label>
                <input value={draft.hanh_dong} onChange={(e) => setDraft((d) => ({ ...d, hanh_dong: e.target.value }))} placeholder="Tùy chọn" className={inputCls} />
              </div>
            </div>
            {formMsg && <p className="text-sm font-medium text-red-600">{formMsg}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>
              <button onClick={save} disabled={busy} className="rounded-lg bg-[#0d6efd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b5ed7] disabled:opacity-60">{busy ? 'Đang lưu…' : (editingId ? 'Cập nhật' : 'Thêm')}</button>
            </div>
          </div>
        </Dialog>
    </AppSidebar>
  );
}

export default function TroLyPage() {
  return (
    <RequireAuth>
      <Screen />
    </RequireAuth>
  );
}

