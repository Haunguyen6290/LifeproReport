'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';

const TABS = [
  { href: '/quan-tri/danh-muc', label: 'Danh mục' },
  { href: '/quan-tri/tai-khoan', label: 'Tài khoản' },
  { href: '/quan-tri/phan-quyen', label: 'Phân quyền' },
  { href: '/quan-tri/ho-so', label: 'Hồ sơ công ty' },
  { href: '/quan-tri/cai-dat', label: 'Cài đặt' },
  { href: '/quan-tri/nhat-ky', label: 'Nhật ký' },
];

function Screen() {
  const path = usePathname();
  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6 text-slate-900">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Quản trị</h1>
        <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2" aria-label="Quản trị">
          {TABS.map((t) => {
            const active = path === t.href;
            return <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${active ? 'bg-[color:rgba(37,99,235,0.12)] text-[#1e3a8a]' : 'text-slate-600 hover:bg-slate-100 hover:text-[var(--color-foreground)]'}`}>{t.label}</Link>;
          })}
        </nav>
        <p className="text-sm text-slate-600">Chọn một mục để cấu hình.</p>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
