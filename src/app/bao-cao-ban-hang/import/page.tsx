'use client';
import { useState, useRef } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';

function Inner() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; months: string[]; newCustomers: { ma_kh: string; ten_kh: string }[]; createdCustomers?: number; message?: string } | null>(null);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function doImport() {
    if (!file) { setErr('Chưa chọn file'); return; }
    setBusy(true); setErr(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/sales/import', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Import thất bại');
      setResult(body);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally { setBusy(false); }
  }

  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Import sổ bán hàng (Odoo)</h1>
        <p className="mb-4 text-sm text-slate-600">Chọn file <code className="rounded bg-slate-100 px-1">.xls / .xlsx</code> xuất từ Odoo (ACC.15 - Sổ chi tiết bán hàng). Hệ thống sẽ lọc theo danh sách nhân viên được tính, gộp tên theo ánh xạ, và ghi đè theo tháng.</p>

        <div className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:border-[#1e3a8a]">Chọn file</button>
            <input ref={inputRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setResult(null); setErr(''); }} />
            <span className="text-sm text-slate-700">{file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'Chưa chọn file'}</span>
            <button onClick={doImport} disabled={busy || !file} className="ml-auto rounded-lg bg-[#0f2a4a] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang import…' : 'Import'}</button>
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          {result && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Import xong: {result.imported} dòng đã lưu, {result.skipped} dòng bỏ qua</p>
              {result.months.length > 0 && <p className="mt-1 text-xs text-emerald-700">Tháng ghi đè: {result.months.join(', ')}</p>}
              {result.message && <p className="mt-1 text-xs text-slate-600">{result.message}</p>}
              {result.newCustomers.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-amber-800">
                    {result.createdCustomers != null && result.createdCustomers > 0
                      ? `Đã tự tạo ${result.createdCustomers}/${result.newCustomers.length} khách mới vào danh sách (Mã, Tên, KD phụ trách, Tỉnh) — ông vào Khách hàng để sửa bổ sung.`
                      : `Cảnh báo: ${result.newCustomers.length} khách chưa có trong hệ thống`}
                  </p>
                  <div className="mt-2 max-h-[200px] overflow-auto rounded border border-amber-200 bg-white">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-amber-50 text-left"><th className="px-2 py-1">Mã KH</th><th className="px-2 py-1">Tên KH</th></tr></thead>
                      <tbody>
                        {result.newCustomers.map((c) => (
                          <tr key={c.ma_kh} className="border-t border-slate-100"><td className="px-2 py-1 font-mono">{c.ma_kh}</td><td className="px-2 py-1">{c.ten_kh}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{result.createdCustomers != null && result.createdCustomers > 0 ? 'Danh sách bên dưới là các khách vừa tạo / còn thiếu.' : 'Hãy thêm các khách này vào danh sách khách hàng.'}</p>
                </div>
              )}
              <a href="/bao-cao-ban-hang" className="mt-3 inline-block rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">Xem Dashboard →</a>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-semibold">Lưu ý:</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">
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
