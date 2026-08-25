'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { DAYS, joinDays, parseDays, weekBounds, deadlineKH, isLate } from '@/lib/week';
import { fmtCommentTimeVN } from '@/lib/time';

export type PlanItemDraft = {
  id?: string;
  cong_viec: string;
  kq_can_dat: string;
  ngay_list: string;
  uu_tien: 'Cao' | 'Trung bình' | 'Thấp';
  kr_id: string;
};

export type PlanData = {
  id: string;
  user_id: string;
  tuan_tu: string;
  tuan_den: string;
  muc_tieu_tuan: string;
  noi_dung: string;
  created_at: string;
  updated_at: string;
  trang_thai_duyet: string;
  y_kien_quan_ly: string;
  items: PlanItemDraft[];
};

const UU_TIEN = ['Cao', 'Trung bình', 'Thấp'] as const;

export function PlanDialog({
  open,
  onClose,
  tuanTu,
  tuanDen,
  edit,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tuanTu: string;
  tuanDen: string;
  edit?: PlanData | null;
  onDone: () => void;
}) {
  const { userId, can } = useAuth();
  const [mucTieu, setMucTieu] = useState('');
  const [items, setItems] = useState<PlanItemDraft[]>([]);
  const [myKRs, setMyKRs] = useState<{ id: string; noi_dung: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setMsg('');
    if (edit) {
      setMucTieu(edit.muc_tieu_tuan || edit.noi_dung || '');
      setItems(edit.items.length ? edit.items.map((i) => ({ ...i })) : [{ cong_viec: '', kq_can_dat: '', ngay_list: '', uu_tien: 'Trung bình', kr_id: '' }]);
    } else {
      setMucTieu('');
      setItems([{ cong_viec: '', kq_can_dat: '', ngay_list: '', uu_tien: 'Trung bình', kr_id: '' }]);
    }
    // load KR cá nhân của mình trong kỳ để gắn
    (async () => {
      try {
        const uid = userId || (await supabase.auth.getUser()).data.user?.id || '';
        if (!uid) return;
        const { data } = await supabase.from('okrs').select('id').eq('user_id', uid).eq('is_company', false).gte('den_ngay', tuanTu).lte('tu_ngay', tuanDen);
        const okrIds = (data ?? []).map((o: any) => o.id);
        if (okrIds.length) {
          const { data: krs } = await supabase.from('okr_key_results').select('id, noi_dung').in('okr_id', okrIds).order('sort_order');
          setMyKRs((krs ?? []) as any);
        } else setMyKRs([]);
      } catch {
        setMyKRs([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  function setItem(idx: number, patch: Partial<PlanItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addRow() {
    setItems((prev) => [...prev, { cong_viec: '', kq_can_dat: '', ngay_list: '', uu_tien: 'Trung bình', kr_id: '' }]);
  }
  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function toggleDay(idx: number, d: (typeof DAYS)[number]) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const cur = parseDays(it.ngay_list);
        const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
        return { ...it, ngay_list: joinDays(next) };
      }),
    );
  }

  async function save() {
    const clean = items
      .map((it, i) => ({ ...it, sort_order: i, cong_viec: it.cong_viec.trim(), kq_can_dat: it.kq_can_dat.trim() }))
      .filter((it) => it.cong_viec);
    if (!mucTieu.trim()) {
      setMsg('Chưa nhập Mục tiêu tuần này.');
      return;
    }
    if (clean.length === 0) {
      setMsg('Thêm ít nhất 1 công việc.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const uid = userId || (await supabase.auth.getUser()).data.user?.id || '';
      if (!uid) {
        setMsg('Chưa đăng nhập');
        setBusy(false);
        return;
      }
      // upsert bảng cha
      const payload: any = {
        user_id: uid,
        tuan_tu: tuanTu,
        tuan_den: tuanDen,
        muc_tieu_tuan: mucTieu.trim(),
        noi_dung: mucTieu.trim(),
      };
      let planId = edit?.id;
      if (planId) {
        const { error } = await supabase.from('weekly_plans').update(payload).eq('id', planId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from('weekly_plans').insert(payload).select('id').single();
        if (error) throw new Error(error.message);
        planId = (data as any).id;
      }
      // xóa items cũ rồi insert lại (ghi đè)
      if (edit?.items?.length) {
        await supabase.from('weekly_plan_items').delete().eq('plan_id', planId);
      }
      const rows = clean.map((it, i) => ({
        plan_id: planId!,
        cong_viec: it.cong_viec,
        kq_can_dat: it.kq_can_dat,
        ngay_list: it.ngay_list,
        uu_tien: it.uu_tien,
        kr_id: it.kr_id || null,
        sort_order: i,
      }));
      const { error: eItems } = await supabase.from('weekly_plan_items').insert(rows);
      if (eItems) throw new Error(eItems.message);
      // audit + telegram
      try {
        const me2 = (await supabase.from('profiles').select('full_name').eq('id', uid).single()).data;
        await supabase.from('audit_logs').insert({
          actor_id: uid,
          action: edit ? 'Sửa kế hoạch tuần' : 'Gửi kế hoạch tuần',
          entity_type: 'weekly_plan',
          entity_id: planId,
          details: { tuan_tu: tuanTu, muc_tieu: mucTieu.trim(), so_viec: rows.length, full_name: (me2 as any)?.full_name ?? '' },
        });
      } catch {}
      try {
        const nm = (await supabase.from('profiles').select('full_name').eq('id', uid).single()).data?.full_name ?? '';
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventKey: 'TB_KE_HOACH_TUAN', text: `[Ke hoach tuan] ${nm}\nTuan ${tuanTu} -> ${tuanDen}\nMuc tieu: ${mucTieu.trim().slice(0, 200)}\nSo viec: ${rows.length}` }),
        });
      } catch {}
      onDone();
      onClose();
    } catch (e: any) {
      setMsg(e?.message ?? 'Lỗi lưu kế hoạch');
    } finally {
      setBusy(false);
    }
  }

  const late = edit ? isLate(edit.created_at, deadlineKH(tuanTu)) : false;

  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';
  const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700';

  return (
    <Dialog open={open} onClose={onClose} title={edit ? 'Sửa kế hoạch tuần' : 'Kế hoạch tuần'}>
      <div className="grid gap-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Tuần: {tuanTu} → {tuanDen} · Hạn nộp: 17h30 T7 tuần trước
          {edit && late && <span className="ml-2 font-semibold text-red-600">Lần nộp đầu đã trễ</span>}
          {edit && !late && <span className="ml-2 font-semibold text-emerald-700">Đúng hạn</span>}
        </div>

        <div>
          <label className={LABEL}>Mục tiêu tuần này *</label>
          <GrowArea value={mucTieu} onChange={(e) => setMucTieu(e.target.value)} placeholder="Tuần này bạn muốn đạt được điều gì? Gắn với OKR tháng/quý." className={`${sel} w-full`} rows={2} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={LABEL}>Công việc trong tuần *</label>
            <span className="text-xs text-slate-500">{items.length} việc</span>
          </div>
          <div className="grid gap-3">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Công việc *</label>
                    <GrowArea value={it.cong_viec} onChange={(e) => setItem(idx, { cong_viec: e.target.value })} placeholder="VD: Gặp KH ABC chốt đơn" className={`${sel} w-full`} rows={2} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Kết quả cần đạt</label>
                    <GrowArea value={it.kq_can_dat} onChange={(e) => setItem(idx, { kq_can_dat: e.target.value })} placeholder="VD: 2 đơn" className={`${sel} w-full`} rows={2} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div>
                    <span className="mr-2 text-xs font-semibold text-slate-600">Ngày dự kiến:</span>
                    {DAYS.map((d) => {
                      const on = parseDays(it.ngay_list).includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(idx, d)}
                          className={`mr-1 rounded-md px-2 py-1 text-xs font-semibold ring-1 ${on ? 'bg-[#1e3a8a] text-white ring-[#1e3a8a]' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <label className="mr-1 text-xs font-semibold text-slate-600">Ưu tiên:</label>
                    <select value={it.uu_tien} onChange={(e) => setItem(idx, { uu_tien: e.target.value as any })} className={`${sel} w-auto`}>
                      {UU_TIEN.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mr-1 text-xs font-semibold text-slate-600">Gắn KR:</label>
                    <select value={it.kr_id} onChange={(e) => setItem(idx, { kr_id: e.target.value })} className={`${sel} w-auto`}>
                      <option value="">—</option>
                      {myKRs.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.noi_dung}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={() => removeRow(idx)} disabled={items.length <= 1} className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} className="mt-2 text-xs font-semibold text-[#1e3a8a] hover:underline">
            + Thêm công việc
          </button>
        </div>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            Hủy
          </button>
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
            {busy ? 'Đang lưu…' : 'Lưu kế hoạch'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
