'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { categoryItems } from '@/lib/categories';
import { notifyTelegram } from '@/lib/notify';

export function AddCampaignDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { userId } = useAuth();
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [obj, setObj] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [t, s] = await Promise.all([categoryItems('loai_chien_dich'), categoryItems('trang_thai_chien_dich')]);
      setTypes(t.map((x) => ({ id: x.id, name: x.name })));
      setStatuses(s.map((x) => ({ id: x.id, name: x.name })));
    })();
  }, [open]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    await supabase.from('campaigns').insert({ name: name.trim(), type_id: typeId || null, status_id: statusId || null, start_date: start || null, end_date: end || null, objective: obj.trim(), owner_id: userId, created_by: userId });
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Tạo chiến dịch', entity_type: 'campaign', entity_id: null, details: { name: name.trim(), full_name: me2?.full_name ?? '' } }); } catch {}
    const _tenCD = name.trim();
    notifyTelegram('TB_CHIEN_DICH_MOI', (nm) => `[Chiến dịch mới] ${_tenCD}\nNgười tạo: ${nm}`, userId);
    setName(''); setTypeId(''); setStatusId(''); setStart(''); setEnd(''); setObj('');
    setBusy(false); onClose(); onDone();
  }

  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';
  const LABEL = 'mb-1 block text-sm font-semibold';

  return (
    <Dialog open={open} onClose={onClose} title="Tạo chiến dịch">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={LABEL}>Tên chiến dịch *</label><input value={name} onChange={(e) => setName(e.target.value)} className={sel} /></div>
        <div><label className={LABEL}>Loại</label><select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={sel}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className={LABEL}>Trạng thái</label><select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={sel}><option value="">—</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label className={LABEL}>Ngày bắt đầu</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={sel} /></div>
        <div><label className={LABEL}>Ngày kết thúc</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={sel} /></div>
        <div className="sm:col-span-2"><label className={LABEL}>Mục tiêu (Objective)</label><GrowArea value={obj} onChange={(e) => setObj(e.target.value)} className={sel} placeholder="VD: Doanh số 60–100tr/tháng" /></div>
      </div>
      <div className="mt-4 flex justify-end"><button onClick={create} disabled={busy || !name.trim()} className="rounded-lg bg-[#1e3a8a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang tạo…' : 'Tạo chiến dịch'}</button></div>
    </Dialog>
  );
}
