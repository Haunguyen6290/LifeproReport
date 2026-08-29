'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Avatar } from '@/components/Avatar';
import { fmtCommentTimeVN } from '@/lib/time';
import { MentionInput } from '@/components/MentionInput';
import { AttachmentInput } from '@/components/AttachmentInput';

type Post = { id: string; author_id: string; title: string; content: string; mentioned_user_ids: string[]; is_bot: boolean; created_at: string; author?: { full_name: string; avatar_url?: string | null } | null };
type Img = { id: string; owner_id: string; public_url: string };

function renderContent(content: string) {
  const parts = content.split(/(@[^\s@]+(?:\s+[^\s@]+)?)/g);
  return parts.map((p, i) => p.startsWith('@') ? <span key={i} className="font-semibold text-[#1e3a8a]">{p}</span> : <span key={i}>{p}</span>);
}

/** Ảnh kiểu Facebook: 1 ảnh full-width to; 2 ảnh 2 cột; 3+ ảnh lưới 3 cột. */
function PostImages({ imgs }: { imgs: { public_url: string }[] }) {
  if (imgs.length === 0) return null;
  if (imgs.length === 1) {
    return <img src={imgs[0].public_url} alt="" className="mt-3 max-h-[520px] w-full rounded-lg object-cover" />;
  }
  if (imgs.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
        {imgs.slice(0, 2).map((im, i) => <img key={i} src={im.public_url} alt="" className="h-[280px] w-full object-cover" />)}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
      {imgs.slice(0, 6).map((im, i) => <img key={i} src={im.public_url} alt="" className="h-[160px] w-full object-cover" />)}
    </div>
  );
}

function BangTinInner() {
  const { userId, can } = useAuth();
  const canPost = can('quan_ly_cai_dat') || can('quan_ly_nguoi_dung');
  const [posts, setPosts] = useState<Post[]>([]);
  const [imgMap, setImgMap] = useState<Record<string, Img[]>>({});
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
    if (list.length > 0) {
      const ids = list.map((p) => p.id);
      const { data: atts } = await supabase.from('attachments').select('id, owner_id, public_url').eq('owner_type', 'bulletin').in('owner_id', ids);
      const m: Record<string, Img[]> = {};
      for (const a of (atts ?? []) as Img[]) (m[a.owner_id] ||= []).push(a);
      setImgMap(m);
    } else setImgMap({});
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
      // xóa ảnh trong storage (không chặn)
      const atts = imgMap[p.id] ?? [];
      for (const a of atts) { try { await supabase.storage.from('attachments').remove([a.public_url.split('/attachments/')[1] ?? '']); } catch {} }
      await supabase.from('bulletin_posts').delete().eq('id', p.id); // cascade xóa comments
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
              {posts.map((p) => {
                const pImgs = imgMap[p.id] ?? [];
                return (
                  <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                    {/* Header — avatar + tên + thời gian + xóa */}
                    <div className="flex items-center gap-2 px-4 pt-3">
                      <Avatar name={(p as any).author?.full_name ?? '?'} src={(p as any).author?.avatar_url ?? null} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{(p as any).author?.full_name ?? ''}</span>
                          {p.is_bot && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">BOT 8h30 T2</span>}
                        </div>
                        <span className="text-xs text-slate-500">{fmtCommentTimeVN(p.created_at)}</span>
                      </div>
                      {canPost && (
                        <button onClick={() => delPost(p)} aria-label="Xóa bài" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600" title="Xóa bài">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      )}
                    </div>

                    {/* Nội dung — to, rõ */}
                    <div className="px-4 pt-2">
                      {p.title && <h3 className="text-[17px] font-bold leading-snug text-[#0f2a4a]">{p.title}</h3>}
                      <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">{renderContent(p.content)}</p>
                    </div>

                    {/* Ảnh — to, full-width kiểu Facebook */}
                    <PostImages imgs={pImgs} />

                    {/* Footer — link sang bình luận */}
                    <div className="mt-3 border-t border-slate-100 px-4 py-2">
                      <Link href={`/bang-tin/${p.id}`} className="text-sm font-semibold text-[#1e3a8a] hover:underline">Xem & bình luận →</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><BangTinInner /></RequireAuth>; }
