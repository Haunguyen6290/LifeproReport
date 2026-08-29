'use client';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Avatar } from '@/components/Avatar';
import { Dialog } from '@/components/Dialog';
import { MentionInput } from '@/components/MentionInput';
import { fmtCommentTimeVN } from '@/lib/time';
import { renderContent, type MentionProfile } from '@/components/MentionContent';

type Post = { id: string; author_id: string; title: string; content: string; is_bot: boolean; created_at: string; author?: { full_name: string; avatar_url?: string | null } | null };
type Reaction = { user_id: string; kind: 'like' | 'love' | 'haha' | 'angry' };
type Cmt = { id: string; author_id: string; content: string; created_at: string; parent_id: string | null; author?: { full_name: string; avatar_url?: string | null } | null };

const REACTIONS: { kind: Reaction['kind']; emoji: string; label: string }[] = [
  { kind: 'like', emoji: '👍', label: 'Thích' },
  { kind: 'love', emoji: '❤️', label: 'Yêu thích' },
  { kind: 'haha', emoji: '😆', label: 'Haha' },
  { kind: 'angry', emoji: '😠', label: 'Phẫn nộ' },
];

function PostImages({ imgs }: { imgs: { public_url: string }[] }) {
  if (imgs.length === 0) return null;
  if (imgs.length === 1) return <img src={imgs[0].public_url} alt="" className="mt-3 max-h-[520px] w-full rounded-lg object-cover" />;
  if (imgs.length === 2) return <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg">{imgs.slice(0, 2).map((im, i) => <img key={i} src={im.public_url} alt="" className="h-[280px] w-full object-cover" />)}</div>;
  return <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">{imgs.slice(0, 6).map((im, i) => <img key={i} src={im.public_url} alt="" className="h-[160px] w-full object-cover" />)}</div>;
}

/** Một bình luận (gốc hoặc trả lời) + ô trả lời inline. */
function CommentItem({ c, depth, onReply, autoFocus, profiles }: { c: Cmt; depth: number; onReply: (parentId: string, text: string, mentions: string[]) => Promise<void>; autoFocus?: boolean; profiles?: MentionProfile[] }) {
  const [replying, setReplying] = useState(false);
  const [txt, setTxt] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className={depth > 0 ? 'ml-10' : ''}>
      <div className="flex items-start gap-2">
        <Avatar name={c.author?.full_name ?? '?'} src={c.author?.avatar_url ?? null} size={32} viewable />
        <div className="min-w-0 flex-1">
          <div className="inline-block rounded-2xl bg-slate-100 px-3 py-2">
            <div className="text-[13px] font-semibold text-slate-900">{c.author?.full_name ?? ''}</div>
            <p className="whitespace-pre-wrap text-[14px] text-slate-900">{renderContent(c.content, profiles)}</p>
          </div>
          <div className="mt-0.5 flex items-center gap-3 px-2 text-xs text-slate-500">
            <span>{fmtCommentTimeVN(c.created_at)}</span>
            <button onClick={() => setReplying((r) => !r)} className="font-semibold text-[#1e3a8a] hover:underline">Trả lời</button>
          </div>
          {replying && (
            <div className="mt-1">
              <MentionInput autoFocus={autoFocus} value={txt} onChange={(v, m) => { setTxt(v); setMentions(m); }} placeholder="Viết trả lời…" rows={1} />
              <div className="mt-1 flex justify-end gap-2">
                <button onClick={() => { setReplying(false); setTxt(''); }} className="text-xs text-slate-500 hover:underline">Hủy</button>
                <button disabled={busy || !txt.trim()} onClick={async () => { setBusy(true); await onReply(c.id, txt.trim(), mentions); setTxt(''); setMentions([]); setReplying(false); setBusy(false); }} className="rounded bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{busy ? '…' : 'Gửi'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BulletinPostCard({ post, imgs, reactions, comments, userId, onChanged, canDelete, onDelete, canEdit, onEdit, profiles }: {
  post: Post; imgs: { public_url: string }[]; reactions: Reaction[]; comments: Cmt[]; userId: string; onChanged: (silent?: boolean) => void; canDelete?: boolean; onDelete?: () => void; canEdit?: boolean; onEdit?: () => void; profiles?: MentionProfile[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleTop, setVisibleTop] = useState(5);
  const [fullOpen, setFullOpen] = useState(false);
  const [newCmt, setNewCmt] = useState('');
  const [newMentions, setNewMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [focusCommentInput, setFocusCommentInput] = useState<'none' | 'new'>('none');

  const mine = reactions.find((r) => r.user_id === userId);
  const counts = useMemo(() => {
    const c: Record<string, number> = { like: 0, love: 0, haha: 0, angry: 0 };
    reactions.forEach((r) => { c[r.kind] = (c[r.kind] ?? 0) + 1; });
    return c;
  }, [reactions]);
  const totalReactions = reactions.length;

  const topLevel = useMemo(() => comments.filter((c) => !c.parent_id).sort((a, b) => a.created_at.localeCompare(b.created_at)), [comments]);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function react(kind: Reaction['kind']) {
    if (mine && mine.kind === kind) {
      await supabase.from('bulletin_reactions').delete().eq('post_id', post.id).eq('user_id', userId);
    } else if (mine) {
      await supabase.from('bulletin_reactions').update({ kind }).eq('post_id', post.id).eq('user_id', userId);
    } else {
      await supabase.from('bulletin_reactions').insert({ post_id: post.id, user_id: userId, kind });
    }
    setPickerOpen(false);
    onChanged();
  }

  async function addComment(parentId: string | null, text: string, mentions: string[]) {
    if (!text.trim()) return;
    setBusy(true);
    await supabase.from('bulletin_comments').insert({ post_id: post.id, author_id: userId, content: text.trim(), parent_id: parentId, mentioned_user_ids: mentions });
    setBusy(false);
    onChanged();
  }

  const reactionSummary = REACTIONS.filter((r) => (counts[r.kind] ?? 0) > 0).map((r) => `${r.emoji}${counts[r.kind]}`);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <Avatar name={post.author?.full_name ?? '?'} src={post.author?.avatar_url ?? null} size={40} viewable />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{post.author?.full_name ?? ''}</span>
            {post.is_bot && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">BOT 8h30 T2</span>}
          </div>
          <span className="text-xs text-slate-500">{fmtCommentTimeVN(post.created_at)}</span>
        </div>
        {(canEdit && onEdit) && (
          <button onClick={onEdit} title="Sửa bài" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-[#eff6ff] hover:text-[#1e3a8a]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
        )}
        {canDelete && onDelete && (
          <button onClick={onDelete} title="Xóa bài" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        )}
      </div>

      {/* Nội dung */}
      <div className="px-4 pt-2">
        {post.title && <h3 className="text-[17px] font-bold leading-snug text-[#0f2a4a]">{post.title}</h3>}
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">{renderContent(post.content, profiles)}</p>
      </div>

      <PostImages imgs={imgs} />

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1 px-4 pt-2 text-xs text-slate-500">
          <span>{reactionSummary.join(' ')}</span>
          <span className="ml-auto">{totalReactions} lượt</span>
        </div>
      )}

      {/* Reaction bar */}
      <div className="mt-2 border-t border-slate-100 px-2 py-1">
        <div className="relative flex">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${mine ? 'text-[#1e3a8a]' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <span className="text-base">{mine ? REACTIONS.find((r) => r.kind === mine.kind)?.emoji : '👍'}</span>
            {mine ? REACTIONS.find((r) => r.kind === mine.kind)?.label : 'Thích'}
          </button>
          <button onClick={() => { setFocusCommentInput('new'); setTimeout(() => setFocusCommentInput('none'), 0); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <span className="text-base">💬</span> Bình luận
          </button>
          {pickerOpen && (
            <div className="absolute -top-11 left-0 z-20 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg">
              {REACTIONS.map((r) => (
                <button key={r.kind} onClick={() => react(r.kind)} title={r.label} className={`grid h-8 w-8 place-items-center rounded-full text-xl transition hover:scale-125 ${mine?.kind === r.kind ? 'bg-blue-50 ring-2 ring-[#1e3a8a]' : ''}`}>{r.emoji}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comments inline (5 đầu) */}
      <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        {topLevel.slice(0, visibleTop).map((c) => (
          <div key={c.id} className="space-y-1.5">
            <CommentItem c={c} depth={0} onReply={(pid, t, m) => addComment(pid, t, m)} autoFocus profiles={profiles} />
            {repliesOf(c.id).map((r) => <CommentItem key={r.id} c={r} depth={1} onReply={(pid, t, m) => addComment(pid, t, m)} autoFocus profiles={profiles} />)}
          </div>
        ))}
        {topLevel.length > visibleTop && (
          <button onClick={() => setVisibleTop((v) => v + 5)} className="text-sm font-semibold text-[#1e3a8a] hover:underline">Xem thêm {topLevel.length - visibleTop} bình luận</button>
        )}
        {comments.length > 0 && (
          <button onClick={() => setFullOpen(true)} className="text-sm font-semibold text-[#1e3a8a] hover:underline">Xem full ({comments.length})</button>
        )}
        {/* Ô bình luận mới — autoFocus khi bấm Bình luận */}
        <div className="flex items-start gap-2 pt-1">
          <Avatar name="Tôi" src={null} size={32} />
          <div className="min-w-0 flex-1">
            <MentionInput autoFocus={focusCommentInput === 'new'} value={newCmt} onChange={(v, m) => { setNewCmt(v); setNewMentions(m); }} placeholder="Viết bình luận — gõ @Tên để tag…" rows={1} />
            <div className="mt-1 flex justify-end"><button disabled={busy || !newCmt.trim()} onClick={async () => { await addComment(null, newCmt, newMentions); setNewCmt(''); setNewMentions([]); }} className="rounded bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{busy ? '…' : 'Gửi'}</button></div>
          </div>
        </div>
      </div>

      {/* Dialog Xem full */}
      <Dialog open={fullOpen} onClose={() => setFullOpen(false)} title={`Bình luận (${comments.length})`}>
        <div className="nice-scroll max-h-[60vh] space-y-3 overflow-auto pr-2">
          {comments.length === 0 ? <p className="text-sm text-slate-500">Chưa có bình luận.</p> : topLevel.map((c) => (
            <div key={c.id} className="space-y-1.5">
              <CommentItem c={c} depth={0} onReply={(pid, t, m) => addComment(pid, t, m)} autoFocus profiles={profiles} />
              {repliesOf(c.id).map((r) => <CommentItem key={r.id} c={r} depth={1} onReply={(pid, t, m) => addComment(pid, t, m)} autoFocus profiles={profiles} />)}
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
