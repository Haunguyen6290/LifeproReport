'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/quan-tri/danh-muc', label: 'Danh mục' },
  { href: '/quan-tri/tai-khoan', label: 'Tài khoản' },
  { href: '/quan-tri/phan-quyen', label: 'Phân quyền' },
  { href: '/quan-tri/ho-so', label: 'Hồ sơ công ty' },
  { href: '/quan-tri/cai-dat', label: 'Cài đặt' },
  { href: '/quan-tri/nhat-ky', label: 'Nhật ký' },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2" aria-label="Quản trị">
      {TABS.map((t) => {
        const active = path === t.href;
        return <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${active ? 'bg-[#1e3a8a] text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>{t.label}</Link>;
      })}
    </nav>
  );
}
