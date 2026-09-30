'use client';
import { useEffect, useState } from 'react';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function BoxDetailPage({ params }: { params: { id: string } }) {
  const { can } = useAuth();
  const router = useRouter();
  const [box, setBox] = useState<Box | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState('');

  const canView = can('xem_box') || can('quan_ly_cai_dat');

  async function loadBox() {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const r = await fetch(`/api/box/${params.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const j = await r.json();
      if (r.ok) {
        setBox(j);
        setNote(j.metadata?.note ?? '');
      } else {
        setError(j.error ?? 'Không tải được');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Lỗi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (canView) loadBox(); }, [canView]);

  async function handleActivate() {
    if (!activationCode.trim()) {
      alert('Nhập mã kích hoạt');
      return;
    }
    setActivating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const r = await fetch('/api/box/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: params.id, activation_code: activationCode.trim() }),
      });
      const j = await r.json();
      if (r.ok) {
        alert('Đã kích hoạt thành công!');
        loadBox();
        setActivationCode('');
      } else {
        alert(j.error ?? 'Lỗi kích hoạt');
      }
    } catch (e: any) {
      alert(e?.message ?? 'Lỗi');
    } finally {
      setActivating(false);
    }
  }

  async function handleSaveNote() {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const r = await fetch(`/api/box/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ metadata: { ...(box?.metadata ?? {}), note: note.trim() } }),
      });
      const j = await r.json();
      if (r.ok) {
        alert('Đã lưu ghi chú!');
        loadBox();
        setEditingNote(false);
      } else {
        alert(j.error ?? 'Lỗi lưu');
      }
    } catch (e: any) {
      alert(e?.message ?? 'Lỗi');
    }
  }

  if (!canView) {
    return (
      <RequireAuth>
        <AppSidebar>
          <main className="w-full px-4 py-6 sm:px-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Bạn không có quyền xem module này.
            </div>
          </main>
        </AppSidebar>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppSidebar>
        <main className="w-full px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-3">
            <Link href="/quan-tri/box" className="text-sm text-[#1e3a8a] hover:underline">← Quay lại</Link>
          </div>

          {loading && <div className="py-10 text-center text-sm text-slate-600">Đang tải...</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {box && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-[#0f2a4a]">Thông tin Box</h2>

                <div className="space-y-4">
                  {/* Thiết bị */}
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-600">📱 Thiết bị</div>
                    <div className="space-y-1 pl-4 text-sm">
                      <div><span className="font-medium">Model:</span> {box.device_model}</div>
                      <div><span className="font-medium">Nhà sản xuất:</span> {box.device_manufacturer}</div>
                      <div><span className="font-medium">Android:</span> {box.android_version}</div>
                    </div>
                  </div>

                  {/* Định danh */}
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-600">🔑 Định danh</div>
                    <div className="space-y-1 pl-4 text-sm font-mono">
                      <div><span className="font-medium font-sans">Android ID:</span> {box.android_id || 'N/A'}</div>
                      <div><span className="font-medium font-sans">IMEI:</span> {box.imei || 'N/A'}</div>
                      <div><span className="font-medium font-sans">Serial:</span> {box.serial_number || 'N/A'}</div>
                    </div>
                  </div>

                  {/* App */}
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-600">📦 App</div>
                    <div className="space-y-1 pl-4 text-sm">
                      <div><span className="font-medium">Phiên bản:</span> {box.app_version_name} (code {box.app_version_code})</div>
                    </div>
                  </div>

                  {/* Thời gian */}
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-600">⏰ Thời gian</div>
                    <div className="space-y-1 pl-4 text-sm">
                      <div><span className="font-medium">Lần đầu:</span> {fmtDate(box.first_seen_at)}</div>
                      <div><span className="font-medium">Lần cuối:</span> {fmtDate(box.last_seen_at)}</div>
                    </div>
                  </div>

                  {/* Kích hoạt */}
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-600">✅ Kích hoạt</div>
                    <div className="space-y-2 pl-4 text-sm">
                      <div>
                        <span className="font-medium">Trạng thái:</span>{' '}
                        {box.is_activated ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Đã kích hoạt</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">⚠ Chưa kích hoạt</span>
                        )}
                      </div>
                      {box.is_activated && (
                        <>
                          <div><span className="font-medium">Mã:</span> {box.activation_code}</div>
                          <div><span className="font-medium">Kích hoạt lúc:</span> {box.activated_at ? fmtDate(box.activated_at) : 'N/A'}</div>
                        </>
                      )}
                      {!box.is_activated && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={activationCode}
                            onChange={(e) => setActivationCode(e.target.value)}
                            placeholder="Nhập mã kích hoạt..."
                            className="w-64 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1e3a8a]"
                          />
                          <button
                            onClick={handleActivate}
                            disabled={activating}
                            className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {activating ? 'Đang xử lý...' : 'Kích hoạt'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ghi chú */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-600">📝 Ghi chú</div>
                      {!editingNote && (
                        <button onClick={() => setEditingNote(true)} className="text-sm font-semibold text-[#1e3a8a] hover:underline">Sửa</button>
                      )}
                    </div>
                    {editingNote ? (
                      <div className="space-y-2 pl-4">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={4}
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a]"
                          placeholder="Nhập ghi chú..."
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveNote} className="rounded-md bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af]">Lưu</button>
                          <button onClick={() => { setEditingNote(false); setNote(box.metadata?.note ?? ''); }} className="rounded-md border border-slate-200 px-4 py-1.5 text-sm font-semibold hover:bg-slate-50">Hủy</button>
                        </div>
                      </div>
                    ) : (
                      <div className="pl-4 text-sm text-slate-600">{box.metadata?.note || '(Chưa có ghi chú)'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </AppSidebar>
    </RequireAuth>
  );
}
