'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { weekBounds, deadlineKH, deadlineBC, isLate } from '@/lib/week';

type Mode = 'plan' | 'report';

export function WeeklyDialog({
  open,
  onClose,
  mode,
  tuanTu: propTu,
  tuanDen: propDen,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  tuanTu?: string;
  tuanDen?: string;
  onDone?: () => void;
}) {
  const authAny: any = useAuth();
  const authUserId: string = (authAny?.userId ?? '') as string;

  const bounds = weekBounds(new Date());
  const tu = (propTu ?? bounds.tu) as string;
  const den = (propDen ?? bounds.den) as string;

  const [noiDung, setNoiDung] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [lateHint, setLateHint] = useState('');
  const [existingCreatedAt, setExistingCreatedAt] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  const table = mode === 'plan' ? 'weekly_plans' : 'weekly_reports';
  const deadline = mode === 'plan' ? deadlineKH(tu) : deadlineBC(tu);
  const title = mode === 'plan' ? 'Kế hoạch tuần' : 'Báo cáo tuần';
  const labelDeadline =
    mode === 'plan' ? 'Hạn nộp: 17h30 Thứ 7 trước tuần' : 'Hạn nộp: 17h30 Thứ 2 sau tuần';
  const eventKey = mode === 'plan' ? 'TB_KE_HOACH_TUAN' : 'TB_BAO_CAO_TUAN';

  useEffect(() => {
    if (!open) return;
    setMsg('');
    setLateHint('');
    // reset when closed then opened with new week
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setMsg('');
    setLateHint('');
    setExistingCreatedAt(null);
    setExistingId(null);
    (async () => {
      try {
        const uid = authUserId || (await supabase.auth.getUser()).data.user?.id || '';
        if (!uid || !tu) {
          setNoiDung('');
          return;
        }
        const { data, error } = await supabase
          .from(table)
          .select('id, noi_dung, created_at, updated_at')
          .eq('user_id', uid)
          .eq('tuan_tu', tu)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          setNoiDung((data as any).noi_dung ?? '');
          setExistingCreatedAt((data as any).created_at ?? null);
          setExistingId((data as any).id ?? null);
        } else {
          setNoiDung('');
          setExistingCreatedAt(null);
          setExistingId(null);
        }
      } catch {
        if (!cancelled) {
          setNoiDung('');
          setExistingCreatedAt(null);
          setExistingId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tu, table, authUserId]);

  async function handleSave() {
    const t = noiDung.trim();
    if (!t) {
      setMsg('Nội dung không được trống');
      return;
    }
    setBusy(true);
    setMsg('');
    setLateHint('');
    try {
      const uid = authUserId || (await supabase.auth.getUser()).data.user?.id || '';
      if (!uid) {
        setMsg('Chưa đăng nhập');
        setBusy(false);
        return;
      }
      const payload: any = {
        user_id: uid,
        tuan_tu: tu,
        tuan_den: den,
        noi_dung: t,
      };
      const { data: upserted, error: eUp } = await supabase
        .from(table)
        .upsert(payload, { onConflict: 'user_id,tuan_tu' })
        .select('id, created_at, updated_at')
        .single();
      if (eUp || !upserted) {
        setMsg(eUp?.message ?? 'Không lưu được');
        setBusy(false);
        return;
      }
      const createdAt = (upserted as any).created_at as string;
      // keep original created_at for late check if editing; otherwise use newly created time
      const checkBase = existingCreatedAt ?? createdAt;
      const late = isLate(checkBase, deadline);
      if (late) {
        const dlLabel = mode === 'plan' ? '17h30 Thứ 7' : '17h30 Thứ 2';
        setLateHint(
          `Bạn đã nộp trễ so với thời gian quy định (hạn là ${dlLabel}). Vẫn đã lưu, hãy cố đúng hạn tuần sau.`,
        );
      }
      // audit log with full_name snapshot
      try {
        const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
        const fullName = (me2 as any)?.full_name ?? '';
        const action = mode === 'plan' ? 'Lưu kế hoạch tuần' : 'Lưu báo cáo tuần';
        const entityType = mode === 'plan' ? 'weekly_plan' : 'weekly_report';
        const entityId = (upserted as any).id as string;
        await supabase.from('audit_logs').insert({
          actor_id: uid,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details: { tuan_tu: tu, tuan_den: den, noi_dung: t.slice(0, 500), full_name: fullName, changes: { noi_dung: t } },
        });
      } catch {}
      // telegram via /api/telegram with try/catch (không chặn lưu)
      try {
        const { data: me3 } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
        const nm = (me3 as any)?.full_name ?? '';
        const prefix = mode === 'plan' ? '[Kế hoạch tuần]' : '[Báo cáo tuần]';
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventKey,
            text: `${prefix} ${tu} → ${den}\nNgười gửi: ${nm}\n${t.slice(0, 300)}`,
          }),
        });
      } catch {}
      // keep updated existingCreatedAt for next edit in same session
      setExistingCreatedAt(createdAt);
      setExistingId((upserted as any).id as string);
      setBusy(false);
      onDone?.();
      // don't auto-close if late so user sees hint; close after short delay or keep open — spec says still saved, show hint but not block
      // For better UX, keep dialog open when lateHint; otherwise close
      if (!late) {
        onClose();
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Lỗi không xác định');
      setBusy(false);
    }
  }

  const sel =
    'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] disabled:opacity-60';

  return (
    <Dialog open={open} onClose={onClose} title={`${title} — ${tu} → ${den}`}>
      <div className="grid gap-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Tuần: {tu} → {den} · {labelDeadline}
          {existingCreatedAt ? <span className="ml-2 text-slate-500">· đã nộp lúc trước</span> : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Nội dung *
          </label>
          {loading ? (
            <p className="py-2 text-sm text-slate-500">Đang tải…</p>
          ) : (
            <GrowArea
              value={noiDung}
              onChange={(e) => setNoiDung(e.target.value)}
              placeholder={mode === 'plan' ? 'Kế hoạch tuần: việc gì, kết quả cần đạt, ngày nào làm…' : 'Báo cáo tuần: kết quả thực tế, % hoàn thành, tự đánh giá, lý do, đề xuất…'}
              className={`${sel} w-full`}
              rows={3}
            />
          )}
          <p className="mt-1 text-xs text-slate-500">Ghi đè cùng tuần (user_id, tuan_tu). Sửa lại sẽ đè lên bản cũ, lịch sử nằm ở audit_logs.</p>
        </div>

        {lateHint && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">{lateHint}</p>}
        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            {lateHint ? 'Đóng' : 'Hủy'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || loading || !noiDung.trim()}
            className="rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
          >
            {busy ? 'Đang lưu…' : existingId ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
