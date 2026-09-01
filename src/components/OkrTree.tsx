'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { fmtDateVN } from '@/lib/time';
import { periodLabel } from '@/lib/okr';
import { OkrDetailDialog } from '@/components/OkrDetailDialog';

export type OkrRow = {
  id: string;
  user_id: string;
  tu_ngay: string;
  den_ngay: string;
  loai_ky_goi_y: string;
  objective: string;
  is_company: boolean;
  parent_okr_id: string | null;
  is_archived: boolean;
  trang_thai: string;
  tien_do: number;
};
type KrRow = { id: string; okr_id: string; noi_dung: string; sort_order: number };
type ProfileMap = Map<string, string>;

export function OkrTree({ tu, den, readOnly, showArchived }: { tu: string; den: string; readOnly?: boolean; showArchived?: boolean }) {
  const { can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [okrs, setOkrs] = useState<OkrRow[]>([]);
  const [krs, setKrs] = useState<KrRow[]>([]);
  const [checkinCount, setCheckinCount] = useState<Map<string, number>>(new Map());
  const [profiles, setProfiles] = useState<ProfileMap>(new Map());
  const [jobs, setJobs] = useState<ProfileMap>(new Map());
  const [error, setError] = useState('');
  const [selectedCoId, setSelectedCoId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OkrRow | null>(null);
  const [refresh, setRefresh] = useState(0);

  async function restore(o: OkrRow) {
    if (!confirm('Hoàn tác OKR đã lưu trữ này?')) return;
    await supabase.from('okrs').update({ is_archived: false }).eq('id', o.id);
    setRefresh((r) => r + 1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tu || !den) return;
      setLoading(true);
      setError('');
      try {
        const { data: okrData, error: e1 } = await supabase
          .from('okrs')
          .select('id, user_id, tu_ngay, den_ngay, loai_ky_goi_y, objective, is_company, parent_okr_id, is_archived, trang_thai, tien_do')
          .lte('tu_ngay', den)
          .gte('den_ngay', tu)
          .order('is_company', { ascending: false })
          .order('created_at', { ascending: true });
        if (cancelled) return;
        if (e1) { setError(e1.message); setOkrs([]); setKrs([]); setLoading(false); return; }
        const list = (okrData ?? []) as unknown as OkrRow[];
        setOkrs(list);
        if (list.length === 0) { setKrs([]); setProfiles(new Map()); setCheckinCount(new Map()); setLoading(false); return; }
        const ids = list.map((o) => o.id);
        const [krRes, ciRes] = await Promise.all([
          supabase.from('okr_key_results').select('id, okr_id, noi_dung, sort_order').in('okr_id', ids).order('sort_order', { ascending: true }),
          supabase.from('okr_check_ins').select('okr_id').in('okr_id', ids),
        ]);
        if (cancelled) return;
        if (!krRes.error) setKrs((krRes.data ?? []) as unknown as KrRow[]);
        const m = new Map<string, number>();
        for (const c of (ciRes.data ?? []) as any[]) m.set(c.okr_id, (m.get(c.okr_id) ?? 0) + 1);
        setCheckinCount(m);
        const userIds = Array.from(new Set(list.map((o) => o.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const [profRes, bizRes] = await Promise.all([
            supabase.from('profiles').select('id, full_name, username').in('id', userIds),
            supabase.from('customers').select('assigned_to, business_model').in('assigned_to', userIds).limit(200),
          ]);
          if (cancelled) return;
          const pm: ProfileMap = new Map();
          for (const p of (profRes.data ?? []) as any[]) pm.set(p.id, p.full_name || p.username || p.id.slice(0, 8));
          setProfiles(pm);
          // Lấy công việc từ danh mục mo_hinh_kd qua customers.business_model gộp (hoặc ghi business_model trong profiles nếu có)
          const jm: ProfileMap = new Map();
          for (const c of ((bizRes.data ?? []) as any[])) {
            const cur = jm.get(c.assigned_to);
            const val = String(c.business_model ?? '').trim();
            if (val && !cur) jm.set(c.assigned_to, val.split(',')[0].trim());
          }
          setJobs(jm);
        }
      } catch (e: any) { if (!cancelled) setError(e?.message ?? 'Lỗi tải OKR'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tu, den, refresh]);

  useEffect(() => {
    const companyIds = okrs.filter((o) => o.is_company && (showArchived ? true : !o.is_archived)).map((o) => o.id);
    if (companyIds.length === 0) { if (selectedCoId !== null) setSelectedCoId(null); return; }
    if (!selectedCoId || !companyIds.includes(selectedCoId)) setSelectedCoId(companyIds[0]);
  }, [okrs, selectedCoId, showArchived]);

  if (loading) return <p className="py-8 text-center text-sm text-slate-600">Đang tải OKR…</p>;
  if (error) return <p className="py-8 text-center text-sm text-red-600">{error}</p>;
  if (okrs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-slate-700">Chưa có OKR trong kỳ {tu && den ? periodLabel(tu, den) : ''}</p>
        <p className="mt-1 text-xs text-slate-500">Tạo OKR công ty trước, sau đó mỗi cá nhân gắn thẳng vào OKR công ty cùng kỳ hạn.</p>
      </div>
    );
  }

  const companyOkrs = okrs.filter((o) => o.is_company && (showArchived ? true : !o.is_archived));
  const personalOkrs = okrs.filter((o) => !o.is_company && (showArchived ? true : !o.is_archived));
  const krsByOkr = new Map<string, KrRow[]>();
  for (const kr of krs) { const a = krsByOkr.get(kr.okr_id) ?? []; a.push(kr); krsByOkr.set(kr.okr_id, a); }
  const personalByParentOkr = new Map<string, OkrRow[]>();
  for (const po of personalOkrs) { if (!po.parent_okr_id) continue; const a = personalByParentOkr.get(po.parent_okr_id) ?? []; a.push(po); personalByParentOkr.set(po.parent_okr_id, a); }

  const statusBadge: Record<string, string> = { 'Mới': 'bg-slate-100 text-slate-600', 'Đang làm': 'bg-blue-50 text-blue-700', 'Hoàn thành': 'bg-emerald-50 text-emerald-700', 'Chưa đạt': 'bg-red-50 text-red-700' };
  const bar = (pct: number, variant: 'company' | 'personal' = 'company') => (
    <div className="h-2.5 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${variant === 'company' ? 'bg-emerald-500' : 'bg-cyan-500'} transition-all`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );

  if (companyOkrs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Chưa có OKR công ty trong kỳ {periodLabel(tu, den)}.</div>
        {personalOkrs.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">OKR cá nhân (chưa gắn OKR công ty)</h3>
            <ul className="mt-3 space-y-3">{personalOkrs.map((o) => (
              <li key={o.id}><button onClick={() => setDetail(o)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100">
                <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-semibold text-slate-900">🎯 {o.objective}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[o.trang_thai] ?? 'bg-slate-100'}`}>{o.trang_thai}</span></div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600"><span>{profiles.get(o.user_id) ?? ''}</span><span>·</span><span>{checkinCount.get(o.id) ?? 0} check-in</span></div>
                <div className="mt-2 flex items-center gap-2">{bar(o.tien_do, 'personal')}<span className="text-xs text-slate-500">{o.tien_do}%</span></div>
              </button></li>
            ))}</ul>
          </div>
        )}
        {detail && <OkrDetailDialog okr={detail} onClose={() => setDetail(null)} onDone={() => { setDetail(null); }} onRefresh={() => setRefresh((r) => r + 1)} canManage={can('quan_ly_okr')} readOnly={readOnly} />}
      </div>
    );
  }

  const activeCo = companyOkrs.find((o) => o.id === selectedCoId) ?? companyOkrs[0];
  const activeKrs = krsByOkr.get(activeCo.id) ?? [];
  const linkedPersonal = personalByParentOkr.get(activeCo.id) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {companyOkrs.map((co) => (
          <button key={co.id} onClick={() => setSelectedCoId(co.id)} className={`max-w-[360px] rounded-full px-4 py-2 text-left text-sm font-semibold transition ${selectedCoId === co.id ? 'bg-[#1e3a8a] text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            <span className="line-clamp-2">🎯 {co.objective}</span>
          </button>
        ))}
      </div>

      {/* Card công ty — desktop 65% cho cân đối; mobile full-width. Trên là Công ty, dưới là O+KR */}
      <div onClick={() => setDetail(activeCo)} className="mx-auto block w-full max-w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-md sm:max-w-[65%]">
        {(activeCo.is_archived) && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Lưu trữ</span>
            {can('quan_ly_okr') && <button onClick={(e) => { e.stopPropagation(); restore(activeCo); }} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">Hoàn tác</button>}
          </div>
        )}
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#eff6ff] to-white px-4 py-4">
          {/* Mobile: xếp dọc, % + KR + check-in thành 1 hàng dưới cùng. Desktop: 2 cột như cũ */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#0f2a4a] px-2 py-0.5 text-xs font-bold text-white">CÔNG TY</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[activeCo.trang_thai] ?? 'bg-slate-100'}`}>{activeCo.trang_thai}</span>
              </div>
              <p className="mt-1 break-words text-sm font-bold leading-snug text-[#0f2a4a]">🎯 {activeCo.objective}</p>
              <p className="mt-1 text-xs text-slate-600">{periodLabel(activeCo.tu_ngay, activeCo.den_ngay)} {activeCo.loai_ky_goi_y ? `· ${activeCo.loai_ky_goi_y}` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
              <div className="flex items-center gap-2">{bar(activeCo.tien_do)}<span className="text-xs font-semibold text-slate-700">{activeCo.tien_do}%</span></div>
              <span className="text-xs text-slate-500">KR {activeKrs.length} · {checkinCount.get(activeCo.id) ?? 0} check-in</span>
            </div>
          </div>
        </div>
        {activeKrs.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {activeKrs.map((kr, i) => (
              <li key={kr.id} className="px-4 py-2 text-sm text-slate-800">KR{i + 1}: {kr.noi_dung}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Cây cá nhân nối thẳng */}
      <div className="mx-auto h-6 w-0 border-l-2 border-slate-200" aria-hidden />
      {linkedPersonal.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có OKR cá nhân gắn OKR công ty này.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {linkedPersonal.map((po) => {
            const poKrs = krsByOkr.get(po.id) ?? [];
            const job = jobs.get(po.user_id) ?? '';
            return (
              <button key={po.id} onClick={() => setDetail(po)} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:shadow-md">
                <div className="text-[11px] font-semibold text-slate-700">
                  {profiles.get(po.user_id) ?? ''}{job ? ` — ${job}` : ''}
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <span className="line-clamp-2 break-words text-xs font-semibold leading-snug text-slate-900">🎯 {po.objective}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[po.trang_thai] ?? 'bg-slate-100'}`}>{po.trang_thai}</span>
                </div>
                {poKrs.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                    {poKrs.map((k, i) => <li key={k.id}>KR{i + 1}: {k.noi_dung}</li>)}
                  </ul>
                )}
                <div className="mt-2">{bar(po.tien_do, 'personal')}</div>
                <div className="mt-1 text-xs text-slate-500">{po.tien_do}% · {checkinCount.get(po.id) ?? 0} check-in</div>
              </button>
            );
          })}
        </div>
      )}

      {personalOkrs.filter((o) => !o.parent_okr_id).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-bold text-amber-900">OKR cá nhân chưa gắn OKR công ty</h3>
          <ul className="mt-2 space-y-2">{personalOkrs.filter((o) => !o.parent_okr_id).map((o) => (
            <li key={o.id}><button onClick={() => setDetail(o)} className="w-full rounded-lg border border-amber-200 bg-white p-3 text-left hover:bg-amber-50">
              <p className="break-words text-sm font-semibold leading-snug text-slate-900">🎯 {o.objective}</p>
              <p className="text-xs text-slate-600">{profiles.get(o.user_id) ?? ''} · {periodLabel(o.tu_ngay, o.den_ngay)}</p>
            </button></li>
          ))}</ul>
        </div>
      )}

      {detail && <OkrDetailDialog okr={detail} onClose={() => setDetail(null)} onDone={() => setDetail(null)} onRefresh={() => setRefresh((r) => r + 1)} canManage={can('quan_ly_okr')} />}
    </div>
  );
}
