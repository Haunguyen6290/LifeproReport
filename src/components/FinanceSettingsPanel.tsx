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
  const [rebaseDate, setRebaseDate] = useState('');
  const [rebaseMsg, setRebaseMsg] = useState('');
  const [purgeConfirm, setPurgeConfirm] = useState('');

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

  async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const tok = data.session?.access_token ?? '';
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` };
  }

  async function doRebase() {
    if (!rebaseDate) return;
    setBusy(true); setRebaseMsg('');
    try {
      const r = await fetch('/api/finance/rebase', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ ngayMoc: rebaseDate }) });
      const j = await r.json();
      if (j.error) setRebaseMsg('Lỗi: ' + j.error);
      else { setRebaseMsg(`Đã dồn mốc sang ${rebaseDate} — ${j.soKhach} khách được cập nhật số dư gốc.`); load(); }
    } catch (e: any) { setRebaseMsg('Lỗi: ' + (e?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function doPurge() {
    if (purgeConfirm !== 'XOA CHUNG TU CU') return;
    if (!confirm('Xóa toàn bộ chứng từ TK131 trước ngày làm gốc? Không thể hoàn tác.')) return;
    setBusy(true); setRebaseMsg('');
    try {
      const r = await fetch('/api/finance/purge', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ confirm: purgeConfirm }) });
      const j = await r.json();
      if (j.error) setRebaseMsg('Lỗi: ' + j.error);
      else { setRebaseMsg(`Đã xóa ${j.daXoa?.toLocaleString('vi-VN')} chứng từ trước ${j.baseDate}.`); setPurgeConfirm(''); }
    } catch (e: any) { setRebaseMsg('Lỗi: ' + (e?.message ?? e)); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!editable) return;
    setBusy(true);
    setMsg('');
    try {
      const upserts = [
        { key: 'DEBT_GRACE_DAYS', value: String(Number(graceDays) || 90) },
        { key: 'RECEIVABLE_TK_MAP', value: JSON.stringify(tkMap.filter((t) => t.ma.trim())) },
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
        <p className="mb-3 text-xs text-slate-600">
          Nay khai báo ở trang riêng để chọn tháng một lần, gán miền + kinh doanh và theo dõi từng tháng.
        </p>
        <a href="/ke-hoach" className="inline-block rounded-md bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Mở trang Kế hoạch bán hàng →</a>
        {plans.length > 0 && <p className="mt-2 text-xs text-slate-500">Đang có {new Set(plans.map((p) => p.thang)).size} tháng với {plans.length} dòng kế hoạch.</p>}
      </div>

      <div className={card}>
        <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Số dư gốc &amp; dữ liệu lịch sử</h2>
        <p className="mb-2 text-xs text-slate-600">
          Dồn mốc gộp toàn bộ chứng từ cũ thành số dư gốc tại một ngày, để báo cáo chạy nhẹ khi dữ liệu nhiều năm.
          Xóa chứng từ chỉ nên làm <strong>sau khi đã dồn mốc</strong> và bạn chắc chắn không cần tra lại bút toán cũ.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày mốc mới</label>
            <input type="date" value={rebaseDate} onChange={(e) => setRebaseDate(e.target.value)} className={sel} />
          </div>
          <button onClick={doRebase} disabled={busy || !rebaseDate} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
            {busy ? 'Đang xử lý…' : 'Dồn mốc số dư gốc'}
          </button>
        </div>
        {rebaseMsg && <p className="mt-2 text-sm text-[#1e3a8a]">{rebaseMsg}</p>}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button onClick={doPurge} disabled={busy || purgeConfirm !== 'XOA CHUNG TU CU'} className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
            Xóa toàn bộ chứng từ trước mốc
          </button>
          <input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder='Gõ "XOA CHUNG TU CU" để mở khóa nút trên' className={`${sel} mt-2 w-full max-w-xs`} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {msg && <span className="self-center text-sm text-[#1e3a8a]">{msg}</span>}
        <button onClick={save} disabled={busy} className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu cài đặt Tài chính'}</button>
      </div>
    </div>
  );
}
