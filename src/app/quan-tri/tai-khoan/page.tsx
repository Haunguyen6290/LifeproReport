'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';

type U = { id: string; username: string; full_name: string; role_id: string; status: string; must_change_password: boolean };
type Role = { id: string; name: string };

const DEFAULT_PW = '123456';

function Screen() {
  const { userId, can } = useAuth();
  const [list, setList] = useState<U[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [newUser, setNewUser] = useState({ username: '', fullName: '', roleId: '', password: DEFAULT_PW });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('profiles').select('id, username, full_name, role_id, status, must_change_password').order('created_at');
    setList((data ?? []) as U[]);
    const { data: r } = await supabase.from('roles').select('id, name').order('name');
    setRoles((r ?? []) as Role[]);
  }
  useEffect(() => { load(); }, []);

  async function adminPost(body: any) {
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? 'Lỗi');
    return j;
  }

  async function create() {
    setMsg(''); setBusy(true);
    const username = newUser.username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(username)) { setMsg('Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm/gạch dưới (3–20 ký tự).'); setBusy(false); return; }
    if (!newUser.fullName.trim()) { setMsg('Phải nhập họ tên.'); setBusy(false); return; }
    if (!newUser.roleId) { setMsg('Phải chọn vai trò.'); setBusy(false); return; }
    if (list.some((u) => u.username === username)) { setMsg('Tên đăng nhập đã tồn tại.'); setBusy(false); return; }
    if (list.some((u) => u.full_name.toLowerCase() === newUser.fullName.trim().toLowerCase())) { setMsg('Đã có tài khoản mang họ tên này (tránh nhầm khi import).'); setBusy(false); return; }
    try {
      await adminPost({ action: 'create', username, fullName: newUser.fullName.trim(), roleId: newUser.roleId });
      setNewUser({ username: '', fullName: '', roleId: '', password: DEFAULT_PW }); load();
    } catch (e: any) { setMsg('Tạo thất bại: ' + e.message); }
    setBusy(false);
  }

  async function update(u: U, patch: Partial<U>) {
    try { await adminPost({ action: 'update', id: u.id, patch }); }
    catch (e: any) { setMsg('Lỗi: ' + e.message); return; }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Sửa tài khoản', entity_type: 'user', entity_id: u.id, details: { ...(patch as any), full_name: me2?.full_name ?? '' } }); } catch {}
    load();
  }

  async function resetPw(u: U) {
    if (!confirm(`Reset mật khẩu của ${u.full_name} về ${DEFAULT_PW}?

CẢNH BÁO: Nếu nhân viên vừa đổi mật khẩu, thao tác này sẽ ghi đè và họ phải đổi lại.`)) return;
    try { await adminPost({ action: 'resetPw', id: u.id }); }
    catch (e: any) { setMsg('Lỗi reset: ' + e.message); return; }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Reset mật khẩu', entity_type: 'user', entity_id: u.id, details: { to: DEFAULT_PW, full_name: me2?.full_name ?? '' } }); } catch {}
    load();
  }

  async function toggleLock(u: U) {
    if (u.id === userId) { setMsg('Không thể tự khóa chính mình.'); return; }
    const next = u.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    await update(u, { status: next });
  }

  if (!can('quan_ly_nguoi_dung')) return <AppSidebar><main className="px-6 py-10 text-slate-700">Bạn không có quyền quản lý tài khoản.</main></AppSidebar>;
  const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 backdrop-blur sm:p-5';

  return (
    <AppSidebar>

      <main className="w-full px-4 py-6 sm:px-6">
        <AdminTabs />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Tài khoản & phân quyền</h1>

        <div className={`${card} mb-4`}>
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Tạo tài khoản mới</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="Tên đăng nhập *" className={sel} />
            <input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Họ tên *" className={sel} />
            <select value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })} className={sel}><option value="">Vai trò…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <button onClick={create} disabled={busy} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang tạo…' : 'Tạo'}</button>
          </div>
          <p className="mt-1 text-xs text-slate-600">Mật khẩu mặc định: <code>{DEFAULT_PW}</code> — nhân viên phải đổi lần đầu đăng nhập.</p>
          {msg && <p className="mt-2 text-sm text-[var(--color-destructive)]">{msg}</p>}
        </div>

        <div className={card}>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-600"><th className="py-1">Tên đăng nhập</th><th className="py-1">Họ tên</th><th className="py-1">Vai trò</th><th className="py-1">Trạng thái</th><th className="py-1 text-right">Thao tác</th></tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.id} className="border-t border-slate-200">
                <td className="py-1 font-mono">{u.username}</td>
                <td className="py-1">{u.full_name}{u.must_change_password && <span className="ml-1 text-xs text-amber-700">(chưa đổi MK)</span>}</td>
                <td className="py-1"><select value={u.role_id} onChange={(e) => update(u, { role_id: e.target.value })} className="rounded border border-[var(--color-muted)] bg-transparent px-1 py-0.5 text-xs">{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                <td className="py-1">{u.status === 'ACTIVE' ? 'Hoạt động' : 'Khóa'}</td>
                <td className="py-1 text-right">
                  <button onClick={() => resetPw(u)} className="text-xs text-[#1e3a8a] hover:underline">Reset MK</button> ·
                  <button onClick={() => toggleLock(u)} className="text-xs text-amber-700 hover:underline">{u.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
