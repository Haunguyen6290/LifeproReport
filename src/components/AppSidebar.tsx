'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from './RequireAuth';
import { supabase } from '@/lib/supabase/client';
import { Avatar } from './Avatar';
import { AvatarDialog } from './AvatarDialog';

const ICON = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="10" width="7" height="11" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>,
  target: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>,
  package: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/></svg>,
};

export const LINKS: { href: string; label: string; icon: React.ReactNode; needs?: string[] }[] = [
  { href: '/', label: 'Tổng quan', icon: ICON.dashboard, needs: ['quan_ly_okr', 'xem_okr', 'bao_cao_tuan', 'bao_cao_kho', 'bao_cao_ban_hang', 'xem_khach_hang', 'quan_ly_chien_dich'] },
  { href: '/okr', label: 'OKR', icon: ICON.target, needs: ['quan_ly_okr', 'xem_okr'] },
  { href: '/bao-cao-tuan', label: 'Báo cáo tuần', icon: ICON.chart, needs: ['bao_cao_tuan', 'quan_ly_okr'] },
  { href: '/bao-cao-kho', label: 'Báo cáo kho', icon: ICON.package, needs: ['bao_cao_kho', 'quan_ly_okr'] },
  { href: '/bao-cao-ban-hang', label: 'Báo cáo bán hàng', icon: ICON.chart, needs: ['bao_cao_ban_hang', 'quan_ly_okr'] },
  { href: '/khach-hang', label: 'Khách hàng', icon: ICON.users, needs: ['xem_khach_hang', 'sua_khach_hang', 'import_khach'] },
  { href: '/thi-truong', label: 'Báo cáo Tổng hợp KD', icon: ICON.chart, needs: ['ket_luan', 'quan_ly_chien_dich'] },
  { href: '/chien-dich', label: 'Chiến dịch', icon: ICON.target, needs: ['quan_ly_chien_dich'] },
  { href: '/quan-tri', label: 'Cài đặt chung', icon: ICON.settings, needs: ['quan_ly_nguoi_dung', 'quan_ly_danh_muc', 'quan_ly_cai_dat', 'xem_log'] },
];

function NavList({ current, onNav, collapsed }: { current: string; onNav?: () => void; collapsed?: boolean }) {
  const { can } = useAuth();
  const visible = LINKS.filter((l) => !l.needs || l.needs.some((p) => can(p)));
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
      {visible.map((l) => {
        const active = l.href === '/' ? current === '/' : current.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} onClick={onNav} title={collapsed ? l.label : undefined}
            aria-current={active ? 'page' : undefined} aria-label={collapsed ? l.label : undefined}
            className={`flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} ${active ? 'bg-[#0d6efd] text-white shadow-[0_1px_4px_rgba(13,110,253,0.35)]' : 'text-slate-400 hover:bg-white/10 hover:text-white'} focus-visible:outline-2 focus-visible:outline-white`}>
            {l.icon}
            {!collapsed && l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar trái (desktop) + drawer (mobile) — đổi từ AppNav. */
export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { fullName, role, avatarUrl, signOut } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [appName, setAppName] = useState('Lifepro - Quản lý Mục tiêu, Báo cáo');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'APP_NAME').single();
      if (!cancelled && (data as any)?.value) setAppName(String((data as any).value));
    })();
    return () => { cancelled = true; };
  }, []);
  const appParts = appName.trim().split(/\s+/);
  const appMain = appParts[0] ?? appName;
  const appSub = appParts.slice(1).join(' ');

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f8]">
      {/* Desktop sidebar - NovaX navy */}
      <aside className={`hidden shrink-0 flex-col bg-[#0f2a4a] text-white md:flex sticky top-0 h-screen ${collapsed ? 'w-[64px]' : 'w-[230px]'}`}>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#0f2a4a] font-black text-[11px] tracking-tighter" aria-hidden>N</span>
          {!collapsed && <span className="text-sm font-black tracking-tight text-white">{appMain}{appSub && <span className="font-light text-blue-200 text-[10px] ml-1">{appSub}</span>}</span>}
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'} title={collapsed ? 'Mở rộng' : 'Thu gọn'}
            className="ml-auto grid h-7 w-7 place-items-center rounded-md text-blue-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} /></svg>
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          <NavList current={path} collapsed={collapsed} />
        </div>
        <div className="border-t border-white/10 bg-[#162c6b]/50 p-3">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setAvatarOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90" title="Đổi avatar">
                <Avatar name={fullName || '?'} src={avatarUrl} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{fullName}</span>
                  <span className="block truncate text-xs text-blue-200">{role}</span>
                </span>
              </button>
              <button onClick={() => signOut()} className="shrink-0 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white hover:text-[#1e3a8a] focus-visible:outline-2 focus-visible:outline-white">Thoát</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => setAvatarOpen(true)} aria-label="Đổi avatar" className="grid h-8 w-8 place-items-center overflow-hidden rounded-full ring-1 ring-white/20 hover:ring-white/40">
                <Avatar name={fullName || '?'} src={avatarUrl} size={32} />
              </button>
              <button onClick={() => signOut()} aria-label="Đăng xuất" className="grid h-8 w-8 place-items-center rounded-md text-blue-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main + mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#f0f4f8]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden shadow-sm">
          <button onClick={() => setOpen(true)} aria-label="Mở menu" aria-controls="mobile-drawer"
            className="grid h-9 w-9 place-items-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#0f2a4a]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span className="text-[15px] font-bold tracking-tight text-[#0f2a4a]">{appName}</span>
        </header>
        <div className="flex-1">{children}</div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div role="presentation" className="fixed inset-0 z-30 md:hidden">
          <button aria-label="Đóng menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside id="mobile-drawer" className="relative flex h-full w-[250px] flex-col bg-[#0f2a4a] text-white shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
              <span className="text-sm font-bold tracking-tight text-white">Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-md text-blue-200 hover:bg-white/10 hover:text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>
            </div>
            <div className="flex-1 p-3"><NavList current={path} onNav={() => setOpen(false)} /></div>
            <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-[#162c6b]/50 p-3">
              <button onClick={() => setAvatarOpen(true)} className="flex min-w-0 items-center gap-2 text-left"><Avatar name={fullName || '?'} src={avatarUrl} size={28} /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{fullName}</span><span className="block truncate text-xs text-blue-200">{role}</span></span></button>
              <button onClick={() => signOut()} className="shrink-0 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-[#1e3a8a]">Thoát</button>
            </div>
          </aside>
        </div>
      )}
      <AvatarDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </div>
  );
}
