'use client';
import { useState, useRef } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';

type Preview = {
  imported: number;
  skipped: number;
  months: string[];
  byMonth: Record<string, number>;
  newCustomers: { ma_kh: string; ten_kh: string }[];
};

type Done = {
  imported: number;
  skipped: number;
  months: string[];
  newCustomers: { ma_kh: string; ten_kh: string }[];
  createdCustomers: number;
};

function Inner() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() { setPreview(null); setDone(null); setErr(''); }

  async function doPreview() {
    if (!file) { setErr('Chưa chọn file'); return; }
    setBusy(true); setErr(''); reset();
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'preview');
      const res = await fetch('/api/sales/import', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Không đọc được file');
      setPreview(body);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally { setBusy(false); }
  }

  async function doCommit() {
    if (!file) return;
    setConfirming(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'commit');
      const res = await fetch('/api/sales/import', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Import thất bại');
      setPreview(null);
      setDone(body);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally { setConfirming(false); }
  }

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Import sổ bán hàng (Odoo)</h1>
        <p className="mb-4 text-sm text-slate-600">Chọn file <code className="rounded bg-slate-100 px-1">.xls / .xlsx</code> xuất từ Odoo (ACC.15 - Sổ chi tiết bán hàng). Bấm <strong>Kiểm tra</strong> để xem trước, nếu đúng mới bấm <strong>Xác nhận lưu</strong>.</p>

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
                <p className="mt-2 text-xs text-slate-700">Tháng sẽ ghi đè: {preview.months.join(', ')}</p>
              )}
              {Object.keys(preview.byMonth ?? {}).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(preview.byMonth).map(([m, n]) => (
                    <span key={m} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-sky-200">{m}: {n} dòng</span>
                  ))}
                </div>
              )}
              {preview.newCustomers.length > 0 && (
                <p className="mt-2 text-xs text-amber-800">Sẽ tự tạo thêm <strong>{preview.newCustomers.length}</strong> khách hàng mới vào danh sách (Mã, Tên, KD phụ trách, Tỉnh).</p>
              )}
              <div className="mt-4 flex gap-2">
                <button onClick={doCommit} disabled={confirming || preview.imported === 0} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{confirming ? 'Đang lưu…' : 'Xác nhận lưu vào hệ thống'}</button>
                <button onClick={() => setPreview(null)} disabled={confirming} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>
              </div>
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Import xong: {done.imported} dòng đã lưu, {done.skipped} dòng bỏ qua</p>
              {done.months.length > 0 && <p className="mt-1 text-xs text-emerald-700">Tháng ghi đè: {done.months.join(', ')}</p>}
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
            <li>Bấm <strong>Kiểm tra</strong> trước để xem sẽ lưu/giữ gì, đúng rồi mới <strong>Xác nhận lưu</strong>.</li>
            <li>Mỗi tháng có thể import nhiều lần — lần sau sẽ ghi đè tháng đó.</li>
            <li>Chỉ tính các dòng có <em>Kinh doanh QL</em> nằm trong danh sách cho phép (Cài đặt chung).</li>
            <li>Tên như <code>Nguyễn Trung Chính SG</code> / <code>Đỗ Thành Công</code> sẽ tự gộp về <code>Nguyễn Trung Chính</code> theo ánh xạ.</li>
          </ul>
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Inner /></RequireAuth>; }
