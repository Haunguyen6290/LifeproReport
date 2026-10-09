'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { fmtDateVN } from '@/lib/time';
import { periodLabel } from '@/lib/okr';
import { OkrDetailDialog } from '@/components/OkrDetailDialog';
import { Selectable } from '@/components/Selectable';

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

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function isOverdue(o: OkrRow, today: string): boolean {
  return !o.is_archived && o.trang_thai !== 'Hoàn thành' && !!o.den_ngay && o.den_ngay < today;
}

export function OkrTree({ tu, den, readOnly, showArchived, activeOnly }: { tu?: string; den?: string; readOnly?: boolean; showArchived?: boolean; activeOnly?: boolean }) {
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
  const today = todayISO();

  async function restore(o: OkrRow) {
    if (!confirm('Hoàn tác OKR đã lưu trữ này?')) return;
    await supabase.from('okrs').update({ is_archived: false }).eq('id', o.id);
    setRefresh((r) => r + 1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // Che do moi: hien tat ca OKR chua ket thuc theo NGAY HIEN TAI, khong loc theo tu/den
        // - Mac dinh: chua luu tru + chua Hoan thanh (dang lam)
        // - Neu truyen tu/den (tuong thich cu): van loc giao ky de khong vo dashboard cu
        // Quyet dinh: neu activeOnly !== false va khong co tu/den -> lay active
        const useActiveMode = activeOnly !== false && (!tu || !den);
        let q = supabase
          .from('okrs')
          .select('id, user_id, tu_ngay, den_ngay, loai_ky_goi_y, objective, is_company, parent_okr_id, is_archived, trang_thai, tien_do')
          .order('is_company', { ascending: false })
          .order('created_at', { ascending: true });
        if (useActiveMode) {
          if (!showArchived) q = (q as any).eq('is_archived', false);
          // activeOnly: chi chua ket thuc (khong lay Hoan thanh) tru khi dang xem luu tru
          if (!showArchived) q = (q as any).neq('trang_thai', 'Hoàn thành');
        } else if (tu && den) {
          q = (q as any).lte('tu_ngay', den).gte('den_ngay', tu);
        } else if (!showArchived) {
          q = (q as any).eq('is_archived', false);
        }
        const { data: okrData, error: e1 } = await q;
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
  }, [tu, den, refresh, showArchived, activeOnly]);

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
        <p className="text-sm font-semibold text-slate-700">Chưa có OKR đang hoạt động</p>
        <p className="mt-1 text-xs text-slate-500">Tạo OKR công ty trước, sau đó mỗi cá nhân gắn thẳng vào OKR công ty cùng kỳ hạn.</p>
      </div>
    );
  }

  const companyOkrs = okrs.filter((o) => o.is_company && (showArchived ? true : !o.is_archived));
  const personalOkrs = okrs.filter((o) => !o.is_company && (showArchived ? true : !o.is_archived));
  const overdueCompany = companyOkrs.filter((o) => isOverdue(o, today));
  const overduePersonal = personalOkrs.filter((o) => isOverdue(o, today));
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
        {(overduePersonal.length > 0) && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
            <p className="text-sm font-bold text-red-700">⚠️ Có {overduePersonal.length} OKR cá nhân quá hạn (đến {overduePersonal[0]?.den_ngay ? fmtDateVN(overduePersonal[0].den_ngay) : ''} mà chưa kết thúc)</p>
            <p className="mt-1 text-xs text-red-700">Hãy <b>Kết thúc & Lưu trữ</b> hoặc bấm <b>Sửa OKR</b> để gia hạn thời gian.</p>
          </div>
        )}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Chưa có OKR công ty đang hoạt động.</div>
        {personalOkrs.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900">OKR cá nhân (chưa gắn OKR công ty)</h3>
            <ul className="mt-3 space-y-3">{personalOkrs.map((o) => {
              const od = isOverdue(o, today);
              return (
              <li key={o.id}><Selectable as="button" onOpen={() => setDetail(o)} className={`w-full rounded-lg border p-3 text-left hover:bg-slate-100 ${od ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-semibold text-slate-900">🎯 {o.objective}</span><span className="flex items-center gap-1"><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[o.trang_thai] ?? 'bg-slate-100'}`}>{o.trang_thai}</span>{od && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">Quá hạn</span>}</span></div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600"><span>{profiles.get(o.user_id) ?? ''}</span><span>·</span><span>{periodLabel(o.tu_ngay, o.den_ngay)}</span><span>·</span><span>{checkinCount.get(o.id) ?? 0} check-in</span>{od && <span className="font-semibold text-red-600">· đến {fmtDateVN(o.den_ngay)}</span>}</div>
                <div className="mt-2 flex items-center gap-2">{bar(o.tien_do, 'personal')}<span className="text-xs text-slate-500">{o.tien_do}%</span></div>
              </Selectable></li>
            );})}</ul>
          </div>
        )}
        {detail && <OkrDetailDialog okr={detail} onClose={() => setDetail(null)} onDone={() => { setDetail(null); }} onRefresh={() => setRefresh((r) => r + 1)} canManage={can('quan_ly_okr')} readOnly={readOnly} />}
      </div>
    );
  }

  const activeCo = companyOkrs.find((o) => o.id === selectedCoId) ?? companyOkrs[0];
  const activeKrs = krsByOkr.get(activeCo.id) ?? [];
  const linkedPersonal = personalByParentOkr.get(activeCo.id) ?? [];
  const activeOverdue = isOverdue(activeCo, today);

  return (
    <div className="space-y-4">
      {(overdueCompany.length > 0 || overduePersonal.length > 0) && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
          <p className="text-sm font-bold text-red-700">⚠️ Có {overdueCompany.length + overduePersonal.length} OKR quá hạn chưa kết thúc (đến ngày &lt; {fmtDateVN(today)})</p>
          <p className="mt-1 text-xs leading-relaxed text-red-700">Quá hạn mà chưa kết thúc = lệch kế hoạch. Hãy chọn OKR bên dưới → <b>Đóng & Lưu trữ</b> để kết thúc, hoặc <b>Sửa OKR</b> để gia hạn thời gian cho khớp.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {companyOkrs.map((co) => {
          const od = isOverdue(co, today);
          return (
          <Selectable key={co.id} as="button" onOpen={() => setSelectedCoId(co.id)} className={`max-w-[360px] rounded-full px-4 py-2 text-left text-sm font-semibold transition ${selectedCoId === co.id ? 'bg-[#1e3a8a] text-white' : od ? 'bg-red-50 text-red-700 ring-1 ring-red-300 hover:bg-red-100' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            <span className="line-clamp-2">{od ? '🔴 ' : '🎯 '}{co.objective}{od ? ' — Quá hạn' : ''}</span>
          </Selectable>
        );})}
      </div>

      {/* Card công ty — desktop 65% cho cân đối; mobile full-width. Trên là Công ty, dưới là O+KR */}
      <Selectable onOpen={() => setDetail(activeCo)} className={`mx-auto block w-full max-w-full cursor-pointer rounded-xl border-2 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-md sm:max-w-[65%] ${activeOverdue ? 'border-red-300' : 'border-slate-200'}`}>
        {(activeCo.is_archived) && (
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Lưu trữ</span>
            {can('quan_ly_okr') && <button onClick={(e) => { e.stopPropagation(); restore(activeCo); }} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">Hoàn tác</button>}
          </div>
        )}
        {activeOverdue && (
          <div className="flex items-center gap-2 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
            <span>🔴 Quá hạn từ {fmtDateVN(activeCo.den_ngay)} — chưa kết thúc</span>
            <span className="font-normal text-red-600">· Hãy kết thúc hoặc gia hạn</span>
          </div>
        )}
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#eff6ff] to-white px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#0f2a4a] px-2 py-0.5 text-xs font-bold text-white">CÔNG TY</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[activeCo.trang_thai] ?? 'bg-slate-100'}`}>{activeCo.trang_thai}</span>
                {activeOverdue && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">Quá hạn</span>}
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
      </Selectable>

      {/* Cây cá nhân nối thẳng */}
      <div className="mx-auto h-6 w-0 border-l-2 border-[#1e3a8a]" aria-hidden />
      {linkedPersonal.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có OKR cá nhân gắn OKR công ty này.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {linkedPersonal.map((po) => {
            const poKrs = krsByOkr.get(po.id) ?? [];
            const job = jobs.get(po.user_id) ?? '';
            const od = isOverdue(po, today);
            return (
              <Selectable key={po.id} as="button" onOpen={() => setDetail(po)} className={`rounded-xl border-2 bg-white p-3 text-left shadow-sm hover:shadow-md ${od ? 'border-red-300' : 'border-slate-200'}`}>
                <div className="text-[11px] font-semibold text-slate-700">
                  {profiles.get(po.user_id) ?? ''}{job ? ` — ${job}` : ''}
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <span className="line-clamp-2 break-words text-xs font-semibold leading-snug text-slate-900">🎯 {po.objective}</span>
                  <span className="flex shrink-0 items-center gap-1"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge[po.trang_thai] ?? 'bg-slate-100'}`}>{po.trang_thai}</span>{od && <span className="rounded-full bg-red-600 px-1 py-0.5 text-[10px] font-bold text-white">Quá hạn</span>}</span>
                </div>
                {od && <p className="mt-1 text-[11px] font-semibold text-red-600">Quá hạn từ {fmtDateVN(po.den_ngay)}</p>}
                {poKrs.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                    {poKrs.map((k, i) => <li key={k.id}>KR{i + 1}: {k.noi_dung}</li>)}
                  </ul>
                )}
                <div className="mt-2">{bar(po.tien_do, 'personal')}</div>
                <div className="mt-1 text-xs text-slate-500">{po.tien_do}% · {checkinCount.get(po.id) ?? 0} check-in</div>
              </Selectable>
            );
          })}
        </div>
      )}

      {personalOkrs.filter((o) => !o.parent_okr_id).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-bold text-amber-900">OKR cá nhân chưa gắn OKR công ty</h3>
          <ul className="mt-2 space-y-2">{personalOkrs.filter((o) => !o.parent_okr_id).map((o) => {
            const od = isOverdue(o, today);
            return (
            <li key={o.id}><Selectable as="button" onOpen={() => setDetail(o)} className={`w-full rounded-lg border p-3 text-left hover:bg-amber-50 ${od ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-2"><p className="break-words text-sm font-semibold leading-snug text-slate-900">🎯 {o.objective}</p>{od && <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">Quá hạn</span>}</div>
              <p className="text-xs text-slate-600">{profiles.get(o.user_id) ?? ''} · {periodLabel(o.tu_ngay, o.den_ngay)}{od ? ` · Quá hạn từ ${fmtDateVN(o.den_ngay)}` : ''}</p>
            </Selectable></li>
          );})}</ul>
        </div>
      )}

      {detail && <OkrDetailDialog okr={detail} onClose={() => setDetail(null)} onDone={() => setDetail(null)} onRefresh={() => setRefresh((r) => r + 1)} canManage={can('quan_ly_okr')} />}
    </div>
  );
}
