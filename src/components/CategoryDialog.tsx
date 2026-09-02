'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { GrowArea } from '@/components/GrowArea';
import { Dialog } from '@/components/Dialog';

export function CategoryDialog({ open, onClose, onDone, dmName, initial, slug, userId, roles }: {
  open: boolean; onClose: () => void; onDone: () => void;
  dmName: string; slug: string; userId: string;
  roles?: string[];
  initial?: { id?: string; code?: string; name?: string; description?: string; extra?: any };
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [role, setRole] = useState<string>((initial?.extra as any)?.role ?? '');
  const [routesText, setRoutesText] = useState<string>(((initial?.extra as any)?.routes as string[] | undefined)?.join(', ') ?? '');
  const [macDinh, setMacDinh] = useState<boolean>(!!(initial?.extra as any)?.mac_dinh);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const isEdit = !!initial?.id;
  const showRole = (roles?.length ?? 0) > 0;
  const showPhanHe = slug === 'tro_ly_phan_he';
  const showNhom = slug === 'tro_ly_nhom';
  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';
  const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700';

  function parseRoutes(t: string): string[] {
    return t.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (s.startsWith('/') ? s : `/${s}`));
  }

  async function save() {
    if (!name.trim()) return setMsg('Phải nhập tên.');
    if (showRole && !role) return setMsg('Phải chọn Vai trò.');
    setBusy(true); setMsg('');
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', slug).single();
    const payload: any = { category_id: (cat as any).id, code: code.trim(), name: name.trim(), description: desc.trim() };
    const prevExtra = (initial?.extra as any) ?? {};
    if (showRole) payload.extra = { ...prevExtra, role };
    if (showPhanHe) payload.extra = { ...prevExtra, routes: parseRoutes(routesText), mac_dinh: macDinh };
    if (showNhom) {
      // Giữ "khóa" (extra.key = tên gốc nối với câu hỏi). Đổi Tên chỉ đổi chữ hiển thị, không đứt nối dữ liệu.
      const extra: any = { ...prevExtra };
      if (!extra.key) extra.key = initial?.name ?? name.trim();
      payload.extra = extra;
    }
    if (isEdit) {
      const { error } = await supabase.from('category_items').update(payload).eq('id', initial!.id!);
      if (error) { setMsg(error.message.includes('unique') ? 'Tên đã tồn tại trong danh mục này.' : error.message); setBusy(false); return; }
    } else {
      const { data: all } = await supabase.from('category_items').select('sort_order').eq('category_id', (cat as any).id);
      payload.sort_order = (all?.length ?? 0);
      const { error } = await supabase.from('category_items').insert(payload);
      if (error) { setMsg(error.message.includes('unique') ? 'Tên đã tồn tại trong danh mục này.' : error.message); setBusy(false); return; }
    }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: isEdit ? 'Sửa danh mục' : 'Thêm danh mục', entity_type: 'category', entity_id: null, details: { slug, name: name.trim(), role: showRole ? role : undefined, full_name: me2?.full_name ?? '' } }); } catch {}
    setBusy(false); onDone(); onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? `Sửa trong “${dmName}”` : `Thêm vào “${dmName}”`}>
      <div className="grid gap-3">
        <div><label className={LABEL}>Mã</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: A+, HM-CUAHANG" className={sel} /></div>
        <div><label className={LABEL}>Tên *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên danh mục *" className={sel} /></div>
        {showRole && (
          <div><label className={LABEL}>Vai trò *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={sel}>
              <option value="">— Chọn vai trò —</option>
              {(roles ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Nhân viên chỉ thấy mẫu đúng với vai trò của mình.</p>
          </div>
        )}
        {showPhanHe && (
          <div>
            <label className={LABEL}>Đường dẫn trang (phân cách bằng dấu phẩy)</label>
            <input value={routesText} onChange={(e) => setRoutesText(e.target.value)} placeholder="VD: /bao-cao-tuan, /ke-hoach" className={sel} />
            <p className="mt-1 text-xs text-slate-500">Phân hệ này sẽ hiện bot ở các trang có đường dẫn bắt đầu bằng các giá trị trên.</p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={macDinh} onChange={(e) => setMacDinh(e.target.checked)} />
              <span>Dùng làm mặc định cho trang chưa cấu hình</span>
            </label>
          </div>
        )}
        {showNhom && (
          <p className="text-xs text-slate-500">
            Đây là <b>tên nhóm</b> hiển thị trong ô chat. Đổi tên ở đây là bot đổi theo; các câu hỏi thuộc nhóm (chọn trong Trợ lý → Sửa QA) vẫn giữ nguyên, không bị mất.
          </p>
        )}
        <div><label className={LABEL}>Mô tả</label><GrowArea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mô tả (tùy chọn)" className={sel} rows={2} /></div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button><button onClick={save} disabled={busy || !name.trim()} className="rounded-lg bg-[#1e3a8a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Thêm'}</button></div>
      </div>
    </Dialog>
  );
}
