'use client';
import { useEffect, useState } from 'react';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';
import { BoxDetailDialog } from '@/components/BoxDetailDialog';

type Box = {
  id: string;
  android_id: string | null;
  imei: string | null;
  serial_number: string | null;
  device_model: string;
  device_manufacturer: string;
  android_version: string;
  app_version_code: number;
  app_version_name: string;
  activation_code: string | null;
  is_activated: boolean;
  first_seen_at: string;
  last_seen_at: string;
  activated_at: string | null;
  metadata: any;
};

type Stats = {
  total: number;
  activated: number;
  notActivated: number;
  activatedPercent: string;
  newToday: number;
  active7days: number;
};

const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

function BoxList() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterActivated, setFilterActivated] = useState<string>('all'); // 'all' | 'true' | 'false'
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  async function loadStats() {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const r = await fetch('/api/box/stats', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const j = await r.json();
      if (r.ok) setStats(j);
    } catch {}
  }

  async function loadBoxes() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const params = new URLSearchParams({ page: String(page), limit: '50', search: appliedSearch });
      if (filterActivated !== 'all') params.set('activated', filterActivated);
      const r = await fetch(`/api/box/list?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const j = await r.json();
      if (r.ok) {
        setBoxes(j.boxes ?? []);
        setTotalPages(j.totalPages ?? 1);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadBoxes(); }, [page, filterActivated, appliedSearch]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  }

  return (
    <div>
      {/* Thống kê */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-600">Tổng box đã bán</div>
            <div className="mt-1 text-2xl font-bold text-[#0f2a4a]">{fmt(stats.total)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-600">Đã kích hoạt</div>
            <div className="mt-1 text-2xl font-bold text-green-600">{fmt(stats.activated)} <span className="text-sm">({stats.activatedPercent}%)</span></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-600">Chưa kích hoạt</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{fmt(stats.notActivated)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-600">Box mới hôm nay</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{fmt(stats.newToday)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold text-slate-600">Hoạt động 7 ngày</div>
            <div className="mt-1 text-2xl font-bold text-purple-600">{fmt(stats.active7days)}</div>
          </div>
        </div>
      )}

      {/* Filter + Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {[['all', 'Tất cả'], ['false', 'Chưa kích hoạt'], ['true', 'Đã kích hoạt']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setFilterActivated(val); setPage(1); }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filterActivated === val ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo Serial..."
            className="w-80 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]"
          />
          <button type="submit" className="rounded-md bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af]">Tìm</button>
        </form>
      </div>

      {/* Table */}
      {loading && <div className="py-10 text-center text-sm text-slate-600">Đang tải...</div>}
      {!loading && boxes.length === 0 && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">Chưa có box nào</div>}
      {!loading && boxes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">STT</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Model</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Nhà SX</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Android</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">App Ver</th>
                <th className="border-b border-slate-200 px-3 py-2 font-bold">Số Serial</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Lần đầu</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Lần cuối</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Trạng thái</th>
                <th className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {boxes.map((box, i) => (
                <tr key={box.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{(page - 1) * 50 + i + 1}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{box.device_model}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{box.device_manufacturer}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{box.android_version}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{box.app_version_name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{box.serial_number || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{fmtDate(box.first_seen_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{fmtDate(box.last_seen_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {box.is_activated ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">✓ Đã kích hoạt</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">⚠ Chưa kích hoạt</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      onClick={() => setSelectedBoxId(box.id)}
                      className="text-sm font-semibold text-[#1e3a8a] hover:underline"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            ← Trước
          </button>
          <span className="text-sm text-slate-600">Trang {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Sau →
          </button>
        </div>
      )}

      {/* Dialog */}
      {selectedBoxId && (
        <BoxDetailDialog
          boxId={selectedBoxId}
          onClose={() => setSelectedBoxId(null)}
        />
      )}
    </div>
  );
}

export default function BoxPage() {
  return (
    <RequireAuth>
      <BoxPageContent />
    </RequireAuth>
  );
}

function BoxPageContent() {
  const { can, isLoading } = useAuth();
  const canView = can('xem_box') || can('quan_ly_cai_dat');

  // Đợi permissions load xong
  if (isLoading) {
    return (
      <AppSidebar>
        <main className="w-full px-4 py-6 sm:px-6">
          <div className="py-10 text-center text-sm text-slate-600">Đang tải quyền...</div>
        </main>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#0f2a4a]">Quản lý Android Box</h1>
          <p className="mt-1 text-sm text-slate-600">Theo dõi các box Lifepro SmartVOICE đã bán</p>
        </div>

        {!canView ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bạn không có quyền xem module này. Liên hệ quản trị viên để được cấp quyền <b>xem_box</b>.
          </div>
        ) : (
          <BoxList />
        )}
      </main>
    </AppSidebar>
  );
}
