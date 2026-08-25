'use client';
import { deadlineBC, isLate } from '@/lib/week';
import { fmtCommentTimeVN } from '@/lib/time';
import { useAuth } from '@/components/RequireAuth';
import { ApprovalBox } from '@/components/ApprovalBox';
import type { ReportData } from '@/components/ReportDialog';

export function ReportCard({
  report,
  ownerName,
  onEdit,
  onDone,
}: {
  report: ReportData;
  ownerName: string;
  onEdit: () => void;
  onDone: () => void;
}) {
  const { userId, can } = useAuth();
  const canEdit = can('quan_ly_okr') || report.user_id === userId;
  const late = isLate(report.created_at, deadlineBC(report.tuan_tu));
  const edited = report.updated_at && report.created_at && report.updated_at !== report.created_at;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{ownerName}</span>
          <span className="text-xs text-slate-500">Tuần {report.tuan_tu} → {report.tuan_den}</span>
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

      <ApprovalBox table="weekly_reports" id={report.id} trangThai={report.trang_thai_duyet} yKien={report.y_kien_quan_ly} onDone={onDone} />
    </div>
  );
}
