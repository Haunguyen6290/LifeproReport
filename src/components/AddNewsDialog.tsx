'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { AttachmentInput } from '@/components/AttachmentInput';
import { Combobox } from '@/components/Combobox';
import { GrowArea } from '@/components/GrowArea';
import { categoryItems } from '@/lib/categories';

export function AddNewsDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { userId } = useAuth();
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; ma_kh: string; ten_kh: string }[]>([]);
  const [content, setContent] = useState('');
  const [typeId, setTypeId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [source, setSource] = useState('');
  const [action, setAction] = useState('');
  const [ganKH, setGanKH] = useState<string[]>([]);
  const [ganSP, setGanSP] = useState<string[]>([]);
  const [imgs, setImgs] = useState<{ storage_path: string; public_url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [t, l, p, c] = await Promise.all([
        categoryItems('loai_tin_tt'), categoryItems('muc_do'), categoryItems('san_pham'),
        supabase.from('customers').select('id, ma_kh, ten_kh').order('ten_kh'),
      ]);
      setTypes(t.map((x) => ({ id: x.id, name: x.name })));
      setLevels(l.map((x) => ({ id: x.id, name: x.name })));
      setProducts(p.map((x) => ({ id: x.id, name: x.name })));
      setCustomers((c.data ?? []) as any);
    })();
  }, [open]);

  async function post() {
    if (!content.trim()) return;
    setBusy(true);
    const { data } = await supabase.from('market_news').insert({
      reporter_id: userId, type_id: typeId || null, importance_id: levelId || null,
      content: content.trim(), source, suggested_action: action,
    }).select('id').single();
    if (data) {
      for (const kh of ganKH) await supabase.from('object_links').insert({ owner_type: 'news', owner_id: data.id, target_type: 'customer', target_id: kh });
      for (const sp of ganSP) await supabase.from('object_links').insert({ owner_type: 'news', owner_id: data.id, target_type: 'product', target_id: sp });
      for (const im of imgs) await supabase.from('attachments').insert({ owner_type: 'news', owner_id: data.id, storage_path: im.storage_path, public_url: im.public_url, uploader_id: userId });
      try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Ghi tin thị trường', entity_type: 'news', entity_id: data.id, details: { type_id: typeId, full_name: (me2 as any)?.full_name ?? '' } }); } catch {}
      try { const nm = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data?.full_name ?? ''; const typeName = types.find(x=>x.id===typeId)?.name ?? ''; await fetch('/api/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventKey:'TB_TIN_THI_TRUONG_MOI', text:`[Tin thi truong] ${typeName ? typeName+' - ' : ''}${content.trim().slice(0,300)}\nNguoi gui: ${nm}`})}); } catch {}
    }
    setContent(''); setTypeId(''); setLevelId(''); setSource(''); setAction(''); setGanKH([]); setGanSP([]); setImgs([]);
    setBusy(false); onClose(); onDone();
  }

  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';
  const LABEL = 'mb-1 block text-sm font-semibold';

  return (
    <Dialog open={open} onClose={onClose} title="Ghi tin thị trường">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={LABEL}>Loại tin</label><select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={sel}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className={LABEL}>Mức độ quan trọng</label><select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={sel}><option value="">—</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div className="sm:col-span-2"><label className={LABEL}>Nội dung *</label><GrowArea rows={3} value={content} onChange={(e) => setContent(e.target.value)} className={`${sel} w-full`} /></div>
        <div><label className={LABEL}>Nguồn</label><GrowArea value={source} onChange={(e) => setSource(e.target.value)} className={`${sel} w-full`} /></div>
        <div><label className={LABEL}>Hành động đề xuất</label><GrowArea rows={2} value={action} onChange={(e) => setAction(e.target.value)} className={`${sel} w-full`} /></div>
        <div><label className={LABEL}>Gắn khách hàng</label><Combobox options={customers.map((c) => ({ id: c.id, label: c.ten_kh }))} value={ganKH} onChange={setGanKH} placeholder="Tìm khách hàng…" /></div>
        <div><label className={LABEL}>Gắn sản phẩm</label><Combobox options={products.map((p) => ({ id: p.id, label: p.name }))} value={ganSP} onChange={setGanSP} placeholder="Tìm sản phẩm…" /></div>
        <div className="sm:col-span-2"><label className={LABEL}>Ảnh</label><AttachmentInput value={imgs} onChange={setImgs} /></div>
      </div>
      <div className="mt-4 flex justify-end"><button onClick={post} disabled={busy || !content.trim()} className="rounded-lg bg-[#1e3a8a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang gửi…' : 'Gửi tin'}</button></div>
    </Dialog>
  );
}
