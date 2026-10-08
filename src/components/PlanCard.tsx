'use client';
import { parseDays, deadlineKH, deadlineBC, isLate } from '@/lib/week';
import { fmtCommentTimeVN, fmtDateVN } from '@/lib/time';
import { useAuth } from '@/components/RequireAuth';
import { ApprovalBox } from '@/components/ApprovalBox';
import type { PlanData } from '@/components/PlanDialog';
import type { ReportData } from '@/components/ReportDialog';

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
  pairedReport,
  pairedReportOwnerName,
  onEditReport,
}: {
  plan: PlanData;
  ownerName: string;
  onEdit: () => void;
  onDone: () => void;
  pairedReport?: ReportData | null;
  pairedReportOwnerName?: string;
  onEditReport?: () => void;
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

      {/* Báo cáo tuần cùng người + cùng tuần — gắn ngay dưới kế hoạch */}
      {pairedReport !== undefined && (
        <div className="mt-4 rounded-xl border border-[#1e3a8a]/20 bg-[#f8fafc] p-0">
          <div className="flex items-center justify-between gap-2 border-b border-[#1e3a8a]/10 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1e3a8a]">Báo cáo tuần — {fmtDateVN(plan.tuan_tu)} → {fmtDateVN(plan.tuan_den)}</span>
            {pairedReport && pairedReportOwnerName ? <span className="text-xs text-slate-500">{pairedReportOwnerName}</span> : null}
          </div>
          {!pairedReport ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">Chưa nộp báo cáo tuần này.</p>
          ) : (
            <div className="p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{pairedReport.tu_danh_gia || '—'}</span>
                {pairedReport.ty_le_ht != null && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{pairedReport.ty_le_ht}% HT</span>}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{pairedReport.trang_thai_duyet || 'Chờ duyệt'}</span>
                {isLate(pairedReport.created_at, deadlineBC(pairedReport.tuan_tu)) ? <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">Trễ hạn</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Đúng hạn</span>}
                <span className="text-slate-500">Nộp {fmtCommentTimeVN(pairedReport.created_at)}{pairedReport.updated_at !== pairedReport.created_at ? ` · sửa ${fmtCommentTimeVN(pairedReport.updated_at)}` : ''}</span>
                {onEditReport && (pairedReport.user_id === userId || can('quan_ly_okr')) && pairedReport.trang_thai_duyet !== 'Đã duyệt' && (
                  <button onClick={onEditReport} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold hover:bg-slate-50">Sửa báo cáo</button>
                )}
              </div>
              {(pairedReport.diem_noi_bat || pairedReport.kho_khan || pairedReport.de_xuat) && (
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  {pairedReport.diem_noi_bat && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><b>Nổi bật:</b> {pairedReport.diem_noi_bat}</div>}
                  {pairedReport.kho_khan && <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800"><b>Khó khăn:</b> {pairedReport.kho_khan}</div>}
                  {pairedReport.de_xuat && <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800"><b>Đề xuất:</b> {pairedReport.de_xuat}</div>}
                </div>
              )}
              {pairedReport.items.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pairedReport.items.map((it, i) => (
                    <div key={it.id ?? i} className="rounded-lg border border-slate-100 bg-white p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">KH: {it.cong_viec || '—'}</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{it.viec_da_lam}</p>
                          {it.nguyen_nhan && <p className="mt-0.5 text-xs text-red-600">Nguyên nhân: {it.nguyen_nhan}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block text-sm font-semibold text-slate-900">{it.phan_tram ? `${it.phan_tram}%` : '—'}</span>
                          <span className="block text-xs text-slate-600">{it.tu_danh_gia || ''}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

