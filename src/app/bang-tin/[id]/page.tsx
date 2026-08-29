'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { fmtCommentTimeVN } from '@/lib/time';
import { MentionInput } from '@/components/MentionInput';

type Post = { id: string; author_id: string; title: string; content: string; created_at: string; is_bot: boolean; author?: { full_name: string } | null };
type Cmt = { id: string; post_id: string; author_id: string; content: string; created_at: string; author?: { full_name: string } | null };

function renderContent(content: string) {
  const parts = content.split(/(@[^\s@]+(?:\s+[^\s@]+)?)/g);
  return parts.map((p, i) => p.startsWith('@') ? <span key={i} className="font-semibold text-[#1e3a8a]">{p}</span> : <span key={i}>{p}</span>);
}

function DetailInner() {
  const { id } = useParams() as { id: string };
  const { userId } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Cmt[]>([]);
  const [images, setImages] = useState<{ public_url: string }[]>([]);
  const [content, setContent] = useState(''); const [mentions, setMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('bulletin_posts').select('id, author_id, title, content, created_at, is_bot, author:profiles!bulletin_posts_author_id_fkey(full_name)').eq('id', id).single();
    setPost(data as any ?? null);
    const { data: cmts } = await supabase.from('bulletin_comments').select('id, post_id, author_id, content, created_at, author:profiles!bulletin_comments_author_id_fkey(full_name)').eq('post_id', id).order('created_at', { ascending: true });
    setComments((cmts as any ?? []) as Cmt[]);
    const { data: atts } = await supabase.from('attachments').select('public_url').eq('owner_type', 'bulletin').eq('owner_id', id);
    setImages((atts ?? []) as any);
  }
  useEffect(() => { if (id) load(); }, [id]);

  async function postComment() {
    if (!content.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('bulletin_comments').insert({ post_id: id, author_id: userId, content: content.trim(), mentioned_user_ids: mentions });
    if (!error) { setContent(''); setMentions([]); load(); }
    setBusy(false);
  }

  if (!post) return <AppSidebar><main className="px-6 py-10 text-sm text-slate-500">Đang tải…</main></AppSidebar>;

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <a href="/bang-tin" className="text-sm text-[#1e3a8a] hover:underline">← Bảng tin</a>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          {post.is_bot && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">BOT 8h30 T2</span>}
          {post.title && <h1 className="mt-2 text-lg font-bold text-[#0f2a4a]">{post.title}</h1>}
          <p className="mt-1 text-xs text-slate-500">{(post as any).author?.full_name ?? ''} · {fmtCommentTimeVN(post.created_at)}</p>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">{renderContent(post.content)}</p>
          {images.length > 0 && (
            <div className={`mt-3 gap-1 overflow-hidden rounded-lg ${images.length === 1 ? 'grid grid-cols-1' : images.length === 2 ? 'grid grid-cols-2' : 'grid grid-cols-3'}`}>
              {images.map((im, i) => <img key={i} src={im.public_url} alt="" className={`${images.length === 1 ? 'max-h-[520px]' : 'h-[220px]'} w-full object-cover`} />)}
            </div>
          )}
        </div>

        <div className="mt-4">
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Bình luận ({comments.length})</h2>
          {comments.length === 0 ? <p className="text-sm text-slate-500">Chưa có bình luận.</p> : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500"><span className="font-semibold text-slate-900">{(c as any).author?.full_name ?? ''}</span><span>·</span><span>{fmtCommentTimeVN(c.created_at)}</span></div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{renderContent(c.content)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <MentionInput value={content} onChange={(v, m) => { setContent(v); setMentions(m); }} placeholder="Viết bình luận — gõ @Tên để tag…" rows={2} />
            <div className="mt-2 flex justify-end"><button onClick={postComment} disabled={busy || !content.trim()} className="rounded-lg bg-[#0f2a4a] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang gửi…' : 'Gửi bình luận'}</button></div>
          </div>
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><DetailInner /></RequireAuth>; }
