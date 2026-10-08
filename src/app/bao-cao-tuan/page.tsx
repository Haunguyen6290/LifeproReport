'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { PlanDialog, type PlanData } from '@/components/PlanDialog';
import { PlanCard } from '@/components/PlanCard';
import { ReportDialog, type ReportData } from '@/components/ReportDialog';
import { ReportCard } from '@/components/ReportCard';
import { Selectable } from '@/components/Selectable';
import { weekBounds, deadlineKH, deadlineBC, isLate } from '@/lib/week';
import { fmtCommentTimeVN, fmtDateVN } from '@/lib/time';

type WeeklyRow = {
  id: string;
  user_id: string;
  tuan_tu: string;
  tuan_den: string;
  noi_dung: string;
  created_at: string;
  updated_at: string;
};

type ProfileMap = Map<string, string>;

function Badge({ late }: { late: boolean }) {
  return late ? (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Trễ hạn</span>
  ) : (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Đúng hạn</span>
  );
}

/** 'Tuần 14/09 – 19/09' (dd/mm của T2 → T7) */
function dm(s: string): string {
  if (!s) return '—';
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

function shiftDate(s: string, days: number): string {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Screen() {
  const { userId, can } = useAuth();
  const canManage = can('quan_ly_okr');
  const defaults = useMemo(() => weekBounds(new Date()), []);
  const [tu, setTu] = useState(defaults.tu);
  const [den, setDen] = useState(defaults.den);
  // Bộ chọn tuần: 'this' = Tuần này (mặc định), 'last' = Tuần trước, 'custom' = Chọn ngày bất kỳ → snap về tuần chứa ngày đó
  const [tuanMode, setTuanMode] = useState<'this' | 'last' | 'custom'>('this');
  const [customPick, setCustomPick] = useState(defaults.tu);
  const [tab, setTab] = useState<'plan' | 'report'>('plan');
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>(new Map());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [openPlan, setOpenPlan] = useState(false);
  const [editPlan, setEditPlan] = useState<PlanData | null>(null);
  const [openReport, setOpenReport] = useState(false);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [expandReportId, setExpandReportId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function setWeekBounds(b: { tu: string; den: string }) {
    setTu(b.tu);
    setDen(b.den);
  }

  function onModeChange(mode: 'this' | 'last' | 'custom') {
    setTuanMode(mode);
    const now = new Date();
    if (mode === 'this') setWeekBounds(weekBounds(now));
    else if (mode === 'last') setWeekBounds(weekBounds(new Date(shiftDate(now.toISOString().slice(0, 10), -7) + 'T00:00:00Z')));
    else setWeekBounds(weekBounds(new Date(customPick + 'T00:00:00Z')));
  }

  function onWeekChange(newTu: string) {
    setWeekBounds(weekBounds(new Date(newTu + 'T00:00:00Z')));
  }

  /** 'Tuần 14/09 – 19/09' */
  function tuanLabel(): string {
    if (!tu || !den) return '';
    return `Tuần ${dm(tu)} – ${dm(den)}`;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tu) return;
      setLoading(true);
      setMsg('');
      try {
        const [pRes, rRes] = await Promise.all([
          supabase.from('weekly_plans').select('id, user_id, tuan_tu, tuan_den, muc_tieu_tuan, noi_dung, created_at, updated_at, trang_thai_duyet, y_kien_quan_ly, weekly_plan_items(id, cong_viec, kq_can_dat, ngay_list, uu_tien, kr_id, sort_order)').eq('tuan_tu', tu).order('created_at', { ascending: true }),
          supabase.from('weekly_reports').select('id, user_id, tuan_tu, tuan_den, tu_danh_gia, ty_le_ht, diem_noi_bat, kho_khan, de_xuat, noi_dung, created_at, updated_at, trang_thai_duyet, y_kien_quan_ly, weekly_report_items(id, plan_item_id, viec_da_lam, phan_tram, tu_danh_gia, nguyen_nhan, sort_order)').eq('tuan_tu', tu).order('created_at', { ascending: true }),
        ]);
        if (cancelled) return;
        if (pRes.error) setMsg(pRes.error.message);
        else if (rRes.error) setMsg(rRes.error.message);
        const pList = ((pRes.data ?? []) as any[]).map((p) => ({
          id: p.id,
          user_id: p.user_id,
          tuan_tu: p.tuan_tu,
          tuan_den: p.tuan_den,
          muc_tieu_tuan: p.muc_tieu_tuan ?? '',
          noi_dung: p.noi_dung ?? '',
          created_at: p.created_at,
          updated_at: p.updated_at,
          trang_thai_duyet: p.trang_thai_duyet ?? 'Chờ duyệt',
          y_kien_quan_ly: p.y_kien_quan_ly ?? '',
          items: ((p.weekly_plan_items ?? []) as any[]).sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ id: i.id, cong_viec: i.cong_viec, kq_can_dat: i.kq_can_dat ?? '', ngay_list: i.ngay_list ?? '', uu_tien: i.uu_tien, kr_id: i.kr_id ?? '' })),
        })) as PlanData[];
        setPlans(pList);
        const planItemMap = new Map<string, { cong_viec: string; kq_can_dat: string }>();
        for (const p of pList) for (const it of p.items) planItemMap.set(it.id!, { cong_viec: it.cong_viec, kq_can_dat: it.kq_can_dat });
        const rList = ((rRes.data ?? []) as any[]).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          tuan_tu: r.tuan_tu,
          tuan_den: r.tuan_den,
          tu_danh_gia: r.tu_danh_gia ?? '',
          ty_le_ht: r.ty_le_ht ?? null,
          diem_noi_bat: r.diem_noi_bat ?? '',
          kho_khan: r.kho_khan ?? '',
          de_xuat: r.de_xuat ?? '',
          noi_dung: r.noi_dung ?? '',
          created_at: r.created_at,
          updated_at: r.updated_at,
          trang_thai_duyet: r.trang_thai_duyet ?? 'Chờ duyệt',
          y_kien_quan_ly: r.y_kien_quan_ly ?? '',
          items: ((r.weekly_report_items ?? []) as any[]).sort((a, b) => a.sort_order - b.sort_order).map((i) => {
            const kh = planItemMap.get(i.plan_item_id) ?? { cong_viec: '', kq_can_dat: '' };
            return { id: i.id, plan_item_id: i.plan_item_id ?? '', cong_viec: kh.cong_viec, kq_can_dat: kh.kq_can_dat, viec_da_lam: i.viec_da_lam ?? '', phan_tram: i.phan_tram != null ? String(i.phan_tram) : '', tu_danh_gia: i.tu_danh_gia, nguyen_nhan: i.nguyen_nhan ?? '' };
          }),
        })) as ReportData[];
        setReports(rList);
        const allIds = Array.from(new Set([...pList, ...rList].map((x: any) => x.user_id).filter(Boolean)));
        if (allIds.length) {
          const { data: profData } = await supabase.from('profiles').select('id, full_name, username').in('id', allIds);
          if (cancelled) return;
          const m: ProfileMap = new Map();
          for (const p of (profData ?? []) as any[]) m.set(p.id, p.full_name || p.username || p.id.slice(0, 8));
          setProfiles(m);
        } else setProfiles(new Map());
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message ?? 'Lỗi tải dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tu, refreshKey]);

  const myPlan = plans.find((p) => p.user_id === userId) ?? null;
  const myReport = reports.find((r) => r.user_id === userId) ?? null;

  function onDone() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Báo cáo tuần</h1>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setEditPlan(myPlan); setOpenPlan(true); }} className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-hover)]">
              {myPlan ? 'Sửa kế hoạch tuần' : '+ Kế hoạch tuần'}
            </button>
            <button
              onClick={() => setOpenReport(true)}
              disabled={!myPlan}
              title={myPlan ? 'Làm báo cáo tuần' : 'Hãy gửi Kế hoạch tuần trước'}
              className="rounded-lg border border-[#1e3a8a] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e3a8a] shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {myReport ? 'Sửa báo cáo tuần' : '+ Báo cáo tuần'}
            </button>
          </div>
        </div>
        {!myPlan && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">Chưa có Kế hoạch tuần — hãy gửi kế hoạch trước rồi mới làm Báo cáo.</p>}

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Tuần</label>
              <select
                value={tuanMode}
                onChange={(e) => onModeChange(e.target.value as 'this' | 'last' | 'custom')}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
              >
                <option value="this">Tuần này</option>
                <option value="last">Tuần trước</option>
                <option value="custom">Chọn tuần khác…</option>
              </select>
            </div>
            {tuanMode === 'custom' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Ngày bất kỳ trong tuần</label>
                <input
                  type="date"
                  value={customPick}
                  onChange={(e) => {
                    setCustomPick(e.target.value);
                    if (e.target.value) onWeekChange(e.target.value);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
                />
              </div>
            )}
            <div className="pb-2 text-sm font-semibold text-slate-900">{tuanLabel()}</div>
            <div className="pb-2 text-xs text-slate-600">{tu && den ? `Từ ${fmtDateVN(tu)} đến ${fmtDateVN(den)}` : '—'}</div>
            <div className="pb-2 text-xs text-slate-500">Hạn KH: 17h30 T7 trước tuần · Hạn BC: 17h30 T2 sau tuần</div>
          </div>
        </div>

        <PlanDialog open={openPlan} onClose={() => { setOpenPlan(false); setEditPlan(null); }} tuanTu={tu} tuanDen={den} edit={editPlan} onDone={onDone} />
        <ReportDialog open={openReport} onClose={() => setOpenReport(false)} tuanTu={tu} tuanDen={den} onDone={onDone} />

        <div className="mb-3 flex gap-2">
          <button onClick={() => setTab('plan')} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'plan' ? 'bg-[#0f2a4a] text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            Kế hoạch ({plans.length})
          </button>
          <button onClick={() => setTab('report')} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'report' ? 'bg-[#0f2a4a] text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            Báo cáo ({reports.length})
          </button>
        </div>

        {msg && <p className="mb-3 text-sm text-red-600">{msg}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-600">Đang tải…</p>
        ) : tab === 'plan' ? (
          canManage ? (
            // Quản lý: bảng gọn, bấm 1 hàng nở thành card
            plans.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Chưa có kế hoạch trong tuần này.</div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
                        <th className="px-3 py-2">Người nộp</th>
                        <th className="px-3 py-2">Mục tiêu</th>
                        <th className="px-3 py-2">Số việc</th>
                        <th className="px-3 py-2">Báo cáo</th>
                        <th className="px-3 py-2">Nộp</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plans.map((p) => {
                        const late = isLate(p.created_at, deadlineKH(tu));
                        const hasBC = reports.some(r => r.user_id === p.user_id);
                        return (
                          <Selectable key={p.id} as="tr" onOpen={() => setExpandId((v) => (v === p.id ? null : p.id))} className="cursor-pointer align-top hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-900">{profiles.get(p.user_id) ?? p.user_id.slice(0, 8)}</td>
                            <td className="max-w-[280px] px-3 py-2 text-slate-800">{p.muc_tieu_tuan || p.noi_dung}</td>
                            <td className="px-3 py-2 text-slate-700">{p.items.length}</td>
                            <td className="px-3 py-2">{hasBC ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Có báo cáo</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Chưa có</span>}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-700">{fmtCommentTimeVN(p.created_at)}</td>
                            <td className="whitespace-nowrap px-3 py-2"><Badge late={late} /></td>
                            <td className="px-3 py-2 text-xs text-[#1e3a8a]">{expandId === p.id ? 'Thu gọn' : 'Xem'}</td>
                          </Selectable>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {expandId && (() => {
                  const p = plans.find((x) => x.id === expandId);
                  if (!p) return null;
                  const r = reports.find(x => x.user_id === p.user_id) ?? null;
                  return <PlanCard plan={p} ownerName={profiles.get(p.user_id) ?? ''} onEdit={() => { setEditPlan(p); setOpenPlan(true); }} onDone={onDone} pairedReport={r} pairedReportOwnerName={r ? (profiles.get(r.user_id) ?? '') : undefined} onEditReport={r ? () => setOpenReport(true) : undefined} />;
                })()}
              </div>
            )
          ) : myPlan ? (
            (() => { const r = reports.find(x => x.user_id === myPlan.user_id) ?? null; return <PlanCard plan={myPlan} ownerName={profiles.get(myPlan.user_id) ?? ''} onEdit={() => { setEditPlan(myPlan); setOpenPlan(true); }} onDone={onDone} pairedReport={r} pairedReportOwnerName={r ? (profiles.get(r.user_id) ?? '') : undefined} onEditReport={r ? () => setOpenReport(true) : undefined} />; })()
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Bạn chưa có kế hoạch tuần này. Bấm <b>+ Kế hoạch tuần</b> để tạo.
            </div>
          )
        ) : canManage ? (
          reports.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Chưa có báo cáo trong tuần này.</div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
                      <th className="px-3 py-2">Người nộp</th>
                      <th className="px-3 py-2">Tự đánh giá</th>
                      <th className="px-3 py-2">% HT</th>
                      <th className="px-3 py-2">Nộp</th>
                      <th className="px-3 py-2">Trạng thái</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((r) => {
                      const late = isLate(r.created_at, deadlineBC(tu));
                      return (
                        <Selectable key={r.id} as="tr" onOpen={() => setExpandReportId((v) => (v === r.id ? null : r.id))} className="cursor-pointer align-top hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">{profiles.get(r.user_id) ?? r.user_id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-slate-800">{r.tu_danh_gia || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{r.ty_le_ht != null ? `${r.ty_le_ht}%` : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">{fmtCommentTimeVN(r.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-2"><Badge late={late} /></td>
                          <td className="px-3 py-2 text-xs text-[#1e3a8a]">{expandReportId === r.id ? 'Thu gọn' : 'Xem'}</td>
                        </Selectable>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {expandReportId && (() => {
                const r = reports.find((x) => x.id === expandReportId);
                if (!r) return null;
                const p = plans.find(x => x.user_id === r.user_id) ?? null;
                return <ReportCard report={r} ownerName={profiles.get(r.user_id) ?? ''} onEdit={() => setOpenReport(true)} onDone={onDone} pairedPlan={p} pairedPlanOwnerName={p ? (profiles.get(p.user_id) ?? '') : undefined} />;
              })()}
            </div>
          )
        ) : myReport ? (
          (() => { const p = plans.find(x => x.user_id === myReport.user_id) ?? null; return <ReportCard report={myReport} ownerName={profiles.get(myReport.user_id) ?? ''} onEdit={() => setOpenReport(true)} onDone={onDone} pairedPlan={p} pairedPlanOwnerName={p ? (profiles.get(p.user_id) ?? '') : undefined} />; })()
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {myPlan ? 'Bạn chưa có báo cáo tuần này. Bấm + Báo cáo tuần để tạo.' : 'Hãy gửi Kế hoạch tuần trước rồi mới làm Báo cáo.'}
          </div>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Screen />
    </RequireAuth>
  );
}
