'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { CommentList } from '@/components/CommentList';
import { AttachmentInput } from '@/components/AttachmentInput';
import { Combobox } from '@/components/Combobox';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { categoryItems } from '@/lib/categories';
import { notifyTelegram } from '@/lib/notify';
import { fmtDateVN } from '@/lib/time';

type Update = {
  id: string; ngay: string; content: string; rating: string | null;
  conclusion_content: string; conclusion_resolved: boolean | null;
  reporter?: { full_name: string } | null; type?: { name: string } | null;
  ganKH: { ma_kh: string; ten_kh: string }[]; ganSP: { name: string }[];
};
const RATING_LABEL: Record<string, string> = { TOT: '🟢 Tốt', BINH_THUONG: '🟡 Bình thường', XAU: '🔴 Xấu' };

export function CampaignDetail({ id, onClose, onMarkViewed }: { id: string; onClose?: () => void; onMarkViewed?: () => void }) {
  const { userId, can } = useAuth();
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [meta, setMeta] = useState<{ type?: string; status?: string; type_id?: string; status_id?: string; start?: string; end?: string; owner?: string; owner_id?: string }>({});
  const [updates, setUpdates] = useState<Update[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [campTypes, setCampTypes] = useState<{ id: string; name: string }[]>([]);
  const [campStatuses, setCampStatuses] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; ma_kh: string; ten_kh: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editObj, setEditObj] = useState('');
  const [newU, setNewU] = useState({ type: '', content: '', rating: '', ganKH: [] as string[], ganSP: [] as string[], imgs: [] as { storage_path: string; public_url: string }[] });
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    const { data: cd } = await supabase.from('campaigns').select('id, name, objective, start_date, end_date, type_id, status_id, owner_id, type:category_items!campaigns_type_id_fkey(name), status:category_items!campaigns_status_id_fkey(name), owner:profiles!campaigns_owner_id_fkey(full_name)').eq('id', id).single();
    setName(cd?.name ?? ''); setObjective(cd?.objective ?? '');
    setMeta({ type: (cd as any)?.type?.name, status: (cd as any)?.status?.name, type_id: (cd as any)?.type_id, status_id: (cd as any)?.status_id, start: (cd as any)?.start_date, end: (cd as any)?.end_date, owner: (cd as any)?.owner?.full_name, owner_id: (cd as any)?.owner_id });
    const { data: ups } = await supabase.from('campaign_updates').select('id, ngay, content, rating, conclusion_content, conclusion_resolved, reporter:profiles!campaign_updates_reporter_id_fkey(full_name), type:category_items!campaign_updates_type_id_fkey(name)').eq('campaign_id', id).order('created_at', { ascending: false });
    const list = (ups ?? []) as any[];
    const ids = list.map((u) => u.id);
    let lkRes: any = { data: [] }, lpRes: any = { data: [] };
    if (ids.length) {
      [lkRes, lpRes] = await Promise.all([
        supabase.from('object_links').select('owner_id, target_id').eq('owner_type', 'campaign_update').in('owner_id', ids).eq('target_type', 'customer'),
        supabase.from('object_links').select('owner_id, target_id').eq('owner_type', 'campaign_update').in('owner_id', ids).eq('target_type', 'product'),
      ]);
    }
    const khIds = [...new Set((lkRes.data ?? []).map((x: any) => x.target_id))];
    const spIds = [...new Set((lpRes.data ?? []).map((x: any) => x.target_id))];
    const khMap: Record<string, { ma_kh: string; ten_kh: string }> = {};
    if (khIds.length) { const { data } = await supabase.from('customers').select('id, ma_kh, ten_kh').in('id', khIds); for (const c of (data ?? []) as any[]) khMap[c.id] = { ma_kh: c.ma_kh, ten_kh: c.ten_kh }; }
    const spMap: Record<string, { name: string }> = {};
    if (spIds.length) { const { data } = await supabase.from('category_items').select('id, name').in('id', spIds); for (const s of (data ?? []) as any[]) spMap[s.id] = { name: s.name }; }
    const out: Update[] = list.map((u) => ({
      id: u.id, ngay: u.ngay, content: u.content, rating: u.rating, conclusion_content: u.conclusion_content, conclusion_resolved: u.conclusion_resolved,
      reporter: u.reporter, type: u.type,
      ganKH: (lkRes.data ?? []).filter((x: any) => x.owner_id === u.id).map((x: any) => khMap[x.target_id]).filter(Boolean),
      ganSP: (lpRes.data ?? []).filter((x: any) => x.owner_id === u.id).map((x: any) => spMap[x.target_id]).filter(Boolean),
    }));
    setUpdates(out);
  }

  useEffect(() => {
    load();
    // Đánh dấu đã xem chiến dịch này
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch('/api/campaign/mark-viewed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ campaign_id: id }),
        });
        // Callback để trang danh sách refresh badge
        onMarkViewed?.();
      }
    })();
    (async () => {
      const [t, p, c, ct, cs] = await Promise.all([categoryItems('loai_cap_nhat'), categoryItems('san_pham'), supabase.from('customers').select('id, ma_kh, ten_kh').order('ten_kh'), categoryItems('loai_chien_dich'), categoryItems('trang_thai_chien_dich')]);
      setTypes(t.map((x) => ({ id: x.id, name: x.name })));
      setProducts(p.map((x) => ({ id: x.id, name: x.name })));
      setCustomers((c.data ?? []) as any);
      setCampTypes(ct.map((x) => ({ id: x.id, name: x.name })));
      setCampStatuses(cs.map((x) => ({ id: x.id, name: x.name })));
    })();
  }, [id, onMarkViewed]);

  function startEdit() {
    setEditName(name); setEditType(meta.type_id ?? ''); setEditStatus(meta.status_id ?? '');
    setEditStart((meta.start || '').slice(0,10)); setEditEnd((meta.end || '').slice(0,10)); setEditObj(objective);
    setEditing(true);
  }
  async function saveEdit() {
    if (!editName.trim()) return;
    setBusy(true);
    await supabase.from('campaigns').update({ name: editName.trim(), type_id: editType || null, status_id: editStatus || null, start_date: editStart || null, end_date: editEnd || null, objective: editObj.trim() }).eq('id', id);
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Sửa chiến dịch', entity_type: 'campaign', entity_id: id, details: { full_name: (me2 as any)?.full_name ?? '' } }); } catch {}
    setBusy(false); setEditing(false); load();
  }
  async function del() {
    if (!can('quan_ly_nguoi_dung')) { alert('Chỉ Admin được xóa.'); return; }
    if (meta.status !== 'Đã kết thúc') { alert('Chỉ xóa khi đã kết thúc.'); return; }
    if (!confirm(`Xóa vĩnh viễn chiến dịch "${name}"?`)) return;
    await supabase.from('campaigns').delete().eq('id', id);
    onClose?.();
  }
  async function postUpdate() {
    if (!newU.content.trim()) return;
    setBusy(true);
    const { data } = await supabase.from('campaign_updates').insert({ campaign_id: id, reporter_id: userId, type_id: newU.type || null, content: newU.content.trim(), rating: newU.rating || null }).select('id').single();
    if (data) {
      for (const kh of newU.ganKH) await supabase.from('object_links').insert({ owner_type: 'campaign_update', owner_id: data.id, target_type: 'customer', target_id: kh });
      for (const sp of newU.ganSP) await supabase.from('object_links').insert({ owner_type: 'campaign_update', owner_id: data.id, target_type: 'product', target_id: sp });
      for (const im of newU.imgs) await supabase.from('attachments').insert({ owner_type: 'campaign_update', owner_id: data.id, storage_path: im.storage_path, public_url: im.public_url, uploader_id: userId });
      try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Cập nhật chiến dịch', entity_type: 'campaign', entity_id: id, details: { update_id: data.id, full_name: (me2 as any)?.full_name ?? '' } }); } catch {}
      const _nd = newU.content.trim().slice(0, 300);
      const _ten = name;
      notifyTelegram('TB_CAP_NHAT_CHIEN_DICH', (nm) => `[Cập nhật chiến dịch] ${_ten} - ${_nd}\nNgười gửi: ${nm}`, userId);
    }
    setNewU({ type: '', content: '', rating: '', ganKH: [], ganSP: [], imgs: [] });
    setAddOpen(false);
    setBusy(false); load();
  }
  async function conclude(u: Update, resolved: boolean) {
    await supabase.from('campaign_updates').update({ conclusion_content: resolved ? 'Đã xử lý' : 'Chưa xử lý', conclusion_resolved: resolved, conclusion_by: userId }).eq('id', u.id);
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Kết luận bản cập nhật', entity_type: 'campaign', entity_id: id, details: { update_id: u.id, resolved, full_name: (me2 as any)?.full_name ?? '' } }); } catch {}
    const _tenKL = name;
    notifyTelegram('TB_KET_LUAN', (nm) => `[Kết luận] Chiến dịch ${_tenKL} - ${resolved ? 'Đã xử lý' : 'Chưa xử lý'}\nNgười kết luận: ${nm}`, userId);
    load();
  }
  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';
  return (
    <div className="space-y-4">
        <div className={card + ' border-l-4 border-l-[#1e3a8a]'}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eff6ff] text-[#1e3a8a]">🎯</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold leading-tight">{name || '—'}</h1>
                  {meta.status && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold ring-1 ring-slate-200">{meta.status}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {meta.type && <span>Loại: <b className="text-slate-900">{meta.type}</b></span>}
                  {meta.owner && <span>Phụ trách: <b className="text-slate-900">{meta.owner}</b></span>}
                  {(meta.start || meta.end) && <span>{meta.start ? fmtDateVN(meta.start) : '—'} → {meta.end ? fmtDateVN(meta.end) : '—'}</span>}
                </div>
                {objective && <p className="mt-2 text-sm"><span className="font-semibold">🎯 Mục tiêu:</span> {objective}</p>}
                <div className="mt-2 flex gap-2 text-xs text-slate-600"><span>{updates.length} cập nhật</span></div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {(meta.owner_id === userId || can('quan_ly_chien_dich') || can('quan_ly_nguoi_dung')) && <button onClick={startEdit} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-[#1e3a8a] hover:text-[#1e3a8a]">Sửa</button>}
              {can('quan_ly_chien_dich') && meta.status === 'Đang chạy' && <button onClick={async () => { const st = campStatuses.find(s => s.name==='Đã kết thúc'); if(!st) return; await supabase.from('campaigns').update({ status_id: st.id }).eq('id', id); load(); }} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">Kết thúc</button>}
              {can('quan_ly_nguoi_dung') && meta.status === 'Đã kết thúc' && <button onClick={del} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Xóa</button>}
            </div>
          </div>
          {editing && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold">Tên chiến dịch *</label><input value={editName} onChange={(e) => setEditName(e.target.value)} className={sel} /></div>
              <div><label className="mb-1 block text-xs font-semibold">Loại</label><select value={editType} onChange={(e) => setEditType(e.target.value)} className={sel}><option value="">—</option>{campTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-semibold">Trạng thái</label><select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={sel}><option value="">—</option>{campStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs font-semibold">Ngày bắt đầu</label><input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={sel} /></div>
              <div><label className="mb-1 block text-xs font-semibold">Ngày kết thúc</label><input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={sel} /></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold">Mục tiêu</label><GrowArea value={editObj} onChange={(e) => setEditObj(e.target.value)} className={sel} /></div>
              <div className="sm:col-span-2 flex justify-end gap-2"><button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button><button onClick={saveEdit} disabled={busy || !editName.trim()} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy?'Đang lưu…':'Lưu'}</button></div>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end"><button onClick={() => setAddOpen(true)} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">+ Thêm bản cập nhật</button></div>
        <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Thêm bản cập nhật">
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={newU.type} onChange={(e) => setNewU({ ...newU, type: e.target.value })} className={sel}><option value="">Loại nội dung…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select value={newU.rating} onChange={(e) => setNewU({ ...newU, rating: e.target.value })} className={sel}><option value="">Đánh giá…</option><option value="TOT">🟢 Tốt</option><option value="BINH_THUONG">🟡 Bình thường</option><option value="XAU">🔴 Xấu</option></select>
            </div>
            <GrowArea rows={3} value={newU.content} onChange={(e) => setNewU({ ...newU, content: e.target.value })} placeholder="Nội dung cập nhật…" className={sel + ' w-full'} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs font-semibold">Gắn khách hàng</label><Combobox options={customers.map((c) => ({ id: c.id, label: c.ten_kh }))} value={newU.ganKH} onChange={(v) => setNewU({ ...newU, ganKH: v })} placeholder="Tìm khách hàng…" /></div>
              <div><label className="mb-1 block text-xs font-semibold">Gắn sản phẩm</label><Combobox options={products.map((p) => ({ id: p.id, label: p.name }))} value={newU.ganSP} onChange={(v) => setNewU({ ...newU, ganSP: v })} placeholder="Tìm sản phẩm…" /></div>
            </div>
            <AttachmentInput value={newU.imgs} onChange={(imgs) => setNewU({ ...newU, imgs })} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>
              <button onClick={postUpdate} disabled={busy || !newU.content.trim()} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">Gửi cập nhật</button>
            </div>
          </div>
        </Dialog>
        <h2 className="mb-2 mt-4 text-sm font-bold text-[#1e3a8a]">Bản cập nhật ({updates.length})</h2>
        {updates.length === 0 ? <p className="py-6 text-center text-sm text-slate-600">Chưa có cập nhật nào.</p> : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.id} className="rounded-xl border border-[#1e3a8a] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span><span className="font-semibold text-slate-700">{u.type?.name ?? '—'}</span>{u.rating && ` · ${RATING_LABEL[u.rating] ?? u.rating}`}</span>
                  <span>{fmtDateVN(u.ngay)} · {u.reporter?.full_name ?? ''}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{u.content}</p>
                {(u.ganKH.length > 0 || u.ganSP.length > 0) && <div className="mt-1 text-xs text-slate-600">👤 {u.ganKH.map((k) => k.ten_kh).join(', ')} 📦 {u.ganSP.map((s) => s.name).join(', ')}</div>}
                {u.conclusion_resolved !== null ? (
                  <p className="mt-2 text-xs font-semibold text-[#1e3a8a]">{u.conclusion_resolved ? '✅ Đã xử lý' : '⏳ Chưa xử lý'}</p>
                ) : can('ket_luan') ? (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => conclude(u, true)} className="rounded border border-slate-200 px-2 py-1 text-xs hover:border-[#1e3a8a]">✅ Đã xử lý</button>
                    <button onClick={() => conclude(u, false)} className="rounded border border-slate-200 px-2 py-1 text-xs hover:border-[#1e3a8a]">⏳ Chưa xử lý</button>
                  </div>
                ) : null}
                <CommentList targetType="campaign_update" targetId={u.id} />
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
