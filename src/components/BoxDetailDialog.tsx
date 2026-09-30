'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './RequireAuth';

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

const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

type Props = {
  boxId: string;
  onClose: () => void;
};

export function BoxDetailDialog({ boxId, onClose }: Props) {
  const { can } = useAuth();
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
      const r = await fetch(`/api/box/${boxId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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

  useEffect(() => {
    if (canView) loadBox();
  }, [boxId, canView]);

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
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id: boxId, activation_code: activationCode.trim() }),
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
      const r = await fetch(`/api/box/${boxId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-white rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-amber-800">Bạn không có quyền xem.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#0f2a4a]">Chi tiết Android Box</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-600">Đang tải...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : box ? (
            <div className="space-y-6">
              {/* Trạng thái */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  box.is_activated
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    box.is_activated ? 'bg-green-600' : 'bg-amber-600'
                  }`} />
                  {box.is_activated ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                </span>
              </div>

              {/* Thông tin định danh */}
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <h3 className="font-medium text-[#0f2a4a]">Định danh thiết bị</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex"><span className="w-32 text-slate-600">Android ID:</span><code className="text-xs bg-white px-2 py-0.5 rounded">{box.android_id || '—'}</code></div>
                  <div className="flex"><span className="w-32 text-slate-600">IMEI:</span><code className="text-xs bg-white px-2 py-0.5 rounded">{box.imei || '—'}</code></div>
                  <div className="flex"><span className="w-32 text-slate-600">Serial Number:</span><code className="text-xs bg-white px-2 py-0.5 rounded">{box.serial_number || '—'}</code></div>
                </div>
              </div>

              {/* Thông tin thiết bị */}
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <h3 className="font-medium text-[#0f2a4a]">Thông tin thiết bị</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex"><span className="w-32 text-slate-600">Model:</span><span className="font-medium">{box.device_model}</span></div>
                  <div className="flex"><span className="w-32 text-slate-600">Manufacturer:</span><span>{box.device_manufacturer}</span></div>
                  <div className="flex"><span className="w-32 text-slate-600">Android:</span><span>{box.android_version}</span></div>
                  <div className="flex"><span className="w-32 text-slate-600">App version:</span><span>{box.app_version_name} (build {box.app_version_code})</span></div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <h3 className="font-medium text-[#0f2a4a]">Thời gian</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex"><span className="w-32 text-slate-600">Lần đầu gửi:</span><span>{fmtDate(box.first_seen_at)}</span></div>
                  <div className="flex"><span className="w-32 text-slate-600">Lần cuối gửi:</span><span>{fmtDate(box.last_seen_at)}</span></div>
                  {box.activated_at && <div className="flex"><span className="w-32 text-slate-600">Kích hoạt lúc:</span><span>{fmtDate(box.activated_at)}</span></div>}
                </div>
              </div>

              {/* Kích hoạt */}
              {!box.is_activated && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <h3 className="font-medium text-blue-900">Kích hoạt Box</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value)}
                      placeholder="Nhập mã kích hoạt"
                      className="flex-1 rounded border border-blue-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={activating}
                    />
                    <button
                      onClick={handleActivate}
                      disabled={activating || !activationCode.trim()}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activating ? 'Đang xử lý...' : 'Kích hoạt'}
                    </button>
                  </div>
                </div>
              )}

              {/* Ghi chú */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[#0f2a4a]">Ghi chú</h3>
                  {!editingNote && (
                    <button
                      onClick={() => setEditingNote(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Sửa
                    </button>
                  )}
                </div>
                {editingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập ghi chú..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNote}
                        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => {
                          setEditingNote(false);
                          setNote(box.metadata?.note ?? '');
                        }}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">{box.metadata?.note || '(Chưa có ghi chú)'}</p>
                )}
              </div>

              {/* Metadata raw (debug) */}
              {Object.keys(box.metadata || {}).length > 0 && (
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-600">Metadata (JSON)</summary>
                  <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(box.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
