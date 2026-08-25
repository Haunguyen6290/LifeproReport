'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';

/** Hộp Duyệt / Xác nhận / Góp ý của quản lý — dùng chung cho card Kế hoạch & Báo cáo tuần */
export function ApprovalBox({
  table,
  id,
  trangThai,
  yKien,
  onDone,
}: {
  table: 'weekly_plans' | 'weekly_reports';
  id: string;
  trangThai: string;
  yKien: string;
  onDone: () => void;
}) {
  const { userId, can } = useAuth();
  const canManage = can('quan_ly_okr');
  const [duyet, setDuyet] = useState(trangThai || 'Chờ duyệt');
  const [ykien, setYkien] = useState(yKien || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ trang_thai_duyet: duyet, y_kien_quan_ly: ykien, duyet_boi: userId, duyet_luc: new Date().toISOString() })
        .eq('id', id);
      if (!error) onDone();
    } catch {}
    setBusy(false);
  }

  if (canManage) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-700">Duyệt / Góp ý của quản lý</p>
        <div className="flex flex-wrap gap-2">
          <select value={duyet} onChange={(e) => setDuyet(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option>Chờ duyệt</option>
            <option>Đã duyệt</option>
            <option>Cần sửa lại</option>
          </select>
          <input value={ykien} onChange={(e) => setYkien(e.target.value)} placeholder="Ý kiến quản lý…" className="min-w-[200px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
          <button onClick={save} disabled={busy} className="rounded-md bg-[#1e3a8a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
            {busy ? '…' : 'Lưu duyệt'}
          </button>
        </div>
      </div>
    );
  }
  if (yKien) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <span className="font-semibold">Quản lý:</span> {yKien}
      </div>
    );
  }
  return null;
}
