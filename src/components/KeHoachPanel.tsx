'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { MoneyInput } from '@/components/MoneyInput';

export type PlanRow = { thang: string; ten: string; mien: string; kh_doanh_so: number; kh_thu_tien: number };
type RowState = PlanRow & { id: string };
export const MIEN_OPTIONS = ['Hà Nội', 'Sài Gòn', 'Khác'];

const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-ring)]';
const num = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-2 py-1.5 text-sm text-right tabular-nums outline-none focus:border-[var(--color-ring)] w-full';
function nowYM(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
let _uid = 0;
const uid = () => `r${++_uid}`;

export function KeHoachPanel({ thang, onThangChange, embed = 'page', onSaved }: {
  thang?: string;
  onThangChange?: (t: string) => void;
  embed?: 'tab' | 'page';
  onSaved?: () => void;
}) {
  const { userId, can } = useAuth();
  const editable = can('quan_ly_cai_dat');
  const [thangLocal, setThangLocal] = useState(nowYM());
  const thangHien = thang ?? thangLocal;

  const [all, setAll] = useState<RowState[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: st }, { data: pr }] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'FINANCE_PLAN').maybeSingle(),
        supabase.from('profiles').select('id, full_name').eq('status', 'ACTIVE').order('full_name'),
      ]);
      let p: PlanRow[] = [];
      try { const j = JSON.parse((st?.value as string) ?? '[]'); if (Array.isArray(j)) p = j; } catch {}
      setAll(p.map((r) => ({ ...r, id: uid() })));
      setProfiles(((pr ?? []) as { id: string; full_name: string }[]).map((x) => ({ id: x.id, full_name: x.full_name })));
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => all.filter((p) => p.thang === thangHien), [all, thangHien]);

  function setThang(t: string) { if (thang == null) setThangLocal(t); onThangChange?.(t); }
  function patch(id: string, du: Partial<PlanRow>) { setAll((prev) => prev.map((p) => (p.id === id ? { ...p, ...du } : p))); }
  function themDong() { setAll((prev) => [...prev, { id: uid(), thang: thangHien, ten: '', mien: 'Hà Nội', kh_doanh_so: 0, kh_thu_tien: 0 }]); }
  function xoa(id: string) { setAll((prev) => prev.filter((p) => p.id !== id)); }

  async function luu() {
    if (!editable) return;
    const hopLe = rows.filter((p) => p.ten.trim());
    const seen = new Set<string>(); const trung: string[] = [];
    for (const p of hopLe) { if (seen.has(p.ten)) trung.push(p.ten); seen.add(p.ten); }
    if (trung.length) { setMsg(`Trùng kinh doanh: ${[...new Set(trung)].join(', ')} — mỗi tháng chỉ 1 dòng/người.`); return; }
    setBusy(true); setMsg('');
    const khacThang = all.filter((p) => p.thang !== thangHien);
    const toStore: PlanRow[] = [...khacThang, ...hopLe].map(({ id, ...r }) => ({ ...r, kh_doanh_so: Number(r.kh_doanh_so) || 0, kh_thu_tien: Number(r.kh_thu_tien) || 0 }));
    const { error } = await supabase.from('settings').upsert({ key: 'FINANCE_PLAN', value: JSON.stringify(toStore), updated_by: userId }, { onConflict: 'key' });
    setBusy(false);
    if (error) { setMsg('Lỗi: ' + error.message); return; }
    setMsg(`Đã lưu kế hoạch ${thangHien}.`);
    onSaved?.();
    setTimeout(() => setMsg(''), 3500);
  }

  if (loading) return <div className="py-6 text-center text-sm text-slate-500">Đang tải kế hoạch…</div>;
  const dsKhac = all.filter((p) => p.thang !== thangHien).length;
  const tongDS = rows.reduce((a, p) => a + (Number(p.kh_doanh_so) || 0), 0);
  const tongThu = rows.reduce((a, p) => a + (Number(p.kh_thu_tien) || 0), 0);
  const tenDaChon = new Set(rows.map((p) => p.ten).filter(Boolean));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {embed === 'page' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700">Tháng:</label>
            <input type="month" value={thangHien} onChange={(e) => setThang(e.target.value)} className={sel} />
          </div>
        )}
        {dsKhac > 0 && <span className="text-xs text-slate-500">Đang giữ {dsKhac} dòng của tháng khác trong hệ thống.</span>}
        {msg && <span className={`text-sm ${msg.startsWith('Lỗi') || msg.startsWith('Trùng') ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
              <th className="px-3 py-2 font-bold">Miền</th>
              <th className="px-3 py-2 font-bold">Nhân viên kinh doanh</th>
              <th className="px-3 py-2 text-right font-bold">Kế hoạch doanh số</th>
              <th className="px-3 py-2 text-right font-bold">Kế hoạch thu tiền</th>
              {editable && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-2 py-1.5">
                  <select value={p.mien} onChange={(e) => patch(p.id, { mien: e.target.value })} disabled={!editable} className={`${sel} min-w-[110px]`}>
                    {MIEN_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select value={p.ten} onChange={(e) => patch(p.id, { ten: e.target.value })} disabled={!editable} className={`${sel} w-full min-w-[180px]`}>
                    <option value="">— Chọn kinh doanh —</option>
                    {profiles.map((pr) => (
                      <option key={pr.id} value={pr.full_name} disabled={pr.full_name !== p.ten && tenDaChon.has(pr.full_name)}>{pr.full_name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5"><MoneyInput value={p.kh_doanh_so || 0} onChange={(n) => patch(p.id, { kh_doanh_so: n })} disabled={!editable} className={`${num} text-right`} /></td>
                <td className="px-2 py-1.5"><MoneyInput value={p.kh_thu_tien || 0} onChange={(n) => patch(p.id, { kh_thu_tien: n })} disabled={!editable} className={`${num} text-right`} /></td>
                {editable && <td className="px-2 py-1.5"><button onClick={() => xoa(p.id)} className="text-xs text-red-600 hover:underline">Xóa</button></td>}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={editable ? 5 : 4} className="px-3 py-6 text-center text-sm text-slate-500">Chưa có dòng kế hoạch cho tháng {thangHien}.{editable && ' Bấm "+ Thêm dòng".'}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td colSpan={2} className="px-3 py-2 text-right">Tổng {thangHien}</td>
                <td className="px-2 py-2 text-right tabular-nums text-[#0f2a4a]">{tongDS.toLocaleString('vi-VN')}</td>
                <td className="px-2 py-2 text-right tabular-nums text-[#0f2a4a]">{tongThu.toLocaleString('vi-VN')}</td>
                {editable && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={themDong} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium hover:border-[#1e3a8a]">+ Thêm dòng</button>
          <button onClick={luu} disabled={busy || rows.length === 0} className="rounded-md bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu kế hoạch'}</button>
        </div>
      )}
      {!editable && <p className="text-xs text-slate-500">Chỉ xem (quản trị mới sửa được).</p>}
    </div>
  );
}
