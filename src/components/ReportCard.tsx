'use client';
import { deadlineBC, isLate, deadlineKH, parseDays } from '@/lib/week';
import { fmtCommentTimeVN, fmtDateVN } from '@/lib/time';
import { useAuth } from '@/components/RequireAuth';
import { ReportReviewBox } from '@/components/ReportReviewBox';
import type { ReportData } from '@/components/ReportDialog';
import type { PlanData } from '@/components/PlanDialog';

export function ReportCard({
  report,
  ownerName,
  onEdit,
  onDone,
  pairedPlan,
  pairedPlanOwnerName,
}: {
  report: ReportData;
  ownerName: string;
  onEdit: () => void;
  onDone: () => void;
  pairedPlan?: PlanData | null;
  pairedPlanOwnerName?: string;
}) {
  const { userId, can } = useAuth();
  const locked = report.trang_thai_duyet === 'Đã duyệt';
  const canEdit = can('quan_ly_okr') || (report.user_id === userId && !locked);
  const late = isLate(report.created_at, deadlineBC(report.tuan_tu));
  const edited = report.updated_at && report.created_at && report.updated_at !== report.created_at;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {/* Kế hoạch tuần cùng người — gắn trên đầu báo cáo */}
      {pairedPlan !== undefined && (
        <div className="mb-4 rounded-xl border border-[#1e3a8a]/20 bg-[#f8fafc] p-0">
          <div className="flex items-center justify-between gap-2 border-b border-[#1e3a8a]/10 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1e3a8a]">Kế hoạch tuần — {fmtDateVN(report.tuan_tu)} → {fmtDateVN(report.tuan_den)}</span>
            {pairedPlan && pairedPlanOwnerName ? <span className="text-xs text-slate-500">{pairedPlanOwnerName}</span> : null}
          </div>
          {!pairedPlan ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">Chưa có kế hoạch tuần này.</p>
          ) : (
            <div className="p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{pairedPlan.trang_thai_duyet || 'Chờ duyệt'}</span>
                {isLate(pairedPlan.created_at, deadlineKH(pairedPlan.tuan_tu)) ? <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">Trễ hạn</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Đúng hạn</span>}
                <span className="text-slate-500">Nộp {fmtCommentTimeVN(pairedPlan.created_at)}{pairedPlan.updated_at !== pairedPlan.created_at ? ` · sửa ${fmtCommentTimeVN(pairedPlan.updated_at)}` : ''}</span>
              </div>
              <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-800"><span className="font-semibold text-slate-700">Mục tiêu:</span> {pairedPlan.muc_tieu_tuan || pairedPlan.noi_dung || '—'}</p>
              {pairedPlan.items.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pairedPlan.items.map((it, i) => {
                    const days = parseDays(it.ngay_list);
                    return (
                    <div key={it.id ?? i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white p-2.5">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${{ Cao: 'bg-red-500', 'Trung bình': 'bg-amber-400', Thấp: 'bg-slate-300' }[it.uu_tien] ?? 'bg-amber-400'}`} />
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{it.cong_viec}</p>{it.kq_can_dat && <p className="mt-0.5 text-xs text-slate-600">KQ: {it.kq_can_dat}</p>}</div>
                      <div className="flex shrink-0 gap-1">{(['T2','T3','T4','T5','T6','T7'] as const).map(d => <span key={d} className={`rounded px-1 py-0.5 text-[10px] font-semibold ${days.includes(d) ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-400'}`}>{d}</span>)}</div>
                    </div>);
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{ownerName}</span>
          <span className="text-xs text-slate-500">Tuần {fmtDateVN(report.tuan_tu)} → {fmtDateVN(report.tuan_den)}</span>
          {late ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Trễ hạn</span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Đúng hạn</span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{report.tu_danh_gia || '—'}</span>
          {report.ty_le_ht != null && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{report.ty_le_ht}% HT</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{report.trang_thai_duyet || 'Chờ duyệt'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Nộp {fmtCommentTimeVN(report.created_at)}</span>
          {edited && <span>· sửa lúc {fmtCommentTimeVN(report.updated_at)}</span>}
          {canEdit && (
            <button onClick={onEdit} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
              Sửa
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        {report.diem_noi_bat && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><b>Nổi bật:</b> {report.diem_noi_bat}</div>}
        {report.kho_khan && <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800"><b>Khó khăn:</b> {report.kho_khan}</div>}
        {report.de_xuat && <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800"><b>Đề xuất:</b> {report.de_xuat}</div>}
      </div>

      <div className="mt-3 space-y-2">
        {report.items.map((it, i) => (
          <div key={it.id ?? i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">KH: {it.cong_viec}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-900">{it.viec_da_lam}</p>
                {it.nguyen_nhan && <p className="mt-0.5 text-xs text-red-600">Nguyên nhân: {it.nguyen_nhan}</p>}
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-slate-900">{it.phan_tram != null ? `${it.phan_tram}%` : '—'}</span>
                <span className="block text-xs text-slate-600">{it.tu_danh_gia}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ReportReviewBox reportId={report.id} authorId={report.user_id} trangThai={report.trang_thai_duyet} onDone={onDone} />
    </div>
  );
}
