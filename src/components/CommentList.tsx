'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './RequireAuth';
import { AttachmentInput } from './AttachmentInput';
import { MentionInput } from './MentionInput';
import { Avatar } from './Avatar';
import { ImageLightbox } from './ImageLightbox';
import { uploadImage, imagesFromPaste } from '@/lib/upload-image';
import { notifyTelegram } from '@/lib/notify';
import { fmtCommentTimeVN } from '@/lib/time';
import { renderContent, type MentionProfile } from './MentionContent';

export type Comment = {
  id: string; author_id: string; content: string; created_at: string; edited_at: string | null;
  parent_id?: string | null;
  author?: { full_name: string; avatar_url?: string | null } | null;
  images?: { id: string; public_url: string }[];
};

export function CommentList({ targetType, targetId, initialComments }: { targetType: 'news' | 'campaign_update' | 'warehouse_report' | 'warehouse_report_update'; targetId: string; initialComments?: Comment[] }) {
  const { userId, can } = useAuth();
  const [items, setItems] = useState<Comment[]>(initialComments ?? []);
  const [profiles, setProfiles] = useState<MentionProfile[]>([]);
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [imgs, setImgs] = useState<{ storage_path: string; public_url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [lightboxSrcs, setLightboxSrcs] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(-1);
  // reply state
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const [replyBusy, setReplyBusy] = useState(false);
  const [visibleTop, setVisibleTop] = useState(10);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  async function load() {
    // Gộp cột parent_id, fallback nếu migration chưa chạy
    let data: any[] | null = null;
    {
      const r = await supabase
        .from('comments')
        .select('id, author_id, content, created_at, edited_at, parent_id, author:profiles!comments_author_id_fkey(full_name, avatar_url)')
        .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (r.error && String(r.error.message).includes('parent_id')) {
        const r2 = await supabase
          .from('comments')
          .select('id, author_id, content, created_at, edited_at, author:profiles!comments_author_id_fkey(full_name, avatar_url)')
          .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
          .order('created_at', { ascending: true });
        if (r2.error && String(r2.error.message).includes('avatar_url')) {
          const r3 = await supabase
            .from('comments')
            .select('id, author_id, content, created_at, edited_at, author:profiles!comments_author_id_fkey(full_name)')
            .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
            .order('created_at', { ascending: true });
          data = (r3.data ?? []) as any[];
        } else {
          data = (r2.data ?? []) as any[];
        }
      } else if (r.error && String(r.error.message).includes('avatar_url')) {
        const r2 = await supabase
          .from('comments')
          .select('id, author_id, content, created_at, edited_at, parent_id, author:profiles!comments_author_id_fkey(full_name)')
          .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
          .order('created_at', { ascending: true });
        if (r2.error && String(r2.error.message).includes('parent_id')) {
          const r3 = await supabase
            .from('comments')
            .select('id, author_id, content, created_at, edited_at, author:profiles!comments_author_id_fkey(full_name)')
            .eq('target_type', targetType).eq('target_id', targetId).is('deleted_at', null)
            .order('created_at', { ascending: true });
          data = (r3.data ?? []) as any[];
        } else {
          data = (r2.data ?? []) as any[];
        }
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
    if (!initialComments || items.length === 0) load();
    // eslint-disable-next-line
  }, [targetId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('status', 'ACTIVE');
        setProfiles((data ?? []) as any);
      } catch {}
    })();
  }, []);

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
    const { data, error } = await supabase.from('comments').insert({ target_type: targetType, target_id: targetId, author_id: userId, content: content.trim(), parent_id: null } as any).select('id').single();
    // fallback nếu cột parent_id chưa có
    let insertedId = data?.id ?? null;
    if (error && String(error.message).includes('parent_id')) {
      const r2 = await supabase.from('comments').insert({ target_type: targetType, target_id: targetId, author_id: userId, content: content.trim() } as any).select('id').single();
      insertedId = (r2.data as any)?.id ?? null;
    }
    if (insertedId) {
      for (const im of imgs) await supabase.from('attachments').insert({ owner_type: 'comment', owner_id: insertedId, storage_path: im.storage_path, public_url: im.public_url, uploader_id: userId });
      let _nm = '';
      try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); _nm = (me2 as any)?.full_name ?? '';
        const actionMap: Record<string, string> = { news: 'Bình luận tin thị trường', campaign_update: 'Bình luận chiến dịch', warehouse_report: 'Bình luận báo cáo kho', warehouse_report_update: 'Bình luận cập nhật kho' };
        const entityMap: Record<string, string> = { news: 'news', campaign_update: 'campaign', warehouse_report: 'warehouse_report', warehouse_report_update: 'warehouse_report' };
        await supabase.from('audit_logs').insert({ actor_id: userId, action: actionMap[targetType] ?? 'Bình luận', entity_type: entityMap[targetType] ?? targetType, entity_id: targetId as any, details: { comment_id: insertedId, full_name: _nm } });
      } catch {}
      notifyTelegram('TB_COMMENT_MOI', `[Bình luận] ${content.trim().slice(0, 300)}\nNgười gửi: ${_nm}`);
    }
    setContent(''); setMentions([]); setImgs([]);
    setBusy(false);
    load();
  }

  async function postReply(parentId: string) {
    const t = replyText.trim();
    if (!t) return;
    setReplyBusy(true);
    const payload: any = { target_type: targetType, target_id: targetId, author_id: userId, content: t, parent_id: parentId };
    let { data, error } = await supabase.from('comments').insert(payload).select('id').single();
    if (error && String(error.message).includes('parent_id')) {
      const r2 = await supabase.from('comments').insert({ target_type: targetType, target_id: targetId, author_id: userId, content: t } as any).select('id').single();
      data = r2.data as any;
      error = r2.error as any;
    }
    if (data) {
      try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); const _nm = (me2 as any)?.full_name ?? '';
        await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Trả lời bình luận', entity_type: targetType, entity_id: targetId as any, details: { comment_id: (data as any).id, parent_id: parentId, full_name: _nm } });
        const parent = items.find((x) => x.id === parentId);
        notifyTelegram('TB_COMMENT_MOI', `[Trả lời] ${t.slice(0, 300)} → ${parent?.author?.full_name ?? ''}\nNgười gửi: ${_nm}`);
      } catch {}
    }
    setReplyText(''); setReplyMentions([]); setReplyTo(null);
    setReplyBusy(false);
    load();
  }

  async function del(c: Comment) {
    if (c.author_id !== userId && !can('ket_luan')) return;
    await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', c.id);
    load();
  }

  const topLevel = useMemo(() => items.filter((c) => !c.parent_id).sort((a, b) => a.created_at.localeCompare(b.created_at)), [items]);
  const repliesOf = (pid: string) => items.filter((c) => c.parent_id === pid).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const visible = topLevel.slice(0, visibleTop);

  function CommentRow({ c, depth }: { c: Comment; depth: number }) {
    const replies = depth === 0 ? repliesOf(c.id) : [];
    const showAll = expandedParents.has(c.id);
    const shown = showAll ? replies : replies.slice(0, 2);
    const hiddenCount = replies.length - shown.length;
    return (
      <div className={depth > 0 ? 'ml-8 border-l-2 border-slate-100 pl-3' : ''}>
        <div className="flex gap-2.5">
          <Avatar name={c.author?.full_name ?? '?'} src={c.author?.avatar_url ?? null} size={depth > 0 ? 28 : 32} />
          <div className="min-w-0 flex-1">
            <div className="inline-block rounded-2xl bg-slate-100 px-3 py-1.5">
              <div className="text-[13px] font-semibold leading-tight text-slate-900">{c.author?.full_name ?? ''}</div>
              <p className="whitespace-pre-wrap text-[13px] leading-[1.45] text-slate-900">{renderContent(c.content, profiles)}</p>
            </div>
            {c.images && c.images.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">{c.images.map((im) => <button key={im.id} type="button" onClick={() => { setLightboxSrcs(c.images!.map((x) => x.public_url)); setLightboxIdx(c.images!.findIndex((x) => x.id === im.id)); }}><img src={im.public_url} alt="ảnh" className="h-14 w-14 rounded object-cover ring-1 ring-slate-200 hover:opacity-90" /></button>)}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 px-1 text-xs text-slate-500">
              <span>{fmtCommentTimeVN(c.created_at)}{c.edited_at && ' (đã sửa)'}</span>
              <button onClick={() => { setReplyTo(c.id); setReplyText(c.author?.full_name ? `@${c.author.full_name} ` : ''); }} className="font-semibold text-[#1e3a8a] hover:underline">Trả lời</button>
              {(c.author_id === userId || can('ket_luan')) && <button onClick={() => del(c)} className="text-[var(--color-destructive)] hover:underline">Xóa</button>}
            </div>
            {replyTo === c.id && (
              <div className="mt-2 flex items-start gap-2">
                <Avatar name="Tôi" src={null} size={28} />
                <div className="min-w-0 flex-1">
                  <MentionInput autoFocus value={replyText} onChange={(v, m) => { setReplyText(v); setReplyMentions(m); }} placeholder={`Trả lời ${c.author?.full_name ?? ''}…`} rows={1} />
                  <div className="mt-1 flex justify-end gap-2">
                    <button onClick={() => { setReplyTo(null); setReplyText(''); setReplyMentions([]); }} className="rounded px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">Hủy</button>
                    <button disabled={replyBusy || !replyText.trim()} onClick={() => postReply(c.id)} className="rounded bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{replyBusy ? '…' : 'Gửi'}</button>
                  </div>
                </div>
              </div>
            )}
            {replies.length > 0 && (
              <div className="mt-2 space-y-2">
                {shown.map((r) => <CommentRow key={r.id} c={r} depth={1} />)}
                {hiddenCount > 0 && <button onClick={() => setExpandedParents((s) => new Set([...s, c.id]))} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Xem thêm {hiddenCount} trả lời</button>}
                {!showAll && replies.length > 2 && hiddenCount === 0 && null}
                {showAll && replies.length > 2 && <button onClick={() => setExpandedParents((s) => { const n = new Set(s); n.delete(c.id); return n; })} className="text-xs text-slate-500 hover:underline">Thu gọn</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 backdrop-blur sm:p-4">
      <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">Thảo luận ({items.length})</h3>
      {items.length === 0 ? <p className="mb-2 text-sm text-slate-600">Chưa có bình luận nào.</p> : (
        <div className="mb-3 space-y-3">
          {visible.map((c) => <CommentRow key={c.id} c={c} depth={0} />)}
          {topLevel.length > visibleTop && <button onClick={() => setVisibleTop((v) => v + 10)} className="text-sm font-semibold text-[#1e3a8a] hover:underline">Xem thêm {topLevel.length - visibleTop} bình luận</button>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} onPaste={onCommentPaste} rows={2} placeholder="Viết bình luận… (Ctrl+V dán ảnh) — gõ @Tên để tag" className="flex-1 min-w-0 resize-y rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]" />
        <AttachmentInput value={imgs} onChange={setImgs} perRow={3} />
      </div>
      <div className="mt-2 flex justify-end">
        <button onClick={post} disabled={busy || !content.trim()} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button>
      </div>
      {lightboxIdx >= 0 && <ImageLightbox srcs={lightboxSrcs} index={lightboxIdx} onClose={() => setLightboxIdx(-1)} />}
    </section>
  );
}
