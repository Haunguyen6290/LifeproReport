'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { CommentList } from '@/components/CommentList';
import { GrowArea } from '@/components/GrowArea';
import { ClickableImages } from '@/components/ClickableImages';
import { categoryItems } from '@/lib/categories';
import { fmtDateVN } from '@/lib/time';

type Tin = {
  id: string; ngay: string; content: string; source: string; suggested_action: string; status: string;
  conclusion_content: string; conclusion_resolved: boolean | null;
  type_id: string | null; importance_id: string | null; reporter_id: string | null;
  type?: { name: string } | null; importance?: { name: string } | null; reporter?: { full_name: string } | null;
};

function StatusBadge({ s }: { s: string }) {
  const m: Record<string, string> = { MOI: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', THAOLUAN: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', KETLUAN: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m[s] ?? 'bg-slate-100'}`}>{s === 'MOI' ? 'Mới' : s === 'THAOLUAN' ? 'Đang thảo luận' : 'Đã kết luận'}</span>;
}

function Screen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { userId, can } = useAuth();
  const [tin, setTin] = useState<Tin | null>(null);
  const [imgs, setImgs] = useState<{ public_url: string }[]>([]);
  const [linkedKH, setLinkedKH] = useState<{ ma_kh: string; ten_kh: string }[]>([]);
  const [linkedSP, setLinkedSP] = useState<{ name: string }[]>([]);
  const [conc, setConc] = useState('');
  const [resolved, setResolved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState('');
  const [editLevel, setEditLevel] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editAction, setEditAction] = useState('');
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    const { data } = await supabase
      .from('market_news')
      .select('id, ngay, content, source, suggested_action, status, conclusion_content, conclusion_resolved, type_id, importance_id, reporter_id, type:category_items!market_news_type_id_fkey(name), importance:category_items!market_news_importance_id_fkey(name), reporter:profiles!market_news_reporter_id_fkey(full_name)')
      .eq('id', id).single();
    setTin((data as unknown) as Tin | null);
    const [a, lk, lp] = await Promise.all([
      supabase.from('attachments').select('public_url').eq('owner_type', 'news').eq('owner_id', id),
      supabase.from('object_links').select('target_id').eq('owner_type', 'news').eq('owner_id', id).eq('target_type', 'customer'),
      supabase.from('object_links').select('target_id').eq('owner_type', 'news').eq('owner_id', id).eq('target_type', 'product'),
    ]);
    setImgs(((a.data ?? []) as { public_url: string }[]));
    const khIds = ((lk.data ?? []) as { target_id: string }[]).map((x) => x.target_id);
    const spIds = ((lp.data ?? []) as { target_id: string }[]).map((x) => x.target_id);
    if (khIds.length) { const { data: k } = await supabase.from('customers').select('ma_kh, ten_kh').in('id', khIds); setLinkedKH((k ?? []) as { ma_kh: string; ten_kh: string }[]); }
    if (spIds.length) { const { data: s } = await supabase.from('category_items').select('name').in('id', spIds); setLinkedSP((s ?? []) as { name: string }[]); }
    setConc(data?.conclusion_content ?? '');
    setResolved(Boolean(data?.conclusion_resolved));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    (async () => {
      const [t, l] = await Promise.all([categoryItems('loai_tin_tt'), categoryItems('muc_do')]);
      setTypes(t.map((x) => ({ id: x.id, name: x.name })));
      setLevels(l.map((x) => ({ id: x.id, name: x.name })));
    })();
  }, []);

  function startEdit() {
    if (!tin) return;
    setEditType(tin.type_id ?? ''); setEditLevel(tin.importance_id ?? '');
    setEditContent(tin.content ?? ''); setEditSource(tin.source ?? ''); setEditAction(tin.suggested_action ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!editContent.trim()) return;
    setBusy(true);
    await supabase.from('market_news').update({ type_id: editType || null, importance_id: editLevel || null, content: editContent.trim(), source: editSource.trim(), suggested_action: editAction.trim() }).eq('id', id);
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Sửa tin thị trường', entity_type: 'news', entity_id: id, details: { full_name: me2?.full_name ?? '' } }); } catch {}
    setBusy(false); setEditing(false); load();
  }

  async function del() {
    if (!can('quan_ly_nguoi_dung')) { alert('Chỉ Admin được xóa.'); return; }
    if (tin?.status !== 'KETLUAN') { alert('Chỉ xóa khi đã Kết luận.'); return; }
    if (!confirm('Xóa vĩnh viễn tin này?')) return;
    const { error } = await supabase.from('market_news').delete().eq('id', id);
    if (error) { alert('Xóa thất bại: ' + error.message); return; }
    router.push('/thi-truong');
  }

  async function conclude() {
    setBusy(true);
    await supabase.from('market_news').update({ status: 'KETLUAN', conclusion_content: conc.trim(), conclusion_resolved: resolved, conclusion_by: userId, conclusion_at: new Date().toISOString() }).eq('id', id);
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Kết luận tin thị trường', entity_type: 'news', entity_id: id, details: { resolved, full_name: me2?.full_name ?? '' } }); } catch {}
    try { const nm = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data?.full_name ?? ''; await fetch('/api/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventKey:'TB_KET_LUAN', text:`[Kết luận] Tin thị trường - ${resolved ? 'Đã xử lý' : 'Chưa xử lý'}\nNgười kết luận: ${nm}\n${conc.trim().slice(0,300)}`})}); } catch {}
    setBusy(false); load();
  }

  if (!tin) return <AppSidebar><main className="px-6 py-10 text-slate-600">Đang tải…</main></AppSidebar>;
  const canEdit = tin.reporter_id === userId || can('ket_luan') || can('quan_ly_nguoi_dung');
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';
  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <button onClick={() => router.push('/thi-truong')} className="mb-3 text-sm font-medium text-[#1e3a8a] hover:underline">← Danh sách tin</button>
        {/* Card tóm tắt */}
        <div className={`${card} border-l-4 border-l-[#1e3a8a]`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eff6ff] text-[#1e3a8a]">📊</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#1e3a8a]">{tin.type?.name ?? '—'}</span>
                  <StatusBadge s={tin.status} />
                  {tin.importance?.name && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">{tin.importance.name}</span>}
                </div>
                <div className="mt-1 text-sm text-slate-600">{fmtDateVN(tin.ngay)} · {tin.reporter?.full_name ?? ''}</div>
                {(linkedKH.length > 0 || linkedSP.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {linkedKH.length > 0 && <span><b>Khách:</b> {linkedKH.map((k) => k.ten_kh).join(', ')}</span>}
                    {linkedSP.length > 0 && <span><b>SP:</b> {linkedSP.map((s) => s.name).join(', ')}</span>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {canEdit && !editing && <button onClick={startEdit} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-[#1e3a8a] hover:text-[#1e3a8a]">Sửa</button>}
              {can('quan_ly_nguoi_dung') && tin.status === 'KETLUAN' && <button onClick={del} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Xóa</button>}
            </div>
          </div>
          {editing ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-semibold">Loại tin</label><select value={editType} onChange={(e) => setEditType(e.target.value)} className={sel}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-semibold">Mức độ</label><select value={editLevel} onChange={(e) => setEditLevel(e.target.value)} className={sel}><option value="">—</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold">Nội dung *</label><GrowArea rows={3} value={editContent} onChange={(e) => setEditContent(e.target.value)} className={`${sel} w-full`} /></div>
              <div><label className="mb-1 block text-xs font-semibold">Nguồn</label><GrowArea value={editSource} onChange={(e) => setEditSource(e.target.value)} className={`${sel} w-full`} /></div>
              <div><label className="mb-1 block text-xs font-semibold">Đề xuất</label><GrowArea rows={2} value={editAction} onChange={(e) => setEditAction(e.target.value)} className={`${sel} w-full`} /></div>
              <div className="sm:col-span-2 flex justify-end gap-2"><button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button><button onClick={saveEdit} disabled={busy || !editContent.trim()} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu'}</button></div>
            </div>
          ) : (
            <>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed">{tin.content}</p>
              {tin.source && <p className="mt-2 text-xs text-slate-600">Nguồn: {tin.source}</p>}
              {tin.suggested_action && <p className="mt-1 text-xs"><span className="font-semibold">💡 Đề xuất:</span> {tin.suggested_action}</p>}
              {imgs.length > 0 && <ClickableImages imgs={imgs} />}
            </>
          )}
        </div>

        {can('ket_luan') && !editing && (
          <div className={`${card} mt-4`}>
            <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">Kết luận</h3>
            <textarea rows={2} value={conc} onChange={(e) => setConc(e.target.value)} placeholder="Nội dung kết luận…" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} className="accent-[#1e3a8a]" /> Đã xử lý (bỏ chọn = chưa xử lý, vẫn mở thảo luận)</label>
            <div className="mt-2 flex justify-end"><button onClick={conclude} disabled={busy} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu kết luận'}</button></div>
          </div>
        )}

        <CommentList targetType="news" targetId={id} />
      </main>
    </AppSidebar>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) { return <RequireAuth><Screen params={params} /></RequireAuth>; }
