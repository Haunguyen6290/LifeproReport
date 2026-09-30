'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './RequireAuth';

type Box = {
  id: string;
  android_id: string | null;
  imei: string | null;
  serial_number: string | null;
  box_name: string | null;
  device_model: string;
  device_manufacturer: string;
  android_version: string;
  android_sdk_int: number | null;
  app_version_code: number;
  app_version_name: string;

  // Hardware
  screen_resolution: string | null;
  screen_density_dpi: number | null;
  screen_size_inches: number | null;
  ram_total_mb: number | null;
  ram_available_mb: number | null;
  storage_total_gb: number | null;
  storage_available_gb: number | null;
  cpu_abi: string | null;
  cpu_cores: number | null;

  // System
  build_fingerprint: string | null;
  build_brand: string | null;
  build_product: string | null;
  locale: string | null;
  timezone: string | null;

  // Network
  network_operator: string | null;
  network_country: string | null;

  // Customer
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  vehicle_info: string | null;
  dealer_name: string | null;
  installation_date: string | null;

  // Activation
  activation_code: string | null;
  is_activated: boolean;
  activated_at: string | null;
  activation_expires_at: string | null;

  // Status
  status: string;
  warranty_until: string | null;
  notes: string | null;

  // Timestamps
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;

  metadata: any;
};

const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

const fmtGB = (gb: number | null) => gb ? `${gb.toFixed(2)} GB` : '—';
const fmtMB = (mb: number | null) => mb ? `${(mb / 1024).toFixed(2)} GB` : '—';

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    box_name: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    vehicle_info: '',
    dealer_name: '',
    installation_date: '',
    status: 'active',
    warranty_until: '',
    notes: ''
  });

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
        setEditForm({
          box_name: j.box_name || '',
          customer_name: j.customer_name || '',
          customer_phone: j.customer_phone || '',
          customer_address: j.customer_address || '',
          vehicle_info: j.vehicle_info || '',
          dealer_name: j.dealer_name || '',
          installation_date: j.installation_date || '',
          status: j.status || 'active',
          warranty_until: j.warranty_until || '',
          notes: j.notes || ''
        });
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

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? '';
      const r = await fetch(`/api/box/${boxId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(editForm),
      });
      const j = await r.json();
      if (r.ok) {
        alert('Đã lưu thành công!');
        loadBox();
        setEditing(false);
      } else {
        alert(j.error ?? 'Lỗi lưu');
      }
    } catch (e: any) {
      alert(e?.message ?? 'Lỗi');
    } finally {
      setSaving(false);
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
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
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
                {box.status && (
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                    {box.status === 'active' ? 'Hoạt động' : box.status === 'warranty' ? 'Bảo hành' : box.status === 'inactive' ? 'Ngừng' : box.status}
                  </span>
                )}
              </div>

              {/* Tên box */}
              {box.box_name && (
                <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
                  <div className="text-sm font-semibold text-blue-900">Tên Box</div>
                  <div className="mt-1 text-lg font-bold text-blue-900">{box.box_name}</div>
                </div>
              )}

              {/* Grid 2 cột */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Thông tin định danh */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <h3 className="font-medium text-[#0f2a4a]">Định danh thiết bị</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-slate-600">Android ID:</span><br/><code className="text-xs bg-white px-2 py-0.5 rounded">{box.android_id || '—'}</code></div>
                    <div><span className="text-slate-600">IMEI:</span><br/><code className="text-xs bg-white px-2 py-0.5 rounded">{box.imei || '—'}</code></div>
                    <div><span className="text-slate-600">Serial:</span><br/><code className="text-xs bg-white px-2 py-0.5 rounded">{box.serial_number || '—'}</code></div>
                  </div>
                </div>

                {/* Thông tin thiết bị */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <h3 className="font-medium text-[#0f2a4a]">Thông tin thiết bị</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-slate-600">Model:</span> <span className="font-medium">{box.device_model}</span></div>
                    <div><span className="text-slate-600">Nhà SX:</span> {box.device_manufacturer}</div>
                    <div><span className="text-slate-600">Android:</span> {box.android_version} {box.android_sdk_int ? `(SDK ${box.android_sdk_int})` : ''}</div>
                    <div><span className="text-slate-600">App:</span> {box.app_version_name} (build {box.app_version_code})</div>
                  </div>
                </div>

                {/* Cấu hình phần cứng */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <h3 className="font-medium text-[#0f2a4a]">Cấu hình phần cứng</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-slate-600">RAM:</span> {fmtMB(box.ram_total_mb)} {box.ram_available_mb && `(free: ${fmtMB(box.ram_available_mb)})`}</div>
                    <div><span className="text-slate-600">Storage:</span> {fmtGB(box.storage_total_gb)} {box.storage_available_gb && `(free: ${fmtGB(box.storage_available_gb)})`}</div>
                    <div><span className="text-slate-600">CPU:</span> {box.cpu_cores ? `${box.cpu_cores} cores` : '—'} {box.cpu_abi && `(${box.cpu_abi})`}</div>
                    <div><span className="text-slate-600">Màn hình:</span> {box.screen_resolution || '—'} {box.screen_size_inches && `(${box.screen_size_inches}")`}</div>
                  </div>
                </div>

                {/* Thời gian */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <h3 className="font-medium text-[#0f2a4a]">Thời gian</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-slate-600">Lần đầu:</span> {fmtDate(box.first_seen_at)}</div>
                    <div><span className="text-slate-600">Lần cuối:</span> {fmtDate(box.last_seen_at)}</div>
                    {box.activated_at && <div><span className="text-slate-600">Kích hoạt:</span> {fmtDate(box.activated_at)}</div>}
                  </div>
                </div>
              </div>

              {/* Thông tin khách hàng - form edit */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[#0f2a4a]">Thông tin khách hàng & xe</h3>
                  {!editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Sửa
                    </button>
                  )}
                </div>
                {editing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Tên Box</label>
                        <input
                          value={editForm.box_name}
                          onChange={(e) => setEditForm({...editForm, box_name: e.target.value})}
                          className="w-full rounded border px-2 py-1.5 text-sm"
                          placeholder="VD: Box Audi A4 - HN001"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Trạng thái</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          className="w-full rounded border px-2 py-1.5 text-sm"
                        >
                          <option value="active">Hoạt động</option>
                          <option value="inactive">Ngừng</option>
                          <option value="warranty">Bảo hành</option>
                          <option value="returned">Trả lại</option>
                          <option value="defective">Lỗi</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Tên khách hàng</label>
                        <input
                          value={editForm.customer_name}
                          onChange={(e) => setEditForm({...editForm, customer_name: e.target.value})}
                          className="w-full rounded border px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">SĐT khách hàng</label>
                        <input
                          value={editForm.customer_phone}
                          onChange={(e) => setEditForm({...editForm, customer_phone: e.target.value})}
                          className="w-full rounded border px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Địa chỉ</label>
                      <input
                        value={editForm.customer_address}
                        onChange={(e) => setEditForm({...editForm, customer_address: e.target.value})}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Thông tin xe</label>
                      <input
                        value={editForm.vehicle_info}
                        onChange={(e) => setEditForm({...editForm, vehicle_info: e.target.value})}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                        placeholder="VD: Audi A4 2020 - 30A-12345"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Đại lý</label>
                        <input
                          value={editForm.dealer_name}
                          onChange={(e) => setEditForm({...editForm, dealer_name: e.target.value})}
                          className="w-full rounded border px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Ngày lắp đặt</label>
                        <input
                          type="date"
                          value={editForm.installation_date}
                          onChange={(e) => setEditForm({...editForm, installation_date: e.target.value})}
                          className="w-full rounded border px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Bảo hành đến</label>
                      <input
                        type="date"
                        value={editForm.warranty_until}
                        onChange={(e) => setEditForm({...editForm, warranty_until: e.target.value})}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Ghi chú</label>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        rows={3}
                        className="w-full rounded border px-2 py-1.5 text-sm"
                        placeholder="Ghi chú quản lý..."
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(false);
                          setEditForm({
                            box_name: box.box_name || '',
                            customer_name: box.customer_name || '',
                            customer_phone: box.customer_phone || '',
                            customer_address: box.customer_address || '',
                            vehicle_info: box.vehicle_info || '',
                            dealer_name: box.dealer_name || '',
                            installation_date: box.installation_date || '',
                            status: box.status || 'active',
                            warranty_until: box.warranty_until || '',
                            notes: box.notes || ''
                          });
                        }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded hover:bg-slate-300"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {box.customer_name && <div><span className="text-slate-600">Khách hàng:</span> <span className="font-medium">{box.customer_name}</span></div>}
                    {box.customer_phone && <div><span className="text-slate-600">SĐT:</span> {box.customer_phone}</div>}
                    {box.customer_address && <div><span className="text-slate-600">Địa chỉ:</span> {box.customer_address}</div>}
                    {box.vehicle_info && <div><span className="text-slate-600">Xe:</span> {box.vehicle_info}</div>}
                    {box.dealer_name && <div><span className="text-slate-600">Đại lý:</span> {box.dealer_name}</div>}
                    {box.installation_date && <div><span className="text-slate-600">Ngày lắp:</span> {new Date(box.installation_date).toLocaleDateString('vi-VN')}</div>}
                    {box.warranty_until && <div><span className="text-slate-600">Bảo hành đến:</span> {new Date(box.warranty_until).toLocaleDateString('vi-VN')}</div>}
                    {box.notes && <div><span className="text-slate-600">Ghi chú:</span> {box.notes}</div>}
                    {!box.customer_name && !box.customer_phone && !box.vehicle_info && !box.notes && (
                      <div className="text-slate-500 italic">Chưa có thông tin khách hàng</div>
                    )}
                  </div>
                )}
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
