'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';

type TkMapItem = { ma: string; nhom: string };
type PlanRow = { thang: string; ten: string; mien: string; kh_doanh_so: number; kh_thu_tien: number };

const DEFAULT_TK_MAP: TkMapItem[] = [
  { ma: '5111', nhom: 'Doanh thu' },
  { ma: '511', nhom: 'Doanh thu' },
  { ma: '521', nhom: 'Trả lại' },
  { ma: '111', nhom: 'Thu tiền' },
  { ma: '112', nhom: 'Thu tiền' },
  { ma: '131', nhom: 'Thu tiền' },
  { ma: '1368', nhom: 'Thu tiền' },
  { ma: '3361', nhom: 'Thu tiền' },
  { ma: '3413', nhom: 'Thu tiền' },
  { ma: '3414', nhom: 'Thu tiền' },
  { ma: '6426', nhom: 'Thu tiền' },
];

const NHOMS = ['Doanh thu', 'Trả lại', 'Thu tiền'];

export function FinanceSettingsPanel() {
  const { userId, can } = useAuth();
  const [graceDays, setGraceDays] = useState('90');
  const [tkMap, setTkMap] = useState<TkMapItem[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 backdrop-blur sm:p-5';
  const editable = can('quan_ly_cai_dat');

  async function load() {
    const { data } = await supabase.from('settings').select('key, value').in('key', ['DEBT_GRACE_DAYS', 'RECEIVABLE_TK_MAP', 'FINANCE_PLAN']);
    const v: Record<string, string> = {};
    for (const r of (data ?? []) as { key: string; value: string }[]) v[r.key] = r.value;
    setGraceDays(v.DEBT_GRACE_DAYS || '90');
    try {
      const m = JSON.parse(v.RECEIVABLE_TK_MAP ?? '[]');
      setTkMap(Array.isArray(m) ? m : DEFAULT_TK_MAP);
    } catch { setTkMap(DEFAULT_TK_MAP); }
    try {
      const p = JSON.parse(v.FINANCE_PLAN ?? '[]');
      setPlans(Array.isArray(p) ? p : []);
    } catch { setPlans([]); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editable) return;
    setBusy(true);
    setMsg('');
    try {
      const upserts = [
        { key: 'DEBT_GRACE_DAYS', value: String(Number(graceDays) || 90) },
        { key: 'RECEIVABLE_TK_MAP', value: JSON.stringify(tkMap.filter((t) => t.ma.trim())) },
        { key: 'FINANCE_PLAN', value: JSON.stringify(plans.filter((p) => p.ten.trim())) },
      ];
      for (const u of upserts) {
        const { error } = await supabase.from('settings').upsert({ ...u, updated_by: userId }, { onConflict: 'key' });
        if (error) throw new Error(error.message);
      }
      setMsg('Đã lưu cài đặt Tài chính.');
    } catch (e: any) {
      setMsg('Lỗi: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  if (!editable) return null;

  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Công nợ quá hạn — tham số</h2>
        <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
          <label className="text-sm font-semibold">Hạn công nợ tối đa (ngày)</label>
          <input type="number" min={30} max={365} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className={sel} />
        </div>
        <p className="mt-1 text-xs text-slate-500">Mốc kiểm tra = ngày đầu tháng của (ngày lập − hạn). Ví dụ hạn 90 ngày, lập tháng 9 → mốc 01/07.</p>
      </div>

      <div className={card}>
        <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Phân loại tài khoản đối ứng (TK131)</h2>
        <p className="mb-2 text-xs text-slate-600">Mỗi mã TK đối ứng được xếp vào một nhóm. Thêm/bớt điều kiện tại đây. Khớp theo tiền tố dài nhất.</p>
        <table className="mb-2 w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="pb-1">Mã / tiền tố TK</th><th className="pb-1">Nhóm</th><th></th></tr></thead>
          <tbody>
            {tkMap.map((t, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1 pr-2"><input value={t.ma} onChange={(e) => setTkMap((prev) => prev.map((x, j) => j === i ? { ...x, ma: e.target.value } : x))} className={`${sel} w-full py-1 font-mono`} /></td>
                <td className="py-1 pr-2">
                  <select value={t.nhom} onChange={(e) => setTkMap((prev) => prev.map((x, j) => j === i ? { ...x, nhom: e.target.value } : x))} className={`${sel} w-full py-1`}>
                    {NHOMS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td className="py-1"><button onClick={() => setTkMap((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTkMap((prev) => [...prev, { ma: '', nhom: 'Thu tiền' }])} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">+ Thêm dòng</button>
          <button onClick={() => setTkMap(DEFAULT_TK_MAP)} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">Khôi phục mặc định</button>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Kế hoạch NVKD theo tháng</h2>
        <p className="mb-2 text-xs text-slate-600">Chọn tháng và khai báo kế hoạch cho từng NVKD. Dùng trong báo cáo Bán hàng thu tiền (tab Thu tiền) — mỗi dòng gồm: tháng, tên, miền, KH doanh số, KH thu tiền.</p>
        <table className="mb-2 w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="pb-1">Tháng</th><th className="pb-1">Tên NVKD</th><th className="pb-1">Miền</th><th className="pb-1">KH Doanh số</th><th className="pb-1">KH Thu tiền</th><th></th></tr></thead>
          <tbody>
            {plans.map((p, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1 pr-2"><input type="month" value={p.thang} onChange={(e) => setPlans((prev) => prev.map((x, j) => j === i ? { ...x, thang: e.target.value } : x))} className={`${sel} w-full py-1`} /></td>
                <td className="py-1 pr-2"><input value={p.ten} onChange={(e) => setPlans((prev) => prev.map((x, j) => j === i ? { ...x, ten: e.target.value } : x))} className={`${sel} w-full py-1`} /></td>
                <td className="py-1 pr-2"><input value={p.mien} onChange={(e) => setPlans((prev) => prev.map((x, j) => j === i ? { ...x, mien: e.target.value } : x))} className={`${sel} w-full py-1`} placeholder="Hà Nội" /></td>
                <td className="py-1 pr-2"><input type="number" value={p.kh_doanh_so} onChange={(e) => setPlans((prev) => prev.map((x, j) => j === i ? { ...x, kh_doanh_so: Number(e.target.value) } : x))} className={`${sel} w-full py-1`} /></td>
                <td className="py-1 pr-2"><input type="number" value={p.kh_thu_tien} onChange={(e) => setPlans((prev) => prev.map((x, j) => j === i ? { ...x, kh_thu_tien: Number(e.target.value) } : x))} className={`${sel} w-full py-1`} /></td>
                <td className="py-1"><button onClick={() => setPlans((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => setPlans((prev) => [...prev, { thang: new Date().toISOString().slice(0, 7), ten: '', mien: 'Hà Nội', kh_doanh_so: 0, kh_thu_tien: 0 }])} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">+ Thêm NVKD</button>
      </div>

      <div className="flex justify-end gap-2">
        {msg && <span className="self-center text-sm text-[#1e3a8a]">{msg}</span>}
        <button onClick={save} disabled={busy} className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu cài đặt Tài chính'}</button>
      </div>
    </div>
  );
}
