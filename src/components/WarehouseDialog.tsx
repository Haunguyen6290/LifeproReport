'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { SingleCombobox } from '@/components/SingleCombobox';
import { categoryItems, type CategoryItem } from '@/lib/categories';
import { notifyTelegram } from '@/lib/notify';
import { fmtDateVN } from '@/lib/time';

const TRANG_THAI: string[] = ['Chờ giải quyết', 'Đang giải quyết', 'Đã xử lý'];
const DON_VI: string[] = ['Bộ', 'Chiếc', 'Chai', 'Lọ', 'Túi'];

export type WarehouseInitial = {
  id?: string;
  ngay?: string;
  product_group_id?: string | null;
  nhom_van_de_id?: string | null;
  so_luong?: number | string | null;
  thuc_trang?: string;
  de_xuat?: string;
  trang_thai?: string;
  y_kien_quan_ly?: string;
  tuan_tu?: string | null;
  tuan_den?: string | null;
  items?: { product_group_id: string; so_luong: string; don_vi: string; tinh_trang: string }[];
};

type ItemRow = { product_group_id: string; so_luong: string; don_vi: string; tinh_trang: string };

export function WarehouseDialog({
  open,
  onClose,
  onDone,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  initial?: WarehouseInitial | null;
}) {
  const { can } = useAuth();
  const authAny: any = useAuth();
  const authUserId: string = (authAny?.userId ?? '') as string;
  const canManage = can('quan_ly_okr');

  const isEdit = !!initial?.id;

  const [ngay, setNgay] = useState('');
  const [kho, setKho] = useState(''); // Thêm field kho nếu cần
  const [thucTrang, setThucTrang] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ product_group_id: '', so_luong: '', don_vi: 'Bộ', tinh_trang: '' }]);
  const [deXuat, setDeXuat] = useState('');
  const [trangThai, setTrangThai] = useState<string>(TRANG_THAI[0]);
  const [yKien, setYKien] = useState('');

  const [sanPhamItems, setSanPhamItems] = useState<CategoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setMsg('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [a] = await Promise.all([categoryItems('san_pham')]);
        if (!cancelled) {
          setSanPhamItems(a);
        }
      } catch {
        if (!cancelled) {
          setSanPhamItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setNgay((initial.ngay ?? new Date().toISOString().slice(0, 10)) as string);
      setThucTrang(initial.thuc_trang ?? '');
      if (initial.items && initial.items.length > 0) {
        setItems(initial.items);
      } else if (initial.product_group_id || initial.so_luong) {
        setItems([{ product_group_id: initial.product_group_id ?? '', so_luong: initial.so_luong != null ? String(initial.so_luong) : '', don_vi: 'Bộ', tinh_trang: '' }]);
      } else {
        setItems([{ product_group_id: '', so_luong: '', don_vi: 'Bộ', tinh_trang: '' }]);
      }
      setDeXuat(initial.de_xuat ?? '');
      setTrangThai((initial.trang_thai as string) ?? TRANG_THAI[0]);
      setYKien(initial.y_kien_quan_ly ?? '');
    } else {
      setNgay(new Date().toISOString().slice(0, 10));
      setThucTrang('');
      setItems([{ product_group_id: '', so_luong: '', don_vi: 'Bộ', tinh_trang: '' }]);
      setDeXuat('');
      setTrangThai(TRANG_THAI[0]);
      setYKien('');
    }
  }, [open, initial]);

  function weekOf(dateStr: string): { tuan_tu: string | null; tuan_den: string | null } {
    if (!dateStr) return { tuan_tu: null, tuan_den: null };
    const d = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d.getTime())) return { tuan_tu: null, tuan_den: null };
    const day = d.getUTCDay() || 7;
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - (day - 1));
    const sat = new Date(mon);
    sat.setUTCDate(mon.getUTCDate() + 5);
    return { tuan_tu: mon.toISOString().slice(0, 10), tuan_den: sat.toISOString().slice(0, 10) };
  }

  async function handleSave() {
    const t = thucTrang.trim();
    if (!t) {
      setMsg('Vấn đề/Thực trạng không được trống');
      return;
    }
    if (!TRANG_THAI.includes(trangThai)) {
      setMsg('Trạng thái không hợp lệ');
      return;
    }
    const cleanItems = items.filter((it) => it.product_group_id || it.so_luong.trim() || it.tinh_trang.trim());
    setBusy(true);
    setMsg('');
    try {
      const uid = authUserId || (await supabase.auth.getUser()).data.user?.id || '';
      if (!uid) {
        setMsg('Chưa đăng nhập');
        setBusy(false);
        return;
      }
      const wk = weekOf(ngay);
      // Giữ lại product_group_id/so_luong cũ cho tương thích (lấy dòng đầu nếu có)
      const firstItem = cleanItems[0] || { product_group_id: '', so_luong: '', don_vi: '', tinh_trang: '' };
      const payload: Record<string, unknown> = {
        user_id: uid,
        ngay: ngay || new Date().toISOString().slice(0, 10),
        product_group_id: firstItem.product_group_id || null,
        so_luong: firstItem.so_luong.trim() === '' ? null : Number(firstItem.so_luong),
        thuc_trang: t,
        de_xuat: deXuat.trim(),
        trang_thai: trangThai,
        tuan_tu: wk.tuan_tu,
        tuan_den: wk.tuan_den,
        items: cleanItems.length > 0 ? cleanItems : null,
      };
      if (canManage) {
        (payload as any).y_kien_quan_ly = yKien.trim();
      } else if (!isEdit) {
        (payload as any).y_kien_quan_ly = '';
      }

      let savedId: string | null = initial?.id ?? null;
      let error: any = null;
      if (isEdit && savedId) {
        const patch: Record<string, unknown> = { ...payload };
        if (!canManage) delete (patch as any).y_kien_quan_ly;
        const res = await supabase.from('warehouse_reports').update(patch).eq('id', savedId).select('id').single();
        error = res.error;
        savedId = (res.data as any)?.id ?? savedId;
      } else {
        const res = await supabase.from('warehouse_reports').insert(payload as any).select('id').single();
        error = res.error;
        savedId = (res.data as any)?.id ?? null;
      }
      if (error) {
        setMsg(error.message ?? 'Không lưu được');
        setBusy(false);
        return;
      }

      try {
        const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
        const fullName = (me2 as any)?.full_name ?? '';
        await supabase.from('audit_logs').insert({
          actor_id: uid,
          action: isEdit ? 'Sửa báo cáo kho' : 'Tạo báo cáo kho',
          entity_type: 'warehouse_report',
          entity_id: savedId,
          details: {
            ngay,
            thuc_trang: t.slice(0, 500),
            trang_thai: trangThai,
            full_name: fullName,
          },
        });
      } catch {}

      const _ngayW = ngay, _ttW = trangThai, _tW = t.slice(0, 300);
      const _uidW = uid;
      notifyTelegram('TB_BAO_CAO_KHO', (nm) => {
        return `[Báo cáo kho] ${_ngayW} · ${_ttW}\nNgười gửi: ${nm}\n${_tW}`;
      }, _uidW);

      setBusy(false);
      onDone?.();
      onClose();
    } catch (e: any) {
      setMsg(e?.message ?? 'Lỗi không xác định');
      setBusy(false);
    }
  }

  const sel =
    'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] disabled:opacity-60';
  const LABEL = 'mb-1 block text-xs font-bold uppercase tracking-wider text-[#1e3a8a]';

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? 'Sửa báo cáo kho' : 'Thêm báo cáo kho'} size="xwide">
      <div className="grid gap-4">
        {/* Hàng 1: Kho + Ngày */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Kho</label>
            <input value={kho} onChange={(e) => setKho(e.target.value)} placeholder="VD: Kho Hà Nội" className={sel} />
          </div>
          <div>
            <label className={LABEL}>Ngày *</label>
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className={sel} />
          </div>
        </div>

        {/* Hàng 2: Vấn đề thực trạng */}
        <div>
          <label className={LABEL}>Vấn đề / Thực trạng *</label>
          <GrowArea
            value={thucTrang}
            onChange={(e) => setThucTrang(e.target.value)}
            placeholder="Mô tả thực trạng kho…"
            className={`${sel} w-full`}
            rows={3}
          />
        </div>

        {/* Khu vực 3: Bảng nhiều dòng sản phẩm */}
        <div>
          <label className={LABEL}>Danh sách sản phẩm</label>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col style={{ width: '35%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col />
                <col style={{ width: 48 }} />
              </colgroup>
              <thead>
                <tr className="bg-[#eff6ff] text-left text-[#1e3a8a]">
                  <th className="px-3 py-2 text-xs font-bold">Nhóm sản phẩm</th>
                  <th className="px-3 py-2 text-xs font-bold">Số lượng</th>
                  <th className="px-3 py-2 text-xs font-bold">Đơn vị tính</th>
                  <th className="px-3 py-2 text-xs font-bold">Tình trạng</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="px-3 py-2">
                      <SingleCombobox
                        options={sanPhamItems.map((sp) => ({ id: sp.id, label: sp.name }))}
                        value={it.product_group_id}
                        onChange={(v) => setItems(items.map((x, i) => (i === idx ? { ...x, product_group_id: v } : x)))}
                        placeholder="Tìm nhóm…"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={it.so_luong}
                        onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, so_luong: e.target.value } : x)))}
                        placeholder="0"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-[#1e3a8a]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.don_vi}
                        onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, don_vi: e.target.value } : x)))}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-[#1e3a8a]"
                      >
                        {DON_VI.map((dv) => (
                          <option key={dv} value={dv}>
                            {dv}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        value={it.tinh_trang}
                        onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, tinh_trang: e.target.value } : x)))}
                        placeholder="Mô tả tình trạng…"
                        rows={2}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-[#1e3a8a] resize-y"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-red-300 hover:text-red-600"
                        aria-label="Xóa dòng"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setItems([...items, { product_group_id: '', so_luong: '', don_vi: 'Bộ', tinh_trang: '' }])}
            className="mt-2 text-xs font-semibold text-[#1e3a8a] hover:underline"
          >
            + Thêm dòng
          </button>
        </div>

        {/* Hàng cuối: Đề xuất + Trạng thái + Ý kiến quản lý */}
        <div>
          <label className={LABEL}>Đề xuất</label>
          <GrowArea
            value={deXuat}
            onChange={(e) => setDeXuat(e.target.value)}
            placeholder="Đề xuất xử lý…"
            className={`${sel} w-full`}
            rows={2}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Trạng thái {can('quan_ly_okr') || can('quan_ly_nguoi_dung') ? '' : '(chỉ quản lý đổi)'}</label>
            <select value={trangThai} onChange={(e) => setTrangThai(e.target.value)} className={sel} disabled={!(can('quan_ly_okr') || can('quan_ly_nguoi_dung'))}>
              {TRANG_THAI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Ý kiến quản lý {canManage ? '' : '(chỉ quản lý sửa)'}</label>
            <input
              value={yKien}
              onChange={(e) => setYKien(e.target.value)}
              placeholder={canManage ? 'Ý kiến quản lý…' : '—'}
              disabled={!canManage}
              className={sel}
            />
          </div>
        </div>

        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <div className="flex items-center justify-end gap-2">
          {isEdit && trangThai === 'Đã xử lý' && can('quan_ly_nguoi_dung') && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Xóa báo cáo này?')) return;
                const { error } = await supabase.from('warehouse_reports').delete().eq('id', initial!.id!);
                if (!error) {
                  onDone?.();
                  onClose();
                }
              }}
              className="mr-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Xóa
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !thucTrang.trim()}
            className="rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60"
          >
            {busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
