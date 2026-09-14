'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Avatar } from '@/components/Avatar';
import { notifyTelegram } from '@/lib/notify';
import { fmtCommentTimeVN } from '@/lib/time';

type Cmt = {
  id: string; author_id: string; content: string; is_chot: boolean; created_at: string;
  author?: { full_name: string; avatar_url?: string | null } | null;
};

/**
 * Luong "Gop y cua quan ly" + "Chot duyet" cho mot Bao cao tuan.
 * - Cong khai: ca cong ty doc duoc.
 * - Viet: chi tac gia bao cao + nguoi co quyen quan_ly_okr.
 * - Sau khi Chot (trang_thai_duyet = 'Đã duyệt'): khoa — chi doc. Quan ly co the "Mở lại".
 */
export function ReportReviewBox({
  reportId,
  authorId,
  trangThai,
  onDone,
}: {
  reportId: string;
  authorId: string;
  trangThai: string;
  onDone: () => void;
}) {
  const { userId, can } = useAuth();
  const canManage = can('quan_ly_okr');
  const isAuthor = authorId === userId;
  const canWrite = canManage || isAuthor;
  const locked = trangThai === 'Đã duyệt';

  const [items, setItems] = useState<Cmt[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('weekly_report_comments')
      .select('id, author_id, content, is_chot, created_at, author:profiles!weekly_report_comments_author_id_fkey(full_name, avatar_url)')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });
    setItems((data ?? []) as unknown as Cmt[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [reportId]);

  async function nameOfSelf(): Promise<string> {
    try { const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); return (data as any)?.full_name ?? ''; } catch { return ''; }
  }

  async function addComment(isChot: boolean) {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('weekly_report_comments').insert({
      report_id: reportId, author_id: userId, content: t, is_chot: isChot,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    if (isChot) {
      const { error: e2 } = await supabase.from('weekly_reports').update({ trang_thai_duyet: 'Đã duyệt', y_kien_quan_ly: t, duyet_boi: userId, duyet_luc: new Date().toISOString() }).eq('id', reportId);
      if (e2) { setErr(e2.message); setBusy(false); return; }
    }
    const nm = await nameOfSelf();
    notifyTelegram('TB_BAO_CAO_TUAN', isChot
      ? `[Báo cáo tuần] ĐÃ CHỐT DUYỆT bởi ${nm}\n${t.slice(0, 300)}`
      : `[Báo cáo tuần] Góp ý mới từ ${nm}\n${t.slice(0, 300)}`);
    setText('');
    setBusy(false);
    await load();
    onDone();
  }

  async function reopen() {
    if (busy) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('weekly_reports').update({ trang_thai_duyet: 'Chờ duyệt' }).eq('id', reportId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    await load();
    onDone();
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-700">
        Góp ý của quản lý {items.length > 0 && <span className="text-slate-400">({items.length})</span>}
        {locked && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Đã chốt duyệt</span>}
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-white px-3 py-3 text-center text-sm text-slate-500">Chưa có góp ý nào.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((c) => (
            <li key={c.id} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${c.is_chot ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-white'}`}>
              <Avatar name={c.author?.full_name ?? '?'} src={c.author?.avatar_url ?? null} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-[12px]">
                  <span className="font-semibold text-slate-900">{c.author?.full_name ?? ''}</span>
                  {c.is_chot && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Ý kiến chốt</span>}
                  <span className="text-slate-400">{fmtCommentTimeVN(c.created_at)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {err && <p className="mt-2 text-sm font-medium text-red-600">{err}</p>}

      {/* Soạn góp ý / chốt */}
      {locked ? (
        canManage ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Đã chốt — báo cáo và luồng góp ý đã khóa.</span>
            <button onClick={reopen} disabled={busy} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Mở lại</button>
          </div>
        ) : (
          <p className="mt-2 text-center text-xs text-slate-500">Báo cáo đã chốt duyệt — chỉ xem.</p>
        )
      ) : !canWrite ? (
        <p className="mt-2 text-center text-xs text-slate-500">Chỉ tác giả báo cáo và quản lý mới được góp ý. Ông đang xem.</p>
      ) : (
        <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(false); } }}
            placeholder={canManage ? 'Viết góp ý… (Enter = gửi, Shift+Enter = xuống dòng)' : 'Trao đổi với quản lý… (Enter = gửi)'}
            rows={2}
            className="min-h-[52px] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => addComment(false)} disabled={busy || !text.trim()} className="rounded-md border border-[#1e3a8a] bg-white px-3 py-1.5 text-sm font-semibold text-[#1e3a8a] hover:bg-slate-50 disabled:opacity-50">
              {busy ? '…' : 'Gửi góp ý'}
            </button>
            {canManage && (
              <button onClick={() => addComment(true)} disabled={busy || !text.trim()} title="Ghi ý kiến cuối và đóng báo cáo" className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy ? '…' : 'Chốt duyệt báo cáo'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
