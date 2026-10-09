'use client';
import { useState } from 'react';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { OkrDialog } from '@/components/OkrDialog';
import { OkrTree } from '@/components/OkrTree';

function Screen() {
  const { can } = useAuth();
  const [openCompany, setOpenCompany] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  function onDone() { setRefreshKey((k) => k + 1); }
  const canManage = can('quan_ly_okr');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">OKR</h1>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <button onClick={() => setOpenCompany(true)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-hover)]">+ OKR công ty</button>
            )}
            <button onClick={() => setOpenPersonal(true)} className="rounded-lg border border-[#1e3a8a] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e3a8a] shadow-sm hover:bg-slate-50">+ OKR cá nhân</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-slate-700">Hiển thị tất cả OKR đang hoạt động theo <b>ngày hôm nay ({today.split('-').reverse().join('/')})</b> — chưa lưu trữ và chưa Hoàn thành. Quá hạn (đến ngày &lt; hôm nay) sẽ báo đỏ: hãy <b>Kết thúc & Lưu trữ</b> hoặc <b>Sửa OKR</b> để gia hạn.</p>
          {canManage && (
            <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Hiện đã lưu trữ
            </label>
          )}
        </div>

        <OkrDialog open={openCompany} onClose={() => setOpenCompany(false)} onDone={onDone} isCompany={true} />
        <OkrDialog open={openPersonal} onClose={() => setOpenPersonal(false)} onDone={onDone} isCompany={false} />

        <div key={refreshKey}>
          <OkrTree showArchived={canManage ? showArchived : false} activeOnly />
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() {
  return <RequireAuth><Screen /></RequireAuth>;
}
