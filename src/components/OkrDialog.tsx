'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { SingleCombobox } from '@/components/SingleCombobox';
import { validateKRs, warnObjective, periodLabel } from '@/lib/okr';
import { loadOkrTemplates, type OkrTemplate } from '@/lib/okr-templates';

export type Period = { tu?: string; den?: string; tu_ngay?: string; den_ngay?: string };

/** Chuẩn hóa prop period — chấp nhận cả {tu,den} lẫn {tu_ngay,den_ngay}. */
export function normalizePeriod(p: Period | undefined | null): { tu: string; den: string } {
  if (!p) return { tu: '', den: '' };
  const tu = (p as any).tu ?? (p as any).tu_ngay ?? '';
  const den = (p as any).den ?? (p as any).den_ngay ?? '';
  return { tu: String(tu ?? ''), den: String(den ?? '') };
}

/** So sánh kỳ hạn — dùng để chặn KR công ty khác kỳ trước khi lưu. */
export function isSamePeriod(parentTu: string, parentDen: string, tu: string, den: string): boolean {
  return String(parentTu ?? '').trim() === String(tu ?? '').trim() && String(parentDen ?? '').trim() === String(den ?? '').trim();
}

/** Cắt bỏ dòng KR rỗng, trim — dùng trước khi validate/lưu. */
export function cleanKrList(krs: string[]): string[] {
  return (krs ?? []).map((s) => String(s ?? '').trim()).filter(Boolean);
}

/** Map danh sách KR -> rows bulk insert okr_key_results. */
export function buildKrRows(
  list: string[],
  okrId: string,
): { okr_id: string; noi_dung: string; sort_order: number }[] {
  return list.map((noi_dung, idx) => ({ okr_id: okrId, noi_dung, sort_order: idx }));
}

export function OkrDialog({
  open,
  onClose,
  onDone,
  isCompany,
  period,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  isCompany: boolean;
  period: Period;
}) {
  const authAny: any = useAuth();
  const authUserId: string = (authAny?.userId ?? '') as string;
  const authRole: string = (authAny?.role ?? '') as string;

  const { tu: initTu, den: initDen } = normalizePeriod(period);
  const [tu, setTu] = useState(initTu);
  const [den, setDen] = useState(initDen);
  const [objective, setObjective] = useState('');
  const [krs, setKrs] = useState<string[]>(['', '']);
  const [parentOkrId, setParentOkrId] = useState('');
  const [companyOkrs, setCompanyOkrs] = useState<{ id: string; objective: string; tu_ngay?: string; den_ngay?: string }[]>([]);
  const [oTemplates, setOTemplates] = useState<OkrTemplate[]>([]);
  const [krTemplates, setKrTemplates] = useState<OkrTemplate[]>([]);
  const [pickOId, setPickOId] = useState('');
  const [pickKrId, setPickKrId] = useState('');
  const [krPickerIdx, setKrPickerIdx] = useState<number | null>(null);
  const [loadingKr, setLoadingKr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const warn = warnObjective(objective);

  useEffect(() => {
    if (!open) return;
    setMsg('');
    const p = normalizePeriod(period);
    setTu(p.tu); setDen(p.den);
    setPickOId('');
    // Load O/KR templates theo vai trò
    if (authRole) {
      loadOkrTemplates('okr_o_template', authRole).then(setOTemplates).catch(() => {});
      loadOkrTemplates('okr_kr_template', authRole).then(setKrTemplates).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  void iso;

  useEffect(() => {
    if (!open || isCompany) return;
    let cancelled = false;
    setLoadingKr(true);
    (async () => {
      try {
        const { data: compOkrs, error: e1 } = await supabase
          .from('okrs')
          .select('id, objective, tu_ngay, den_ngay')
          .eq('is_company', true)
          .eq('is_archived', false)
          .order('tu_ngay', { ascending: false });
        if (cancelled) return;
        if (e1 || !compOkrs || compOkrs.length === 0) {
          setCompanyOkrs([]);
          return;
        }
        setCompanyOkrs((compOkrs as any[]).map((o) => ({ id: o.id as string, objective: o.objective as string, tu_ngay: o.tu_ngay as string, den_ngay: o.den_ngay as string })));
      } catch {
        if (!cancelled) setCompanyOkrs([]);
      } finally {
        if (!cancelled) setLoadingKr(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isCompany]);

  function updateKr(idx: number, val: string) {
    setKrs((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  function addKr() {
    if (krs.length >= 5) return;
    setKrs((prev) => [...prev, '']);
  }

  function removeKr(idx: number) {
    if (krs.length <= 2) return;
    setKrs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function validateOrMsg(): Promise<string | null> {
    if (!tu || !den) {
      const m = 'Chưa chọn kỳ hạn (Từ ngày → Đến ngày)';
      setMsg(m);
      return m;
    }
    const t = objective.trim();
    if (!t) {
      setMsg('Objective không được trống');
      return 'Objective không được trống';
    }
    if (!isCompany && !parentOkrId) {
      setMsg('Phải chọn 1 OKR công ty');
      return 'Phải chọn 1 OKR công ty';
    }
    const list = cleanKrList(krs);
    let oCount = 1;
    try {
      const uidForCount = authUserId || (await supabase.auth.getUser()).data.user?.id || '';
      if (uidForCount && tu && den) {
        const { count, error } = await supabase
          .from('okrs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uidForCount)
          .eq('tu_ngay', tu)
          .eq('den_ngay', den);
        if (!error && typeof count === 'number') oCount = (count ?? 0) + 1;
        else oCount = 1;
      }
    } catch {
      oCount = 1;
    }
    const vr = validateKRs(list, oCount);
    if (!vr.ok) {
      setMsg(vr.msg);
      return vr.msg;
    }
    setMsg('');
    return null;
  }

  async function handleTry() {
    const err = await validateOrMsg();
    if (err) return;
    
    setMsg('Tự kiểm tra: Nếu hoàn thành 100% KR trên, O đã đạt chưa? Nếu chưa — KR còn nhẹ, hãy sửa cho đủ sức nặng rồi bấm Thử lại. Nếu rồi — OKR đã cân, bấm Lưu.');
  }

  async function handleSave() {
    const err = await validateOrMsg();
    if (err) return;
    
    setBusy(true);
    setMsg('');
    try {
      const uid = authUserId || (await supabase.auth.getUser()).data.user?.id || '';
      if (!uid) {
        setMsg('Chưa đăng nhập');
        setBusy(false);
        return;
      }
      const payload: any = {
        user_id: uid,
        tu_ngay: tu,
        den_ngay: den,
        loai_ky_goi_y: '',
        objective: objective.trim(),
        is_company: !!isCompany,
        parent_okr_id: !isCompany ? parentOkrId || null : null,
        parent_kr_id: null,
        trang_thai: 'Mới',
        tien_do: 0,
      };
      const { data: inserted, error: eIns } = await supabase.from('okrs').insert(payload).select('id').single();
      if (eIns || !inserted) {
        setMsg(eIns?.message ?? 'Không tạo được OKR');
        setBusy(false);
        return;
      }
      const okrId = (inserted as any).id as string;
      const list = cleanKrList(krs);
      const rows = buildKrRows(list, okrId);
      if (rows.length > 0) {
        const { error: eKr } = await supabase.from('okr_key_results').insert(rows);
        if (eKr) {
          setMsg(eKr.message);
          setBusy(false);
          return;
        }
      }
      try {
        const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
        await supabase.from('audit_logs').insert({
          actor_id: uid,
          action: isCompany ? 'Tạo OKR công ty' : 'Tạo OKR cá nhân',
          entity_type: 'okr',
          entity_id: okrId,
          details: { objective: objective.trim(), full_name: (me2 as any)?.full_name ?? '', tu, den, tu_ngay: tu, den_ngay: den },
        });
      } catch {}
      try {
        const nm = (await supabase.from('profiles').select('full_name').eq('id', uid).single()).data?.full_name ?? '';
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventKey: 'TB_OKR',
            text: `[OKR ${isCompany ? 'cong ty' : 'ca nhan'}] ${objective.trim().slice(0, 300)}\nNguoi tao: ${nm}\nKy: ${periodLabel(tu, den)}`,
          }),
        });
      } catch {}
      setObjective('');
      setKrs(['', '']);
      setParentOkrId('');
      setBusy(false);
      onDone?.();
      onClose();
    } catch (e: any) {
      setMsg(e?.message ?? 'Lỗi không xác định');
      setBusy(false);
    }
  }

  const sel =
    'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] disabled:opacity-60';
  const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700';

  return (
    <Dialog open={open} onClose={onClose} title={isCompany ? 'Tạo OKR công ty' : 'Tạo OKR cá nhân'}>
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div><label className={LABEL}>Từ ngày *</label><input type="date" value={tu} onChange={(e) => setTu(e.target.value)} className={sel} /></div>
          <div><label className={LABEL}>Đến ngày *</label><input type="date" value={den} onChange={(e) => setDen(e.target.value)} className={sel} /></div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Kỳ: {tu && den ? periodLabel(tu, den) : '—'}
        </div>

        {!isCompany && (
          <div>
            <label className={LABEL}>Chọn 1 OKR công ty *</label>
            <select
              value={parentOkrId}
              onChange={(e) => setParentOkrId(e.target.value)}
              className={sel}
              disabled={loadingKr}
            >
              <option value="">{loadingKr ? 'Đang tải OKR công ty…' : '— Chọn 1 OKR công ty —'}</option>
              {companyOkrs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.objective} · {o.tu_ngay && o.den_ngay ? periodLabel(o.tu_ngay, o.den_ngay) : ''}
                </option>
              ))}
            </select>
            {!loadingKr && companyOkrs.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Chưa có OKR công ty trong kỳ này. Hãy tạo OKR công ty trước.</p>
            )}
          </div>
        )}

        <div>
          <label className={LABEL}>Objective (mục tiêu) *</label>
          {oTemplates.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Chọn O mẫu (theo vai trò của bạn):</span>
              <div className="min-w-[220px] flex-1">
                <SingleCombobox
                  options={oTemplates.map((o) => ({ id: o.id, label: o.name, sub: o.groupLabel }))}
                  value={pickOId}
                  onChange={(id) => {
                    setPickOId(id);
                    if (id) { const t = oTemplates.find((o) => o.id === id); if (t) setObjective(t.name); }
                  }}
                  placeholder="Nhập để tìm O mẫu…"
                />
              </div>
            </div>
          )}
          <GrowArea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="VD: Bứt phá doanh số bán lẻ"
            className={`${sel} w-full`}
            rows={2}
          />
          {warn ? <p className="mt-1 text-xs text-amber-600">{warn}</p> : null}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={LABEL}>Key Results (2-5 KR, mỗi KR phải có số) *</label>
            <span className="text-xs text-slate-500">{krs.length}/5</span>
          </div>
          <div className="grid gap-2">
            {krs.map((kr, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <input
                    value={kr}
                    onChange={(e) => updateKr(idx, e.target.value)}
                    placeholder={`KR ${idx + 1} — VD: Chốt 5 khách mới / Tăng 20%`}
                    className={sel}
                  />
                  {krs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeKr(idx)}
                      aria-label={`Xóa KR ${idx + 1}`}
                      className="shrink-0 rounded-md border border-slate-200 px-2 text-sm hover:bg-slate-50"
                    >
                      ×
                    </button>
                  )}
                </div>
                {krTemplates.length > 0 && (
                  krPickerIdx === idx ? (
                    <SingleCombobox
                      options={krTemplates.map((k) => ({ id: k.id, label: k.name, sub: k.groupLabel }))}
                      value={pickKrId}
                      onChange={(id) => {
                        setPickKrId(id);
                        if (id) { const t = krTemplates.find((k) => k.id === id); if (t) updateKr(idx, t.name); }
                        setKrPickerIdx(null);
                      }}
                      placeholder={`Nhập để tìm KR mẫu cho KR ${idx + 1}…`}
                    />
                  ) : (
                    <button type="button" onClick={() => { setKrPickerIdx(idx); setPickKrId(''); }} className="self-start text-[11px] font-semibold text-[#1e3a8a] hover:underline">
                      + Chọn KR mẫu
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
          {krs.length < 5 && (
            <button type="button" onClick={addKr} className="mt-2 text-xs font-semibold text-[#1e3a8a] hover:underline">
              + Thêm KR
            </button>
          )}
          <p className="mt-1 text-xs text-slate-500">Mỗi KR phải chứa số, %, hoặc “đ”.</p>
        </div>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleTry}
            disabled={busy}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
          >
            Thử OKR
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !objective.trim()}
            className="rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
          >
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
