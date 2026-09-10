'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './RequireAuth';
import { AttachmentInput } from './AttachmentInput';
import { Avatar } from './Avatar';
import { ImageLightbox } from './ImageLightbox';
import { uploadImage, imagesFromPaste } from '@/lib/upload-image';
import { notifyTelegram } from '@/lib/notify';
import { fmtCommentTimeVN } from '@/lib/time';

export type Comment = {
  id: string; author_id: string; content: string; created_at: string; edited_at: string | null;
  author?: { full_name: string; avatar_url?: string | null } | null;
  images?: { id: string; public_url: string }[];
};

export function CommentList({ targetType, targetId, initialComments }: { targetType: 'news' | 'campaign_update' | 'warehouse_report'; targetId: string; initialComments?: Comment[] }) {
  const { userId, fullName, can } = useAuth();
  const [items, setItems] = useState<Comment[]>(initialComments ?? []);
  const [content, setContent] = useState('');
  const [imgs, setImgs] = useState<{ storage_path: string; public_url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [lightboxSrcs, setLightboxSrcs] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  async function load() {
    let data: any[] | null = null;
    {
      const r = await supabase
        .from('comments')
        .select('id, author_id, content, created_at, edited_at, author:profiles!comments_author_id_fkey(full_name, avatar_url)')
        .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (r.error && String(r.error.message).includes('avatar_url')) {
        const r2 = await supabase
          .from('comments')
          .select('id, author_id, content, created_at, edited_at, author:profiles!comments_author_id_fkey(full_name)')
          .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
          .order('created_at', { ascending: true });
        data = (r2.data ?? []) as any[];
      } else {
        data = (r.data ?? []) as any[];
      }
    }
    const list = (data ?? []) as unknown as Comment[];
    if (list.length) {
      const ids = list.map((c) => c.id);
      const { data: atts } = await supabase.from('attachments').select('id, owner_id, public_url').eq('owner_type', 'comment').in('owner_id', ids);
      const map: Record<string, { id: string; public_url: string }[]> = {};
      for (const a of (atts ?? []) as { id: string; owner_id: string; public_url: string }[]) (map[a.owner_id] ||= []).push({ id: a.id, public_url: a.public_url });
      list.forEach((c) => (c.images = map[c.id] ?? []));
    }
    setItems(list);
  }

  useEffect(() => {
    // Chỉ fetch lại khi không có initialComments (trang cũ chưa tối ưu) hoặc targetId thay đổi
    if (!initialComments || items.length === 0) load();
    // eslint-disable-next-line
  }, [targetId]);

  async function onCommentPaste(e: React.ClipboardEvent) {
    const files = imagesFromPaste(e);
    if (files.length === 0) return;
    e.preventDefault();
    for (const f of files) {
      try { const up = await uploadImage(f); setImgs((prev) => [...prev, up]); } catch {}
    }
  }

  async function post() {
    if (!content.trim()) return;
    setBusy(true);
    const { data } = await supabase.from('comments').insert({ target_type: targetType, target_id: targetId, author_id: userId, content: content.trim() }).select('id').single();
    if (data) {
      for (const im of imgs) await supabase.from('attachments').insert({ owner_type: 'comment', owner_id: data.id, storage_path: im.storage_path, public_url: im.public_url, uploader_id: userId });
      let _nm = '';
      try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); _nm = (me2 as any)?.full_name ?? '';
        const actionMap: Record<string, string> = { news: 'Bình luận tin thị trường', campaign_update: 'Bình luận chiến dịch', warehouse_report: 'Bình luận báo cáo kho' };
        const entityMap: Record<string, string> = { news: 'news', campaign_update: 'campaign', warehouse_report: 'warehouse_report' };
        await supabase.from('audit_logs').insert({ actor_id: userId, action: actionMap[targetType] ?? 'Bình luận', entity_type: entityMap[targetType] ?? targetType, entity_id: targetId as any, details: { comment_id: data.id, full_name: _nm } });
      } catch {}
      notifyTelegram('TB_COMMENT_MOI', `[Bình luận] ${content.trim().slice(0, 300)}\nNgười gửi: ${_nm}`);
    }
    setContent(''); setImgs([]);
    setBusy(false);
    load();
  }

  async function del(c: Comment) {
    if (c.author_id !== userId && !can('ket_luan')) return;
    await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', c.id);
    load();
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 backdrop-blur sm:p-5">
      <h3 className="mb-3 text-sm font-bold text-[#1e3a8a]">Thảo luận ({items.length})</h3>
      {items.length === 0 ? <p className="mb-3 text-sm text-slate-600">Chưa có bình luận nào.</p> : (
        <ul className="mb-4 space-y-3">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
              <Avatar name={c.author?.full_name ?? '?'} src={c.author?.avatar_url ?? null} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{c.author?.full_name ?? ''}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{fmtCommentTimeVN(c.created_at)} {c.edited_at && '(đã sửa)'}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{c.content}</p>
                {c.images && c.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">{c.images.map((im) => <button key={im.id} type="button" onClick={() => { setLightboxSrcs(c.images!.map((x) => x.public_url)); setLightboxIdx(c.images!.findIndex((x) => x.id === im.id)); }}><img src={im.public_url} alt="ảnh" className="h-16 w-16 rounded object-cover ring-1 ring-slate-200 hover:opacity-90" /></button>)}</div>
                )}
                {(c.author_id === userId || can('ket_luan')) && <button onClick={() => del(c)} className="mt-1 text-xs text-[var(--color-destructive)] hover:underline">Xóa</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} onPaste={onCommentPaste} rows={2} placeholder="Viết bình luận… (Ctrl+V dán ảnh)" className="w-full rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]" />
      <div className="mt-2"><AttachmentInput value={imgs} onChange={setImgs} /></div>
      <div className="mt-2 flex justify-end">
        <button onClick={post} disabled={busy || !content.trim()} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button>
      </div>
      {lightboxIdx >= 0 && <ImageLightbox srcs={lightboxSrcs} index={lightboxIdx} onClose={() => setLightboxIdx(-1)} />}
    </section>
  );
}
