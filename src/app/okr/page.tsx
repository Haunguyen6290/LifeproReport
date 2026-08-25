'use client';
import { useState, useMemo } from 'react';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { OkrDialog } from '@/components/OkrDialog';
import { OkrTree } from '@/components/OkrTree';
import { periodLabel } from '@/lib/okr';

function quarterBounds(d: Date): { tu: string; den: string } {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-11
  const q = Math.floor(m / 3);
  const tuM = q * 3;
  const denM = q * 3 + 2;
  const tu = new Date(Date.UTC(y, tuM, 1)).toISOString().slice(0, 10);
  const lastDay = new Date(Date.UTC(y, denM + 1, 0)).getUTCDate();
  const den = new Date(Date.UTC(y, denM, lastDay)).toISOString().slice(0, 10);
  return { tu, den };
}

function Screen() {
  const { can } = useAuth();
  const defaults = useMemo(() => quarterBounds(new Date()), []);
  const [tu, setTu] = useState(defaults.tu);
  const [den, setDen] = useState(defaults.den);
  const [openCompany, setOpenCompany] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  function onDone() {
    setRefreshKey((k) => k + 1);
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  function applyKy(kind: string) {
    const now = new Date();
    const y = now.getFullYear();
    if (kind === 'thang') {
      const tu = new Date(Date.UTC(y, now.getMonth(), 1));
      const den = new Date(Date.UTC(y, now.getMonth() + 1, 0));
      setTu(iso(tu)); setDen(iso(den));
    } else if (kind === 'quy') {
      const q = quarterBounds(now);
      setTu(q.tu); setDen(q.den);
    } else if (kind === '6t') {
      const tu = new Date(Date.UTC(y, now.getMonth(), 1));
      const den = new Date(Date.UTC(y, now.getMonth() + 6, 0));
      setTu(iso(tu)); setDen(iso(den));
    } else if (kind === 'nam') {
      setTu(`${y}-01-01`); setDen(`${y}-12-31`);
    }
  }

  const canManage = can('quan_ly_okr');

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">OKR</h1>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <button
                onClick={() => setOpenCompany(true)}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-hover)]"
              >
                + OKR công ty
              </button>
            )}
            <button
              onClick={() => setOpenPersonal(true)}
              className="rounded-lg border border-[#1e3a8a] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e3a8a] shadow-sm hover:bg-slate-50"
            >
              + OKR cá nhân
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Từ ngày</label>
              <input
                type="date"
                value={tu}
                onChange={(e) => setTu(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Đến ngày</label>
              <input
                type="date"
                value={den}
                onChange={(e) => setDen(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Kỳ gợi ý</label>
              <select
                value=""
                onChange={(e) => applyKy(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
              >
                <option value="">— Chọn kỳ —</option>
                <option value="thang">Tháng này</option>
                <option value="quy">Quý này</option>
                <option value="6t">6 tháng</option>
                <option value="nam">Năm nay</option>
              </select>
            </div>
            <div className="pb-2 text-xs text-slate-500">
              {tu && den ? periodLabel(tu, den) : '—'}
            </div>
            {canManage && (
              <label className="ml-auto flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Hiện đã lưu trữ
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Chọn kỳ gợi ý hoặc tự đặt Từ ngày → Đến ngày (phát sinh không tròn tháng/quý). Cây hiển thị: O công ty → KR → O cá nhân → KR.
          </p>
        </div>

        <OkrDialog
          open={openCompany}
          onClose={() => setOpenCompany(false)}
          onDone={onDone}
          isCompany={true}
          period={{ tu, den }}
        />
        <OkrDialog
          open={openPersonal}
          onClose={() => setOpenPersonal(false)}
          onDone={onDone}
          isCompany={false}
          period={{ tu, den }}
        />

        <div key={refreshKey}>
          <OkrTree tu={tu} den={den} showArchived={canManage ? showArchived : false} />
        </div>
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
