'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { SingleCombobox } from '@/components/SingleCombobox';
import { categoryItems, type CategoryItem } from '@/lib/categories';
import { fmtDateVN, fmtCommentTimeVN } from '@/lib/time';

const TRANG_THAI: string[] = ['Chờ giải quyết', 'Đang giải quyết', 'Đã xử lý'];

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
};

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
  const [productGroupId, setProductGroupId] = useState('');
  const [nhomVanDeId, setNhomVanDeId] = useState('');
  const [soLuong, setSoLuong] = useState('');
  const [thucTrang, setThucTrang] = useState('');
  const [deXuat, setDeXuat] = useState('');
  const [trangThai, setTrangThai] = useState<string>(TRANG_THAI[0]);
  const [yKien, setYKien] = useState('');

  const [sanPhamItems, setSanPhamItems] = useState<CategoryItem[]>([]);
  const [vanDeItems, setVanDeItems] = useState<CategoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setMsg('');
  }, [open]);

  // load danh mục khi mở dialog
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([categoryItems('san_pham'), categoryItems('nhom_van_de_kho')]);
        if (!cancelled) {
          setSanPhamItems(a);
          setVanDeItems(b);
        }
      } catch {
        if (!cancelled) {
          setSanPhamItems([]);
          setVanDeItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // hydrate từ initial
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setNgay((initial.ngay ?? new Date().toISOString().slice(0, 10)) as string);
      setProductGroupId((initial.product_group_id ?? '') as string);
      setNhomVanDeId((initial.nhom_van_de_id ?? '') as string);
      setSoLuong(initial.so_luong != null && String(initial.so_luong).trim() !== '' ? String(initial.so_luong) : '');
      setThucTrang(initial.thuc_trang ?? '');
      setDeXuat(initial.de_xuat ?? '');
      setTrangThai((initial.trang_thai as string) ?? TRANG_THAI[0]);
      setYKien(initial.y_kien_quan_ly ?? '');
    } else {
      setNgay(new Date().toISOString().slice(0, 10));
      setProductGroupId('');
      setNhomVanDeId('');
      setSoLuong('');
      setThucTrang('');
      setDeXuat('');
      setTrangThai(TRANG_THAI[0]);
      setYKien('');
    }
  }, [open, initial]);

  // tính tuan_tu/tuan_den T2->T7 chứa ngay (để server lịch sử nhóm theo tuần)
  function weekOf(dateStr: string): { tuan_tu: string | null; tuan_den: string | null } {
    if (!dateStr) return { tuan_tu: null, tuan_den: null };
    const d = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d.getTime())) return { tuan_tu: null, tuan_den: null };
    const day = d.getUTCDay() || 7; // 1..7
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
    const trimmedSoLuong = soLuong.trim();
    if (trimmedSoLuong !== '' && Number.isNaN(Number(trimmedSoLuong))) {
      setMsg('Số lượng không hợp lệ');
      return;
    }
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
      const payload: Record<string, unknown> = {
        user_id: uid,
        ngay: ngay || new Date().toISOString().slice(0, 10),
        product_group_id: productGroupId || null,
        nhom_van_de_id: nhomVanDeId || null,
        so_luong: trimmedSoLuong === '' ? null : Number(trimmedSoLuong),
        thuc_trang: t,
        de_xuat: deXuat.trim(),
        trang_thai: trangThai,
        tuan_tu: wk.tuan_tu,
        tuan_den: wk.tuan_den,
      };
      // y_kien_quan_ly chỉ quản lý được sửa — nếu không có quyền thì không gửi field đó khi edit tạo
      // khi tạo mới, để '' (default). Khi sửa mà không có quyền, giữ nguyên giá trị cũ bằng cách không set.
      if (canManage) {
        (payload as any).y_kien_quan_ly = yKien.trim();
      } else if (!isEdit) {
        (payload as any).y_kien_quan_ly = '';
      }

      let savedId: string | null = initial?.id ?? null;
      let error: any = null;
      if (isEdit && savedId) {
        // không cho non-manager ghi đè y_kien_quan_ly
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

      // audit_logs + full_name snapshot (không chặn lưu)
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
            product_group_id: productGroupId || null,
            nhom_van_de_id: nhomVanDeId || null,
            thuc_trang: t.slice(0, 500),
            trang_thai: trangThai,
            full_name: fullName,
          },
        });
      } catch {}

      // telegram via /api/telegram (không chặn lưu)
      try {
        const { data: me3 } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
        const nm = (me3 as any)?.full_name ?? '';
        const grpName = sanPhamItems.find((x) => x.id === productGroupId)?.name ?? (productGroupId ? productGroupId.slice(0, 8) : '—');
        const vdName = vanDeItems.find((x) => x.id === nhomVanDeId)?.name ?? '';
        const prefix = '[Bao cao kho]';
        const line2 = vdName ? `Nhom van de: ${vdName}` : '';
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventKey: 'TB_BAO_CAO_KHO',
            text: `${prefix} ${ngay} · Nhom SP: ${grpName} · ${trangThai}\nNguoi gui: ${nm}\n${line2}${line2 ? '\n' : ''}${t.slice(0, 300)}`,
          }),
        });
      } catch {}

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
  const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700';

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? 'Sửa báo cáo kho' : 'Thêm báo cáo kho'}>
      <div className="grid gap-4">
        {/* Card tóm tắt trực quan khi sửa */}
        {isEdit && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>Ngày: <b className="text-slate-900">{fmtDateVN(ngay)} · {initial?.id ? (soLuong.trim() !== '' ? `SL: ${soLuong}` : 'SL: —') : ''}</b></span>
              <span>Nhóm SP: <b className="text-slate-900">{sanPhamItems.find((x) => x.id === productGroupId)?.name ?? '—'}</b></span>
              <span>Nhóm vấn đề: <b className="text-slate-900">{vanDeItems.find((x) => x.id === nhomVanDeId)?.name ?? '—'}</b></span>
            </div>
            {(thucTrang || deXuat) && (
              <div className="mt-2 space-y-1 text-sm">
                {thucTrang && <p className="whitespace-pre-wrap text-slate-900">{thucTrang}</p>}
                {deXuat && <p className="whitespace-pre-wrap text-slate-600">Đề xuất: {deXuat}</p>}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Ngày *</label>
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className={sel} />
          </div>
          <div>
            <label className={LABEL}>Số lượng</label>
            <input
              type="number"
              inputMode="decimal"
              value={soLuong}
              onChange={(e) => setSoLuong(e.target.value)}
              placeholder="VD: 12"
              className={sel}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Nhóm sản phẩm</label>
            <SingleCombobox
              options={sanPhamItems.map((it) => ({ id: it.id, label: it.name }))}
              value={productGroupId}
              onChange={setProductGroupId}
              placeholder="Nhập tên nhóm để tìm…"
            />
            <p className="mt-1 text-xs text-slate-500">Nhập rồi mới hiện danh sách.</p>
          </div>
          <div>
            <label className={LABEL}>Nhóm vấn đề</label>
            <SingleCombobox
              options={vanDeItems.map((it) => ({ id: it.id, label: it.name }))}
              value={nhomVanDeId}
              onChange={setNhomVanDeId}
              placeholder="Nhập tên vấn đề để tìm…"
            />
          </div>
        </div>

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
            <button type="button" onClick={async () => { if (!confirm('Xóa báo cáo này?')) return; const { error } = await supabase.from('warehouse_reports').delete().eq('id', initial!.id!); if (!error) { onDone?.(); onClose(); } }} className="mr-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
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
