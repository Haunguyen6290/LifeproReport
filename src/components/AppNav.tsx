'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './RequireAuth';

const LINKS = [
  { href: '/', label: 'Tổng quan', soon: false },
  { href: '/khach-hang', label: 'Khách hàng', soon: false },
  { href: '/thi-truong', label: 'Thị trường', soon: false },
  { href: '/chien-dich', label: 'Chiến dịch', soon: false },
  { href: '/quan-tri', label: 'Quản trị', soon: false },
];

export function AppNav() {
  const { fullName, role, signOut } = useAuth();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white backdrop-blur-[18px]">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[#3b82f6] text-white" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
        </span>
        <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Điều hướng chính">
          {LINKS.map((l) => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.soon ? '#' : l.href} aria-disabled={l.soon}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? 'bg-[color:rgba(37,99,235,0.12)] text-[#1e3a8a]' : 'text-slate-600 hover:bg-slate-100'} ${l.soon ? 'pointer-events-none opacity-50' : ''}`}>
                {l.label}{l.soon ? ' · sắp ra mắt' : ''}
              </Link>
            );
          })}
        </nav>
        <div className="hidden text-right sm:block">
          <div className="text-sm font-semibold">{fullName}</div>
          <div className="text-xs text-slate-600">{role}</div>
        </div>
        <button onClick={() => signOut()}
          className="rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-1.5 text-sm font-semibold transition hover:border-[var(--color-primary)] hover:text-[#1e3a8a] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]">
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
