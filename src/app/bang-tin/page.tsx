'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { MentionInput } from '@/components/MentionInput';
import { AttachmentInput } from '@/components/AttachmentInput';
import { BulletinPostCard } from '@/components/BulletinPostCard';

type Post = { id: string; author_id: string; title: string; content: string; mentioned_user_ids: string[]; is_bot: boolean; created_at: string; author?: { full_name: string; avatar_url?: string | null } | null };
type Img = { id: string; owner_id: string; public_url: string };
type Reaction = { user_id: string; kind: 'like' | 'love' | 'haha' | 'angry'; post_id: string };
type Cmt = { id: string; post_id: string; author_id: string; content: string; created_at: string; parent_id: string | null; author?: { full_name: string; avatar_url?: string | null } | null };

function BangTinInner() {
  const { userId, can } = useAuth();
  const canPost = can('quan_ly_cai_dat') || can('quan_ly_nguoi_dung');
  const [posts, setPosts] = useState<Post[]>([]);
  const [imgMap, setImgMap] = useState<Record<string, Img[]>>({});
  const [reactMap, setReactMap] = useState<Record<string, Reaction[]>>({});
  const [cmtMap, setCmtMap] = useState<Record<string, Cmt[]>>({});
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [imgs, setImgs] = useState<{ storage_path: string; public_url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('bulletin_posts').select('id, author_id, title, content, mentioned_user_ids, is_bot, created_at, author:profiles!bulletin_posts_author_id_fkey(full_name, avatar_url)').order('created_at', { ascending: false }).limit(50);
    const list = (data as any ?? []) as Post[];
    setPosts(list);
    if (list.length === 0) { setImgMap({}); setReactMap({}); setCmtMap({}); setLoading(false); return; }
    const ids = list.map((p) => p.id);
    const [attsRes, reactsRes, cmtsRes] = await Promise.all([
      supabase.from('attachments').select('id, owner_id, public_url').eq('owner_type', 'bulletin').in('owner_id', ids),
      supabase.from('bulletin_reactions').select('post_id, user_id, kind').in('post_id', ids),
      supabase.from('bulletin_comments').select('id, post_id, author_id, content, created_at, parent_id, author:profiles!bulletin_comments_author_id_fkey(full_name, avatar_url)').in('post_id', ids).order('created_at', { ascending: true }),
    ]);
    const mImgs: Record<string, Img[]> = {};
    for (const a of ((attsRes.data ?? []) as Img[])) (mImgs[a.owner_id] ||= []).push(a);
    setImgMap(mImgs);
    const mReacts: Record<string, Reaction[]> = {};
    for (const r of ((reactsRes.data ?? []) as Reaction[])) (mReacts[r.post_id] ||= []).push(r);
    setReactMap(mReacts);
    const mCmts: Record<string, Cmt[]> = {};
    for (const c of ((cmtsRes.data ?? []) as unknown as Cmt[])) (mCmts[c.post_id] ||= []).push(c);
    setCmtMap(mCmts);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function doPost() {
    if (!title.trim() && !content.trim()) { setMsg('Nhập tiêu đề hoặc nội dung'); return; }
    setBusy(true); setMsg('');
    try {
      const { data: inserted, error } = await supabase.from('bulletin_posts').insert({
        author_id: userId, title: title.trim(), content: content.trim(), mentioned_user_ids: mentions, is_bot: false,
      }).select('id').single();
      if (error) throw error;
      const id = (inserted as any).id as string;
      for (const im of imgs) await supabase.from('attachments').insert({ owner_type: 'bulletin', owner_id: id, storage_path: im.storage_path, public_url: im.public_url, uploader_id: userId });
      try { const me = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data as any; await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Đăng bảng tin', entity_type: 'bulletin', entity_id: id, details: { title: title.trim(), full_name: me?.full_name ?? '' } }); } catch {}
      setTitle(''); setContent(''); setMentions([]); setImgs([]);
      load();
    } catch (e: any) { setMsg(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  async function delPost(p: Post) {
    if (!canPost) return;
    if (!confirm(`Xóa bài "${p.title || p.content.slice(0, 40)}..."? Bình luận kèm theo cũng bị xóa.`)) return;
    try {
      const atts = imgMap[p.id] ?? [];
      for (const a of atts) { try { await supabase.storage.from('attachments').remove([a.public_url.split('/attachments/')[1] ?? '']); } catch {} }
      await supabase.from('bulletin_posts').delete().eq('id', p.id);
      try { const me = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data as any; await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Xóa bảng tin', entity_type: 'bulletin', entity_id: p.id, details: { full_name: me?.full_name ?? '' } }); } catch {}
      load();
    } catch (e: any) { setMsg(e?.message ?? String(e)); }
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[#0f2a4a]">Bảng tin</h1>
            <span className="text-xs text-slate-500">{posts.length} bài</span>
          </div>

          {canPost && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề…" className="mb-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a]" />
              <MentionInput value={content} onChange={(v, m) => { setContent(v); setMentions(m); }} placeholder="Bạn đang nghĩ gì? Gõ @Tên để tag…" rows={3} />
              <div className="mt-2"><AttachmentInput value={imgs} onChange={setImgs} /></div>
              {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
              <div className="mt-2 flex justify-end"><button onClick={doPost} disabled={busy} className="rounded-lg bg-[#0f2a4a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang đăng…' : 'Đăng bài'}</button></div>
            </div>
          )}

          {loading ? <p className="text-sm text-slate-500">Đang tải…</p> : posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-600">Chưa có bài nào.</p></div>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <BulletinPostCard key={p.id} post={p} imgs={imgMap[p.id] ?? []} reactions={reactMap[p.id] ?? []} comments={cmtMap[p.id] ?? []} userId={userId} onChanged={load} canDelete={canPost} onDelete={() => delPost(p)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><BangTinInner /></RequireAuth>; }
