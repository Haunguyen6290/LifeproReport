'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';

export const PERMS: { key: string; label: string }[] = [
  { key: 'xem_khach_hang', label: 'Xem khách hàng' },
  { key: 'sua_khach_bat_ky', label: 'Sửa khách hàng (không phụ trách)' },
  { key: 'chuyen_khach_hang_loat', label: 'Chuyển khách hàng hàng loạt' },
  { key: 'xoa_khach', label: 'Xóa vĩnh viễn khách hàng' },
  { key: 'import_khach', label: 'Import Excel' },
  { key: 'import_tai_chinh', label: 'Import Excel Tài chính (sổ 131)' },
  { key: 'ket_luan', label: 'Kết luận tin/chiến dịch' },
  { key: 'quan_ly_chien_dich', label: 'Quản lý chiến dịch (tạo/sửa, OKR)' },
  { key: 'quan_ly_danh_muc', label: 'Quản lý danh mục' },
  { key: 'quan_ly_cai_dat', label: 'Quản lý cài đặt' },
  { key: 'quan_ly_nguoi_dung', label: 'Quản lý tài khoản' },
  { key: 'xem_log', label: 'Xem nhật ký' },
  { key: 'quan_ly_okr', label: 'Quản lý OKR' },
  { key: 'xem_okr', label: 'Xem OKR' },
  { key: 'bao_cao_tuan', label: 'Báo cáo tuần' },
  { key: 'bao_cao_kho', label: 'Báo cáo kho' },
  { key: 'bao_cao_ban_hang', label: 'Báo cáo bán hàng (doanh số)' },
  { key: 'xem_tai_chinh', label: 'Xem Tài chính (công nợ, thu tiền)' },
];

type Role = { id: string; name: string; description: string; permissions: string[]; is_system: boolean };

function Screen() {
  const { userId, can } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState('');

  async function load() {
    const { data } = await supabase.from('roles').select('id,name,description,permissions,is_system').order('name');
    setRoles(((data ?? []) as any[]).map((r) => ({ ...r, permissions: (r.permissions as string[]) ?? [] })));
  }
  useEffect(() => { load(); }, []);

  async function addRole() {
    if (!newName.trim()) return setMsg('Phải nhập tên vai trò.');
    const name = newName.trim().toUpperCase().replace(/\s+/g, '_');
    if (roles.some((r) => r.name === name)) return setMsg('Tên vai trò đã tồn tại.');
    const { error } = await supabase.from('roles').insert({ name, description: '', permissions: [] });
    if (error) { setMsg(error.message); return; }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Tạo vai trò', entity_type: 'role', entity_id: null, details: { name, full_name: me2?.full_name ?? '' } }); } catch {}
    setNewName(''); setMsg('Đã tạo vai trò.');
    load();
  }

  async function toggle(role: Role, perm: string) {
    const next = role.permissions.includes(perm) ? role.permissions.filter((p) => p !== perm) : [...role.permissions, perm];
    const { error } = await supabase.from('roles').update({ permissions: next }).eq('id', role.id);
    if (error) { setMsg(error.message); return; }
    setRoles((rs) => rs.map((r) => r.id === role.id ? { ...r, permissions: next } : r));
  }

  if (!can('quan_ly_nguoi_dung')) return <AppSidebar><main className="px-6 py-10 text-slate-700">Bạn không có quyền quản lý phân quyền.</main></AppSidebar>;
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]';
  const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6 text-slate-900">
        <AdminTabs />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Phân quyền</h1>
        <div className={`${card} mb-4 flex flex-wrap items-end gap-2`}>
          <div className="flex-1 min-w-[180px]"><label className="mb-1 block text-xs font-semibold">Thêm vai trò mới</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vd: Kế toán, Kho…" className={sel + ' w-full'} />
          </div>
          <button onClick={addRole} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">Thêm vai trò</button>
        </div>

        <div className={card}>
          <p className="mb-3 text-xs text-slate-600">Tích vào chức năng được phép sử dụng. Vai trò hệ thống (ADMIN/SALES) cũng sửa được, nhưng không xóa được.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-semibold text-[#0f2a4a]"><th className="py-2 pr-2 bg-[#eff6ff]">Vai trò</th>{PERMS.map((p) => <th key={p.key} className="px-2 py-2 text-center bg-[#eff6ff] border-l border-white" title={p.label}><span className="hidden sm:inline">{p.label}</span><span className="sm:hidden">{p.label.split(' ').slice(-1)[0]}</span></th>)}</tr></thead>
              <tbody>{roles.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="py-1 pr-2 font-medium">{r.name}{r.is_system && <span className="ml-1 text-xs text-slate-600">(hệ thống)</span>}</td>
                  {PERMS.map((p) => (
                    <td key={p.key} className="px-1 py-1 text-center"><input type="checkbox" checked={r.permissions.includes(p.key)} onChange={() => toggle(r, p.key)} className="h-4 w-4 accent-[var(--color-primary)]" aria-label={`${r.name} — ${p.label}`} /></td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
          {msg && <p className="mt-2 text-sm text-[#1e3a8a]">{msg}</p>}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
