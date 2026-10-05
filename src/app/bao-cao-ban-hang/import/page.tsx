'use client';
import { useState, useRef } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';

type NewCust = { ma_kh: string; ten_kh: string; dupNote?: string; mergeTo?: string };
type Preview = {
  imported: number;
  skipped: number;
  months: string[];
  monthRanges?: Record<string, { min: string; max: string }>;
  byMonth: Record<string, number>;
  newCustomers: NewCust[];
};

type Done = {
  imported: number;
  skipped: number;
  months: string[];
  monthRanges?: Record<string, { min: string; max: string }>;
  newCustomers: { ma_kh: string; ten_kh: string }[];
  createdCustomers: number;
};

function Inner() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [merged, setMerged] = useState<Map<string, string>>(new Map());
  const [done, setDone] = useState<Done | null>(null);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() { setPreview(null); setDone(null); setErr(''); setExcluded(new Set()); setMerged(new Map()); }

  function friendlyErr(e: any, fallback: string): string {
    const m = e?.message ?? String(e);
    if (/failed to fetch|networkerror|load failed|timeout/i.test(m)) {
      return 'Máy chủ trả lời quá lâu (có thể do file nhiều dòng/khách mới). Vui lòng bấm Xác nhận lưu lại lần nữa — dữ liệu thường đã được ghi, vào Dashboard kiểm tra trước khi import lại.';
    }
    return m || fallback;
  }

  async function doPreview() {
    if (!file) { setErr('Chưa chọn file'); return; }
    setBusy(true); setErr(''); reset();
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'preview');
      const headers: HeadersInit = tok ? { Authorization: `Bearer ${tok}` } : {};
      const res = await fetch('/api/sales/import', { method: 'POST', headers, body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Không đọc được file');
      setPreview(body);
    } catch (e: any) {
      setErr(friendlyErr(e, 'Không đọc được file'));
    } finally { setBusy(false); }
  }

  async function doCommit() {
    if (!file) return;
    setConfirming(true); setErr('');
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'commit');
      fd.append('exclude', JSON.stringify([...excluded]));
      if (merged.size > 0) fd.append('merge', JSON.stringify(Object.fromEntries(merged)));
      const headers: HeadersInit = tok ? { Authorization: `Bearer ${tok}` } : {};
      const res = await fetch('/api/sales/import', { method: 'POST', headers, body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Import thất bại');
      setPreview(null);
      setExcluded(new Set());
      setMerged(new Map());
      setDone(body);
    } catch (e: any) {
      setErr(friendlyErr(e, 'Import thất bại'));
    } finally { setConfirming(false); }
  }

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Import sổ bán hàng (Odoo)</h1>
        <p className="mb-4 text-sm text-slate-600">Chọn file <code className="rounded bg-slate-100 px-1">.xls / .xlsx</code> xuất từ Odoo (ACC.15 - Sổ chi tiết bán hàng). Bấm <strong>Kiểm tra</strong> để xem trước — bấm <strong>X</strong> để loại khách trùng trước khi <strong>Xác nhận lưu</strong>.</p>

        <div className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:border-[#1e3a8a]">Chọn file</button>
            <input ref={inputRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); reset(); }} />
            <span className="text-sm text-slate-700">{file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'Chưa chọn file'}</span>
            <button onClick={doPreview} disabled={busy || !file} className="ml-auto rounded-lg bg-[#0f2a4a] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang đọc…' : 'Kiểm tra'}</button>
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

          {/* Preview */}
          {preview && (
            <div className="mt-4 rounded-lg bg-sky-50 p-4">
              <p className="text-sm font-bold text-sky-900">Xem trước — CHƯA lưu vào hệ thống</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-slate-800"><span className="font-semibold">{preview.imported}</span> dòng sẽ được lưu</p>
                <p className="text-slate-800"><span className="font-semibold">{preview.skipped}</span> dòng sẽ bỏ qua</p>
              </div>
              {preview.months.length > 0 && (
                <p className="mt-2 text-xs text-slate-700">Khoảng ngày sẽ ghi đè: {preview.months.map((m) => { const r = preview.monthRanges?.[m]; return r ? `${m} (${r.min} → ${r.max})` : m; }).join(', ')}</p>
              )}
              {Object.keys(preview.byMonth ?? {}).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(preview.byMonth).map(([m, n]) => (
                    <span key={m} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-sky-200">{m}: {n} dòng</span>
                  ))}
                </div>
              )}
              {preview.newCustomers.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-800">Sẽ tạo thêm {preview.newCustomers.length} khách mới (Mã, Tên, KD phụ trách, Tỉnh) — bấm X để loại khách trùng:</p>
                  <div className="mt-2 max-h-[260px] overflow-auto rounded border border-sky-200 bg-white">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-sky-100 text-left text-slate-700"><th className="px-2 py-1">Mã KH</th><th className="px-2 py-1">Tên KH</th><th className="px-2 py-1">Xử lý</th><th className="w-20 px-1 py-1"></th></tr></thead>
                      <tbody>
                        {preview.newCustomers.map((c) => {
                          const isExcluded = excluded.has(c.ma_kh);
                          const isMerged = merged.has(c.ma_kh);
                          const dup = !!c.dupNote;
                          const mergeTarget = (c as any).mergeTo as string | undefined;
                          return (
                            <tr key={c.ma_kh} className={`border-t border-slate-100 ${isExcluded ? 'bg-slate-100 opacity-60' : isMerged ? 'bg-emerald-50' : dup ? 'bg-amber-50' : ''}`}>
                              <td className="px-2 py-1 font-mono">{c.ma_kh}</td>
                              <td className="px-2 py-1">
                                <span>{c.ten_kh}</span>
                                {isMerged && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Sẽ gộp → {merged.get(c.ma_kh)}</span>}
                                {!isMerged && dup && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{c.dupNote}</span>}
                                {isExcluded && <span className="ml-2 text-[10px] text-slate-500">(sẽ bỏ qua)</span>}
                              </td>
                              <td className="px-2 py-1 text-xs">
                                {isMerged ? <span className="text-emerald-700">Đã chọn gộp</span> : isExcluded ? '' : dup && mergeTarget ? <span className="text-amber-700">{c.dupNote}</span> : dup ? <span className="text-amber-700">Trùng tên</span> : ''}
                              </td>
                              <td className="px-1 py-1 text-center">
                                {isExcluded ? (
                                  <button onClick={() => setExcluded((prev) => { const n = new Set(prev); n.delete(c.ma_kh); return n; })} className="text-xs text-emerald-700 hover:underline" title="Khôi phục">↩</button>
                                ) : isMerged ? (
                                  <button onClick={() => setMerged((prev) => { const n = new Map(prev); n.delete(c.ma_kh); return n; })} className="text-xs text-slate-600 hover:underline" title="Hủy gộp">↩ Gộp</button>
                                ) : (
                                  <span className="flex items-center justify-center gap-1">
                                    {mergeTarget && <button onClick={() => setMerged((prev) => new Map(prev).set(c.ma_kh, mergeTarget))} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200" title={`Gộp vào ${mergeTarget} — dùng Mã/Khách đã có, tránh tạo mới`}>Gộp</button>}
                                    <button onClick={() => setExcluded((prev) => new Set(prev).add(c.ma_kh))} className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-red-100 hover:text-red-600" title="Loại khỏi tạo mới">✕</button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {excluded.size > 0 && <p className="mt-1 text-xs text-slate-600">Đã loại {excluded.size} khách — sẽ chỉ tạo {preview.newCustomers.length - excluded.size - merged.size} khách mới + gộp {merged.size} khách vào mã đã có.</p>}
                  {merged.size > 0 && excluded.size === 0 && <p className="mt-1 text-xs text-emerald-700">Sẽ gộp {merged.size} khách vào mã đã có (dùng Mã KH cũ, không tạo mới) — doanh số vẫn tính đủ.</p>}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button onClick={doCommit} disabled={confirming || preview.imported === 0} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{confirming ? 'Đang lưu…' : `Xác nhận lưu (${preview.newCustomers.length - excluded.size - merged.size} khách mới${merged.size ? ` + gộp ${merged.size}` : ''})`}</button>
                <button onClick={() => setPreview(null)} disabled={confirming} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>
              </div>
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Import xong: {done.imported} dòng đã lưu, {done.skipped} dòng bỏ qua</p>
              {done.months.length > 0 && <p className="mt-1 text-xs text-emerald-700">Khoảng ngày đã ghi đè: {done.months.map((m) => { const r = done.monthRanges?.[m]; return r ? `${m} (${r.min} → ${r.max})` : m; }).join(', ')} — phần còn lại trong tháng được giữ nguyên.</p>}
              {done.createdCustomers != null && done.createdCustomers > 0 && (
                <p className="mt-2 text-xs text-emerald-700">Đã tự tạo {done.createdCustomers} khách mới vào danh sách — ông vào <a href="/khach-hang" className="font-semibold underline">Khách hàng</a> để sửa bổ sung.</p>
              )}
              <a href="/bao-cao-ban-hang" className="mt-3 inline-block rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Xem Dashboard →</a>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-semibold">Lưu ý:</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li>Bấm <strong>Kiểm tra</strong> trước để xem sẽ lưu/giữ gì, bấm <strong>X</strong> để loại khách trùng, đúng rồi mới <strong>Xác nhận lưu</strong>.</li>
            <li>Một tháng có thể tách nhiều file — mỗi lần import <strong>chỉ ghi đè đúng khoảng ngày trong file</strong>, phần còn lại của tháng được giữ nguyên (nối tháng an toàn).</li>
            <li>Chỉ tính các dòng có <em>Kinh doanh QL</em> nằm trong danh sách cho phép (Cài đặt chung).</li>
            <li>Tên như <code>Nguyễn Trung Chính SG</code> / <code>Đỗ Thành Công</code> sẽ tự gộp về <code>Nguyễn Trung Chính</code> theo ánh xạ.</li>
          </ul>
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Inner /></RequireAuth>; }
