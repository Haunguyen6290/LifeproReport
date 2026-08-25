'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { deadlineBC, isLate } from '@/lib/week';

export type ReportItemDraft = {
  id?: string;
  plan_item_id: string;
  cong_viec: string; // read-only từ kế hoạch
  kq_can_dat: string; // read-only
  viec_da_lam: string;
  phan_tram: string;
  tu_danh_gia: 'Hoàn thành' | 'Hoàn thành một phần' | 'Chưa xong';
  nguyen_nhan: string;
};

export type ReportData = {
  id: string;
  user_id: string;
  tuan_tu: string;
  tuan_den: string;
  tu_danh_gia: string;
  ty_le_ht: number | null;
  diem_noi_bat: string;
  kho_khan: string;
  de_xuat: string;
  noi_dung: string;
  created_at: string;
  updated_at: string;
  trang_thai_duyet: string;
  y_kien_quan_ly: string;
  items: ReportItemDraft[];
};

const TU_DG = ['Hoàn thành', 'Hoàn thành một phần', 'Chưa xong'] as const;

export function ReportDialog({
  open,
  onClose,
  tuanTu,
  tuanDen,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tuanTu: string;
  tuanDen: string;
  onDone: () => void;
}) {
  const { userId } = useAuth();
  const [hasPlan, setHasPlan] = useState(false);
  const [planMucTieu, setPlanMucTieu] = useState('');
  const [rows, setRows] = useState<ReportItemDraft[]>([]);
  const [tuDanhGia, setTuDanhGia] = useState('Đạt');
  const [tyLe, setTyLe] = useState('');
  const [noiBat, setNoiBat] = useState('');
  const [khoKhan, setKhoKhan] = useState('');
  const [deXuat, setDeXuat] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [lateHint, setLateHint] = useState('');
  const [existing, setExisting] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!open) return;
    setMsg('');
    setLateHint('');
    (async () => {
      const uid = userId || (await supabase.auth.getUser()).data.user?.id || '';
      if (!uid) return;
      // load kế hoạch (khóa báo cáo)
      const { data: plan } = await supabase
        .from('weekly_plans')
        .select('id, muc_tieu_tuan, noi_dung, weekly_plan_items(id, cong_viec, kq_can_dat, sort_order)')
        .eq('user_id', uid)
        .eq('tuan_tu', tuanTu)
        .maybeSingle();
      if (!plan) {
        setHasPlan(false);
        setRows([]);
        return;
      }
      setHasPlan(true);
      setPlanMucTieu((plan as any).muc_tieu_tuan || (plan as any).noi_dung || '');
      // load báo cáo cũ (nếu có) để điền lại khi sửa
      const { data: rep } = await supabase
        .from('weekly_reports')
        .select('id, tu_danh_gia, ty_le_ht, diem_noi_bat, kho_khan, de_xuat, created_at, updated_at, trang_thai_duyet, y_kien_quan_ly, weekly_report_items(id, plan_item_id, viec_da_lam, phan_tram, tu_danh_gia, nguyen_nhan)')
        .eq('user_id', uid)
        .eq('tuan_tu', tuanTu)
        .maybeSingle();
      const repItems = ((rep as any)?.weekly_report_items ?? []) as any[];
      const items = (((plan as any).weekly_plan_items ?? []) as any[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((pi) => {
          const old = repItems.find((r) => r.plan_item_id === pi.id);
          return {
            id: old?.id,
            plan_item_id: pi.id,
            cong_viec: pi.cong_viec,
            kq_can_dat: pi.kq_can_dat ?? '',
            viec_da_lam: old?.viec_da_lam ?? '',
            phan_tram: old?.phan_tram != null ? String(old.phan_tram) : '',
            tu_danh_gia: (old?.tu_danh_gia ?? 'Chưa xong') as any,
            nguyen_nhan: old?.nguyen_nhan ?? '',
          };
        });
      setRows(items);
      if (rep) {
        setExisting(rep as any);
        setTuDanhGia((rep as any).tu_danh_gia || 'Đạt');
        setTyLe((rep as any).ty_le_ht != null ? String((rep as any).ty_le_ht) : '');
        setNoiBat((rep as any).diem_noi_bat ?? '');
        setKhoKhan((rep as any).kho_khan ?? '');
        setDeXuat((rep as any).de_xuat ?? '');
      } else {
        setExisting(null);
        setTuDanhGia('Đạt');
        setTyLe('');
        setNoiBat('');
        setKhoKhan('');
        setDeXuat('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tuanTu]);

  function setRow(idx: number, patch: Partial<ReportItemDraft>) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      // tự tính % trung bình
      const nums = next.map((r) => Number(r.phan_tram)).filter((n) => !isNaN(n));
      if (nums.length) setTyLe(String(Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)));
      return next;
    });
  }

  async function save() {
    if (!hasPlan) {
      setMsg('Hãy gửi Kế hoạch tuần trước đã.');
      return;
    }
    const clean = rows.filter((r) => r.cong_viec);
    for (const r of clean) {
      if (!r.viec_da_lam.trim()) {
        setMsg(`Chưa nhập "Việc đã làm được" cho: ${r.cong_viec}`);
        return;
      }
      const pct = r.phan_tram === '' ? 0 : Number(r.phan_tram);
      if (pct < 100 || r.tu_danh_gia !== 'Hoàn thành') {
        if (!r.nguyen_nhan.trim()) {
          setMsg(`Chưa nhập "Nguyên nhân chưa đạt" cho: ${r.cong_viec}`);
          return;
        }
      }
    }
    setBusy(true);
    setMsg('');
    setLateHint('');
    try {
      const uid = userId || (await supabase.auth.getUser()).data.user?.id || '';
      if (!uid) {
        setMsg('Chưa đăng nhập');
        setBusy(false);
        return;
      }
      const summary = `Mục tiêu: ${planMucTieu}\nTự đánh giá: ${tuDanhGia} · %HT: ${tyLe || 0}\nĐiểm nổi bật: ${noiBat}\nKhó khăn: ${khoKhan}\nĐề xuất: ${deXuat}`;
      const payload: any = {
        user_id: uid,
        tuan_tu: tuanTu,
        tuan_den: tuanDen,
        tu_danh_gia: tuDanhGia,
        ty_le_ht: tyLe === '' ? null : Number(tyLe),
        diem_noi_bat: noiBat.trim(),
        kho_khan: khoKhan.trim(),
        de_xuat: deXuat.trim(),
        noi_dung: summary,
      };
      let reportId = existing?.id;
      if (reportId) {
        const { error } = await supabase.from('weekly_reports').update(payload).eq('id', reportId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from('weekly_reports').insert(payload).select('id, created_at').single();
        if (error) throw new Error(error.message);
        reportId = (data as any).id;
      }
      if (existing?.items?.length) {
        await supabase.from('weekly_report_items').delete().eq('report_id', reportId);
      }
      const itemRows = clean.map((r, i) => ({
        report_id: reportId!,
        plan_item_id: r.plan_item_id || null,
        viec_da_lam: r.viec_da_lam.trim(),
        phan_tram: r.phan_tram === '' ? null : Number(r.phan_tram),
        tu_danh_gia: r.tu_danh_gia,
        nguyen_nhan: r.nguyen_nhan.trim(),
        sort_order: i,
      }));
      if (itemRows.length) {
        const { error: eIt } = await supabase.from('weekly_report_items').insert(itemRows);
        if (eIt) throw new Error(eIt.message);
      }
      // late hint theo created_at lần đầu
      const createdAt = existing?.created_at ?? (await supabase.from('weekly_reports').select('created_at').eq('id', reportId).maybeSingle()).data?.created_at;
      if (createdAt && isLate(createdAt, deadlineBC(tuanTu))) {
        setLateHint('Bạn đã nộp trễ so với thời gian quy định (hạn là 17h30 Thứ 2). Vẫn đã lưu, hãy cố đúng hạn tuần sau.');
      }
      try {
        const me2 = (await supabase.from('profiles').select('full_name').eq('id', uid).single()).data;
        await supabase.from('audit_logs').insert({
          actor_id: uid,
          action: existing ? 'Sửa báo cáo tuần' : 'Gửi báo cáo tuần',
          entity_type: 'weekly_report',
          entity_id: reportId,
          details: { tuan_tu: tuanTu, ty_le_ht: tyLe, full_name: (me2 as any)?.full_name ?? '' },
        });
      } catch {}
      try {
        const nm = (await supabase.from('profiles').select('full_name').eq('id', uid).single()).data?.full_name ?? '';
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventKey: 'TB_BAO_CAO_TUAN', text: `[Bao cao tuan] ${nm}\nTuan ${tuanTu} -> ${tuanDen}\nTu danh gia: ${tuDanhGia} · %HT: ${tyLe || 0}` }),
        });
      } catch {}
      onDone();
      if (!lateHint) onClose();
    } catch (e: any) {
      setMsg(e?.message ?? 'Lỗi lưu báo cáo');
    } finally {
      setBusy(false);
    }
  }

  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] disabled:opacity-60';
  const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700';

  return (
    <Dialog open={open} onClose={onClose} title="Báo cáo tuần">
      {!hasPlan ? (
        <div className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          Tuần này bạn <b>chưa có Kế hoạch tuần</b>. Hãy gửi Kế hoạch trước, sau đó mới làm Báo cáo.
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Tuần: {tuanTu} → {tuanDen} · Hạn nộp: 17h30 T2 sau tuần
          </div>

          <div>
            <label className={LABEL}>Mục tiêu tuần đã đặt (từ kế hoạch)</label>
            <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{planMucTieu || '—'}</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Tự đánh giá mục tiêu tuần *</label>
              <select value={tuDanhGia} onChange={(e) => setTuDanhGia(e.target.value)} className={sel}>
                <option>Đạt</option>
                <option>Đạt một phần</option>
                <option>Chưa đạt</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Tỷ lệ hoàn thành chung (%)</label>
              <input value={tyLe} onChange={(e) => setTyLe(e.target.value)} type="number" min={0} max={100} className={sel} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={LABEL}>Kết quả từng công việc *</label>
              <span className="text-xs text-slate-500">{rows.length} việc</span>
            </div>
            <div className="grid gap-3">
              {rows.map((r, idx) => (
                <div key={r.plan_item_id ?? idx} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    <b>KH:</b> {r.cong_viec}
                    {r.kq_can_dat ? ` · KQ cần đạt: ${r.kq_can_dat}` : ''}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Việc đã làm được *</label>
                      <GrowArea value={r.viec_da_lam} onChange={(e) => setRow(idx, { viec_da_lam: e.target.value })} placeholder="Đã làm gì…" className={`${sel} w-full`} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">% HT</label>
                        <input value={r.phan_tram} onChange={(e) => setRow(idx, { phan_tram: e.target.value })} type="number" min={0} max={100} className={sel} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Tự đánh giá *</label>
                        <select value={r.tu_danh_gia} onChange={(e) => setRow(idx, { tu_danh_gia: e.target.value as any })} className={sel}>
                          {TU_DG.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {(Number(r.phan_tram) < 100 || r.tu_danh_gia !== 'Hoàn thành') && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs font-semibold text-red-600">Nguyên nhân chưa đạt *</label>
                      <GrowArea value={r.nguyen_nhan} onChange={(e) => setRow(idx, { nguyen_nhan: e.target.value })} placeholder="Vì sao chưa đạt…" className={`${sel} w-full`} rows={2} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Điểm nổi bật</label>
              <GrowArea value={noiBat} onChange={(e) => setNoiBat(e.target.value)} className={`${sel} w-full`} rows={2} />
            </div>
            <div>
              <label className={LABEL}>Khó khăn / vướng mắc</label>
              <GrowArea value={khoKhan} onChange={(e) => setKhoKhan(e.target.value)} className={`${sel} w-full`} rows={2} />
            </div>
            <div>
              <label className={LABEL}>Đề xuất / kiến nghị</label>
              <GrowArea value={deXuat} onChange={(e) => setDeXuat(e.target.value)} className={`${sel} w-full`} rows={2} />
            </div>
          </div>

          {lateHint && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">{lateHint}</p>}
          {msg && <p className="text-sm text-red-600">{msg}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              Hủy
            </button>
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
              {busy ? 'Đang lưu…' : existing ? 'Cập nhật' : 'Gửi báo cáo'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
