'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { fmtCommentTimeVN } from '@/lib/time';
import { MentionInput } from '@/components/MentionInput';
import { AttachmentInput } from '@/components/AttachmentInput';

type Post = { id: string; author_id: string; title: string; content: string; mentioned_user_ids: string[]; is_bot: boolean; created_at: string; author?: { full_name: string } | null };

function renderContent(content: string) {
  // Highlight @mentions
  const parts = content.split(/(@[^\s@]+(?:\s+[^\s@]+)?)/g);
  return parts.map((p, i) => p.startsWith('@') ? <span key={i} className="font-semibold text-[#1e3a8a]">{p}</span> : <span key={i}>{p}</span>);
}

function BangTinInner() {
  const { userId, can } = useAuth();
  const canPost = can('quan_ly_cai_dat') || can('quan_ly_nguoi_dung');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [imgs, setImgs] = useState<{ storage_path: string; public_url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('bulletin_posts').select('id, author_id, title, content, mentioned_user_ids, is_bot, created_at, author:profiles!bulletin_posts_author_id_fkey(full_name)').order('created_at', { ascending: false }).limit(50);
    setPosts((data as any ?? []) as Post[]);
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
      // audit + telegram not blocking
      try { const me = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data as any; await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Đăng bảng tin', entity_type: 'bulletin', entity_id: id, details: { title: title.trim(), full_name: me?.full_name ?? '' } }); } catch {}
      setTitle(''); setContent(''); setMentions([]); setImgs([]);
      load();
    } catch (e: any) { setMsg(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[#0f2a4a]">Bảng tin</h1>
          <span className="text-xs text-slate-500">{posts.length} bài</span>
        </div>

        {canPost && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Đăng bài mới (chỉ Admin/Quản lý)</h2>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề…" className="mb-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a]" />
            <MentionInput value={content} onChange={(v, m) => { setContent(v); setMentions(m); }} placeholder="Nội dung — gõ @Tên để tag…" rows={3} />
            <div className="mt-2"><AttachmentInput value={imgs} onChange={setImgs} /></div>
            {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
            <div className="mt-2 flex justify-end"><button onClick={doPost} disabled={busy} className="rounded-lg bg-[#0f2a4a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang đăng…' : 'Đăng bài'}</button></div>
          </div>
        )}

        {loading ? <p className="text-sm text-slate-500">Đang tải…</p> : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-600">Chưa có bài nào.</p></div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/bang-tin/${p.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-[#1e3a8a]/30">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">{(p as any).author?.full_name ?? ''}</span>
                  <span>·</span><span>{fmtCommentTimeVN(p.created_at)}</span>
                  {p.is_bot && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">BOT</span>}
                </div>
                {p.title && <h3 className="mt-1 text-sm font-bold text-[#0f2a4a] line-clamp-1">{p.title}</h3>}
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">{renderContent(p.content)}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><BangTinInner /></RequireAuth>; }
