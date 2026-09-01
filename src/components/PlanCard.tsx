'use client';
import { parseDays, deadlineKH, isLate } from '@/lib/week';
import { fmtCommentTimeVN, fmtDateVN } from '@/lib/time';
import { useAuth } from '@/components/RequireAuth';
import { ApprovalBox } from '@/components/ApprovalBox';
import type { PlanData } from '@/components/PlanDialog';

const UU_DOT: Record<string, string> = {
  Cao: 'bg-red-500',
  'Trung bình': 'bg-amber-400',
  Thấp: 'bg-slate-300',
};

export function PlanCard({
  plan,
  ownerName,
  onEdit,
  onDone,
}: {
  plan: PlanData;
  ownerName: string;
  onEdit: () => void;
  onDone: () => void;
}) {
  const { userId, can } = useAuth();
  const canEdit = can('quan_ly_okr') || plan.user_id === userId;
  const late = isLate(plan.created_at, deadlineKH(plan.tuan_tu));
  const edited = plan.updated_at && plan.created_at && plan.updated_at !== plan.created_at;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{ownerName}</span>
          <span className="text-xs text-slate-500">
            Tuần {fmtDateVN(plan.tuan_tu)} → {fmtDateVN(plan.tuan_den)}
          </span>
          {late ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Trễ hạn</span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Đúng hạn</span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{plan.trang_thai_duyet || 'Chờ duyệt'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Nộp {fmtCommentTimeVN(plan.created_at)}</span>
          {edited && <span>· sửa lúc {fmtCommentTimeVN(plan.updated_at)}</span>}
          {canEdit && (
            <button onClick={onEdit} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
              Sửa
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
        <span className="font-semibold text-slate-700">Mục tiêu tuần:</span> {plan.muc_tieu_tuan || plan.noi_dung}
      </p>

      <div className="mt-3 space-y-2">
        {plan.items.map((it, i) => {
          const days = parseDays(it.ngay_list);
          return (
            <div key={it.id ?? i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${UU_DOT[it.uu_tien] ?? UU_DOT['Trung bình']}`} title={`Ưu tiên ${it.uu_tien}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{it.cong_viec}</p>
                  {it.kq_can_dat && <p className="mt-0.5 text-xs text-slate-600">Kết quả cần đạt: {it.kq_can_dat}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {(['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const).map((d) => (
                    <span key={d} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${days.includes(d) ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ApprovalBox table="weekly_plans" id={plan.id} trangThai={plan.trang_thai_duyet} yKien={plan.y_kien_quan_ly} onDone={onDone} />
    </div>
  );
}

